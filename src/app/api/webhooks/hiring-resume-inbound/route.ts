import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createHiringResumeImportItemFromBuffer } from "@/lib/hiring-resume-import-process";

const BATCH_TTL_DAYS = 7;

/**
 * Inbound multipart webhook for résumé attachments (Mailgun/SendGrid-style POST).
 * Authenticate with Authorization: Bearer <HIRING_RESUME_INBOUND_SECRET>
 * or X-Hiring-Inbound-Secret.
 */
export async function POST(req: Request) {
  const secret = process.env.HIRING_RESUME_INBOUND_SECRET?.trim();
  const jobId = process.env.HIRING_INBOUND_DEFAULT_JOB_ID?.trim();
  if (!secret || !jobId) {
    return NextResponse.json({ error: "Inbound hiring webhook not configured." }, { status: 501 });
  }

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const headerSecret = req.headers.get("x-hiring-inbound-secret")?.trim();
  if (bearer !== secret && headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const job = await prisma.hiringJob.findFirst({
    where: { id: jobId, status: "OPEN" },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json(
      { error: "HIRING_INBOUND_DEFAULT_JOB_ID is missing or not an OPEN job." },
      { status: 422 },
    );
  }

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body." }, { status: 400 });
  }

  const attachments: { buffer: Buffer; fileName: string; mimeHint?: string }[] = [];

  for (const [key, value] of fd.entries()) {
    if (!(value instanceof Blob)) continue;
    const blob = value as File;
    if (blob.size <= 0) continue;
    const name =
      typeof (blob as File).name === "string" && (blob as File).name.length > 0
        ? (blob as File).name
        : `${key.replace(/^attachment-?/i, "resume")}.pdf`;
    const buf = Buffer.from(await blob.arrayBuffer());
    attachments.push({
      buffer: buf,
      fileName: name.slice(0, 280),
      mimeHint: blob.type || undefined,
    });
  }

  if (!attachments.length) {
    return NextResponse.json({ ok: true, processed: 0, message: "No file attachments found." });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + BATCH_TTL_DAYS);

  const batch = await prisma.hiringResumeImportBatch.create({
    data: {
      createdById: null,
      targetJobId: job.id,
      applicationSource: "Email inbound",
      sourceChannel: "EMAIL",
      expiresAt,
    },
    select: { id: true },
  });

  for (const att of attachments) {
    await createHiringResumeImportItemFromBuffer({
      batchId: batch.id,
      buffer: att.buffer,
      originalFileName: att.fileName,
      mimeHint: att.mimeHint,
    });
  }

  revalidatePath("/hiring/applications");
  revalidatePath("/hiring/applications/import");

  return NextResponse.json({
    ok: true,
    batchId: batch.id,
    processed: attachments.length,
    reviewUrl: `/hiring/applications/import?batch=${encodeURIComponent(batch.id)}`,
  });
}
