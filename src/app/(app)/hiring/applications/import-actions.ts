"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { defaultAppliedPipelineStageIdInTxn } from "@/lib/hiring-pipeline";
import {
  mapWithConcurrencyLimit,
  RESUME_IMPORT_STAGING_CONCURRENCY,
  stageResumeImportItemFromBuffer,
} from "@/lib/hiring-resume-import-process";

type HiringTxnClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const HR_GATE = ["CEO", "ADMIN", "HR"];

const MAX_ITEMS_PER_BATCH = 25;
const BATCH_TTL_DAYS = 7;

async function requireHiringUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/sign-in");
  const me = await prisma.user.findUnique({ where: { email } });
  if (!me || !HR_GATE.includes(me.role)) redirect("/home");
  return me;
}

function nu(raw: string): string | null {
  const t = raw.trim();
  return t.length ? t : null;
}

async function hiringAttachApplication(
  tx: HiringTxnClient,
  args: {
    jobId: string;
    candidateId: string;
    applicationSource: string | null;
    actorUserId: string;
  },
) {
  const [job, cand] = await Promise.all([
    tx.hiringJob.findUnique({ where: { id: args.jobId }, select: { title: true, status: true } }),
    tx.hiringCandidate.findUnique({
      where: { id: args.candidateId },
      select: { fullName: true, email: true },
    }),
  ]);
  if (!job || job.status !== "OPEN") throw new Error("JOB_NOT_OPEN");
  const pipelineStageId = await defaultAppliedPipelineStageIdInTxn(tx);
  const app = await tx.hiringApplication.create({
    data: {
      jobId: args.jobId,
      candidateId: args.candidateId,
      applicationSource: args.applicationSource,
      pipelineStageId,
    },
  });
  await tx.hiringActivity.create({
    data: {
      kind: "APPLICATION_CREATED",
      summary: `${cand?.fullName ?? "Candidate"} (${cand?.email ?? "—"}) → ${job.title}`,
      payloadJson: JSON.stringify({
        jobId: args.jobId,
        applicationSource: args.applicationSource,
      }),
      candidateId: args.candidateId,
      applicationId: app.id,
      actorUserId: args.actorUserId,
    },
  });
}

function prismaUniqueViolation(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

function invalidateImportPaths(jobId?: string) {
  revalidatePath("/hiring");
  revalidatePath("/hiring/applications");
  revalidatePath("/hiring/applications/import");
  revalidatePath("/hiring/pipeline");
  if (jobId) revalidatePath(`/hiring/jobs/${jobId}`);
}

export type BulkImportCommitRow = {
  itemId: string;
  include: boolean;
  fullName: string;
  email: string;
  phone?: string | null;
  candidateLocation?: string | null;
};

export async function createBulkResumeImportFromUpload(formData: FormData): Promise<
  { ok: true; batchId: string } | { ok: false; error: string }
> {
  const me = await requireHiringUser();
  const jobId = String(formData.get("targetJobId") || "").trim();
  const applicationSource = nu(String(formData.get("applicationSource") || ""));

  if (!jobId) return { ok: false, error: "Choose an open job posting." };

  const job = await prisma.hiringJob.findFirst({
    where: { id: jobId, status: "OPEN" },
    select: { id: true },
  });
  if (!job) return { ok: false, error: "That posting is not open." };

  const rawFiles = formData.getAll("resumeFiles");
  const files = rawFiles.filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, error: "Select at least one résumé file." };
  if (files.length > MAX_ITEMS_PER_BATCH) {
    return { ok: false, error: `You can upload at most ${MAX_ITEMS_PER_BATCH} files per batch.` };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + BATCH_TTL_DAYS);

  const batch = await prisma.hiringResumeImportBatch.create({
    data: {
      createdById: me.id,
      targetJobId: job.id,
      applicationSource,
      sourceChannel: "UPLOAD",
      expiresAt,
    },
    select: { id: true },
  });

  const fileBuffers = await Promise.all(
    files.map(async (file) => ({
      buf: Buffer.from(await file.arrayBuffer()),
      originalFileName: file.name || "resume.pdf",
      mimeHint: file.type || undefined,
    })),
  );

  await mapWithConcurrencyLimit(fileBuffers, RESUME_IMPORT_STAGING_CONCURRENCY, async (entry) =>
    stageResumeImportItemFromBuffer({
      batchId: batch.id,
      buffer: entry.buf,
      originalFileName: entry.originalFileName,
      mimeHint: entry.mimeHint,
    }),
  );

  invalidateImportPaths(job.id);
  return { ok: true, batchId: batch.id };
}

export async function commitBulkResumeImport(
  batchId: string,
  rows: BulkImportCommitRow[],
): Promise<{ results: { itemId: string; ok: boolean; error?: string }[] }> {
  const me = await requireHiringUser();

  const batch = await prisma.hiringResumeImportBatch.findUnique({
    where: { id: batchId },
    include: { items: true },
  });

  const results: { itemId: string; ok: boolean; error?: string }[] = [];

  if (!batch || batch.expiresAt.getTime() < Date.now()) {
    return {
      results: rows.map((r) => ({
        itemId: r.itemId,
        ok: false,
        error: "Import batch expired or was removed.",
      })),
    };
  }

  if (batch.sourceChannel === "UPLOAD" && batch.createdById !== me.id) {
    return {
      results: rows.map((r) => ({
        itemId: r.itemId,
        ok: false,
        error: "You don’t have access to this import batch.",
      })),
    };
  }

  if (!batch.targetJobId) {
    return {
      results: rows.map((r) => ({
        itemId: r.itemId,
        ok: false,
        error: "Batch has no target job.",
      })),
    };
  }

  const jobOpen = await prisma.hiringJob.findFirst({
    where: { id: batch.targetJobId, status: "OPEN" },
    select: { id: true },
  });
  if (!jobOpen) {
    return {
      results: rows.map((r) => ({
        itemId: r.itemId,
        ok: false,
        error: "Target job is no longer open.",
      })),
    };
  }

  const jobId = batch.targetJobId;

  for (const row of rows) {
    if (!row.include) {
      results.push({ itemId: row.itemId, ok: true });
      continue;
    }

    const item = batch.items.find((i) => i.id === row.itemId);
    if (!item) {
      results.push({ itemId: row.itemId, ok: false, error: "Row not found." });
      continue;
    }

    if (item.status === "IMPORTED") {
      results.push({ itemId: row.itemId, ok: true });
      continue;
    }

    const fullName = row.fullName.trim().slice(0, 200);
    const email = row.email.trim().toLowerCase().slice(0, 320);
    if (!fullName || !email) {
      results.push({
        itemId: row.itemId,
        ok: false,
        error: "Name and email are required for selected rows.",
      });
      continue;
    }

    if (!item.resumeUrl?.startsWith("/hiring-uploads/")) {
      results.push({
        itemId: row.itemId,
        ok: false,
        error: "Missing stored résumé file for this row.",
      });
      continue;
    }

    const phone = nu(String(row.phone ?? ""));
    const candidateLocation = nu(String(row.candidateLocation ?? ""));
    const applicationSource = batch.applicationSource;

    const intakeSnapshot = JSON.stringify({
      fullName,
      phone,
      candidateLocation,
      source: applicationSource,
      resumeUrl: item.resumeUrl,
      notes: null,
      targetJobId: jobId,
      bulkImportItemId: item.id,
    });

    try {
      const existing = await prisma.hiringCandidate.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, email: true },
      });

      if (existing) {
        await prisma.$transaction(async (tx) => {
          await hiringAttachApplication(tx, {
            jobId,
            candidateId: existing.id,
            applicationSource,
            actorUserId: me.id,
          });
        });

        await prisma.hiringResumeImportItem.update({
          where: { id: item.id },
          data: { status: "IMPORTED", error: null },
        });

        await prisma.hiringActivity.create({
          data: {
            kind: "CANDIDATE_DUPLICATE_INTAKE",
            summary: `Bulk import linked existing candidate ${existing.email} to job application.`,
            payloadJson: intakeSnapshot,
            candidateId: existing.id,
            actorUserId: me.id,
          },
        });

        results.push({ itemId: row.itemId, ok: true });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const created = await tx.hiringCandidate.create({
          data: {
            fullName,
            email,
            phone,
            candidateLocation,
            source: applicationSource,
            resumeUrl: item.resumeUrl,
            notes: null,
            createdById: me.id,
          },
        });

        await tx.hiringActivity.create({
          data: {
            kind: "CANDIDATE_CREATED",
            summary: `Candidate profile created (bulk import): ${fullName} (${email})`,
            payloadJson: intakeSnapshot,
            candidateId: created.id,
            actorUserId: me.id,
          },
        });

        await hiringAttachApplication(tx, {
          jobId,
          candidateId: created.id,
          applicationSource,
          actorUserId: me.id,
        });
      });

      await prisma.hiringResumeImportItem.update({
        where: { id: item.id },
        data: { status: "IMPORTED", error: null },
      });

      results.push({ itemId: row.itemId, ok: true });
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && String((e as Error).message) === "JOB_NOT_OPEN") {
        results.push({ itemId: row.itemId, ok: false, error: "Job is not open." });
      } else if (prismaUniqueViolation(e)) {
        results.push({
          itemId: row.itemId,
          ok: false,
          error: "Duplicate application for this job or candidate constraint.",
        });
      } else {
        results.push({ itemId: row.itemId, ok: false, error: "Could not save this candidate." });
      }
    }
  }

  invalidateImportPaths(jobId);
  return { results };
}

export async function discardBulkResumeImportBatch(batchId: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireHiringUser();
  const batch = await prisma.hiringResumeImportBatch.findUnique({
    where: { id: batchId },
    select: { id: true, createdById: true, sourceChannel: true, targetJobId: true },
  });
  if (!batch) return { ok: false, error: "Batch not found." };
  if (batch.sourceChannel === "UPLOAD" && batch.createdById !== me.id) {
    return { ok: false, error: "Not allowed." };
  }
  await prisma.hiringResumeImportBatch.delete({ where: { id: batchId } });
  invalidateImportPaths(batch.targetJobId ?? undefined);
  return { ok: true };
}
