import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hiringPublicCareersJobsWhere } from "@/lib/hiring-job-active";
import { getCandidateSession } from "@/lib/candidate-session";
import { firstSearchParam } from "@/lib/search-param";
import { CareersChrome } from "../_components/careers-chrome";
import { ApplyNowAuthModal } from "../_components/apply-now-auth-modal";
import { JobPostingDetails, PUBLIC_JOB_POSTING_SELECT } from "../_components/job-posting-details";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ error?: string | string[]; auth?: string | string[] }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { jobId } = await props.params;
  const job = await prisma.hiringJob.findFirst({
    where: { id: jobId, ...hiringPublicCareersJobsWhere() },
    select: { title: true },
  });
  return {
    title: job ? job.title : "Open role",
  };
}

export default async function CareersJobDetailPage(props: Props) {
  const { jobId } = await props.params;
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  const authParam = firstSearchParam(searchParams.auth);
  const authMode = authParam === "signin" ? "signin" : "register";
  const openAuthModal = authParam === "signin" || authParam === "register";

  const [job, me] = await Promise.all([
    prisma.hiringJob.findFirst({
      where: { id: jobId, ...hiringPublicCareersJobsWhere() },
      select: PUBLIC_JOB_POSTING_SELECT,
    }),
    getCandidateSession(),
  ]);

  if (!job) notFound();

  const existingApp = me
    ? await prisma.hiringApplication.findUnique({
        where: { jobId_candidateId: { jobId, candidateId: me.candidateId } },
        select: { id: true },
      })
    : null;

  const pageError = openAuthModal ? undefined : flashError;

  return (
    <CareersChrome active="jobs">
      <article className="space-y-8">
        <div className="space-y-3">
          <Link href="/careers/jobs" className="text-sm font-medium text-sky-800 hover:underline">
            ← All open roles
          </Link>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">{job.title}</h1>
        </div>

        {pageError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {decodeURIComponent(pageError)}
          </div>
        ) : null}

        <JobPostingDetails job={job} />

        <div className="flex flex-wrap gap-3">
          {existingApp ? (
            <Link
              href="/careers/portal/applications"
              className="inline-flex items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Already applied — view status
            </Link>
          ) : me ? (
            <Link
              href={`/careers/${job.id}/apply`}
              className="inline-flex items-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
            >
              Apply now
            </Link>
          ) : (
            <ApplyNowAuthModal
              jobId={job.id}
              openOnMount={openAuthModal}
              initialMode={authMode}
              flashError={openAuthModal ? flashError : undefined}
            />
          )}
        </div>
      </article>
    </CareersChrome>
  );
}
