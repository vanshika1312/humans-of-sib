import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hiringJobAcceptingPublicApplications } from "@/lib/hiring-job-active";
import { getCandidateSession } from "@/lib/candidate-session";
import { firstSearchParam } from "@/lib/search-param";
import { CareersChrome } from "../../_components/careers-chrome";
import { applyToJob } from "../../actions";
import { ApplicationQuestionFields } from "../../_components/application-question-fields";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { jobId } = await props.params;
  const job = await prisma.hiringJob.findFirst({
    where: hiringJobAcceptingPublicApplications(jobId),
    select: { title: true },
  });
  return {
    title: job ? `Apply · ${job.title}` : "Apply",
  };
}

export default async function CareersApplyPage(props: Props) {
  const { jobId } = await props.params;
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);

  const me = await getCandidateSession();
  if (!me) redirect(`/careers/${jobId}?auth=register`);

  const [job, candidate, existingApp] = await Promise.all([
    prisma.hiringJob.findFirst({
      where: hiringJobAcceptingPublicApplications(jobId),
      select: {
        id: true,
        title: true,
        applicationQuestions: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.hiringCandidate.findUnique({ where: { id: me.candidateId } }),
    prisma.hiringApplication.findUnique({
      where: { jobId_candidateId: { jobId, candidateId: me.candidateId } },
      select: { id: true },
    }),
  ]);

  if (!job) notFound();
  if (existingApp) redirect("/careers/portal/applications?already=1");
  if (!candidate) redirect(`/careers/${jobId}?auth=register`);

  const action = applyToJob.bind(null, jobId);

  return (
    <CareersChrome active="jobs">
      <div className="space-y-8">
        <div>
          <Link href={`/careers/${jobId}`} className="text-sm font-medium text-sky-800 hover:underline">
            ← Back to {job.title}
          </Link>
          <h1 className="text-2xl font-bold text-ink-900 mt-2 tracking-tight">Apply for {job.title}</h1>
          <p className="text-sm text-ink-500 mt-1">
            Confirm your details and upload a résumé. Portfolio is optional. After you submit, the next stage is a short
            personality and role assessment.
          </p>
        </div>

        {flashError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {decodeURIComponent(flashError)}
          </div>
        ) : null}

        <form action={action} className="space-y-8 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Basic details</h2>
              <p className="text-sm text-ink-500 mt-0.5">We&apos;ll use these to reach you about next steps.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  defaultValue={candidate.fullName}
                  placeholder="e.g. Priya Kadam"
                />
              </div>
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input id="email" value={candidate.email} disabled />
              </div>
              <div>
                <Label htmlFor="phone">Phone / WhatsApp number</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={candidate.phone ?? ""}
                  placeholder="e.g. +91 98200 11234"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="candidateLocation">Current location</Label>
                <Input
                  id="candidateLocation"
                  name="candidateLocation"
                  defaultValue={candidate.candidateLocation ?? ""}
                  placeholder="e.g. Mumbai"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-ink-100 pt-6">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Resume{candidate.resumeUrl ? "" : " *"}
              </h2>
              <p className="text-sm text-ink-500 mt-0.5">
                {candidate.resumeUrl
                  ? "Upload a PDF, DOC, or DOCX résumé to replace the one on file."
                  : "Upload a PDF, DOC, or DOCX résumé — it's required to apply."}{" "}
                We&apos;ll pull out your email, location, and skills so we can see how well you match this role.
              </p>
            </div>
            <Label htmlFor="resumeFile" className="sr-only">
              Résumé file
            </Label>
            <Input id="resumeFile" name="resumeFile" type="file" accept=".pdf,.doc,.docx,application/pdf" />
            {candidate.resumeUrl ? (
              <p className="text-xs text-ink-500">
                Current résumé on file.{" "}
                <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                  View
                </a>
              </p>
            ) : (
              <p className="text-xs text-ink-500">Required for your first application.</p>
            )}
          </section>

          <section className="space-y-3 border-t border-ink-100 pt-6">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Portfolio</h2>
              <p className="text-sm text-ink-500 mt-0.5">Optional — a GitHub, Behance, or personal site link.</p>
            </div>
            <Label htmlFor="portfolioUrl">Portfolio URL</Label>
            <Input
              id="portfolioUrl"
              name="portfolioUrl"
              type="text"
              inputMode="url"
              defaultValue={candidate.portfolioUrl ?? ""}
              placeholder="https://…"
            />
          </section>

          <ApplicationQuestionFields questions={job.applicationQuestions} />

          <Button type="submit" variant="accent" size="md" className="w-full sm:w-auto">
            Submit application
          </Button>
        </form>
      </div>
    </CareersChrome>
  );
}
