import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { computeResumeSkillMatch } from "@/lib/hiring-resume-match";
import { defaultAppliedPipelineStageIdInTxn } from "@/lib/hiring-pipeline";
import { hiringJobAcceptingApplications } from "@/lib/hiring-job-active";

type Tx = Prisma.TransactionClient;

/**
 * Create a hiring application in APPLIED stage with optional ATS scoring.
 * Used by recruiter intake and the public careers portal.
 */
export async function createHiringApplicationInTxn(
  tx: Tx,
  args: {
    jobId: string;
    candidateId: string;
    applicationSource: string | null;
    actorUserId?: string | null;
    resumeText?: string | null;
  },
) {
  const [job, cand] = await Promise.all([
    tx.hiringJob.findFirst({
      where: hiringJobAcceptingApplications(args.jobId),
      select: { title: true, status: true, skillsRequired: true },
    }),
    tx.hiringCandidate.findUnique({
      where: { id: args.candidateId },
      select: { fullName: true, email: true, resumeExtractedText: true },
    }),
  ]);
  if (!job) throw new Error("JOB_NOT_OPEN");

  const pipelineStageId = await defaultAppliedPipelineStageIdInTxn(tx);
  const resumeTextForScoring = args.resumeText ?? cand?.resumeExtractedText ?? null;
  const match = computeResumeSkillMatch(resumeTextForScoring, job.skillsRequired);

  const app = await tx.hiringApplication.create({
    data: {
      jobId: args.jobId,
      candidateId: args.candidateId,
      applicationSource: args.applicationSource,
      pipelineStageId,
      ...(resumeTextForScoring
        ? {
            resumeMatchScore: match.score,
            resumeMatchedSkillsJson: JSON.stringify(match.matched),
            resumeMissingSkillsJson: JSON.stringify(match.missing),
            resumeScoredAt: new Date(),
          }
        : {}),
    },
  });

  await tx.hiringActivity.create({
    data: {
      kind: "APPLICATION_CREATED",
      summary: `${cand?.fullName ?? "Candidate"} (${cand?.email ?? "—"}) → ${job.title}`,
      payloadJson: JSON.stringify({
        jobId: args.jobId,
        applicationSource: args.applicationSource,
        resumeMatchScore: resumeTextForScoring ? match.score : null,
      }),
      candidateId: args.candidateId,
      applicationId: app.id,
      actorUserId: args.actorUserId ?? null,
    },
  });

  return app;
}

export async function findWithdrawnPipelineStageId(
  tx: Tx | typeof prisma = prisma,
): Promise<string | null> {
  const row = await tx.hiringPipelineStage.findFirst({
    where: { key: "WITHDRAWN" },
    select: { id: true },
  });
  return row?.id ?? null;
}
