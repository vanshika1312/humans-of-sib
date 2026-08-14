import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCandidateSession } from "@/lib/candidate-session";
import { firstSearchParam } from "@/lib/search-param";
import { CareersChrome } from "../../../../_components/careers-chrome";
import { AssessmentForm } from "../../../../_components/assessment-form";
import { submitApplicationAssessment } from "../../../../actions";
import {
  assessmentEligible,
  buildAssessmentQuestions,
  displayAnswerLabel,
  parseStoredResponses,
  publicAssessmentQuestions,
  ROLE_FAMILY_LABEL,
  roleFamilyFromJob,
} from "@/lib/hiring-assessment";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{
    error?: string | string[];
    applied?: string | string[];
    submitted?: string | string[];
    already?: string | string[];
  }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { applicationId } = await props.params;
  const app = await prisma.hiringApplication.findUnique({
    where: { id: applicationId },
    select: { job: { select: { title: true } } },
  });
  return {
    title: app ? `Assessment · ${app.job.title}` : "Assessment",
  };
}

export default async function ApplicationAssessmentPage(props: Props) {
  const { applicationId } = await props.params;
  const searchParams = await props.searchParams;
  const me = await requireCandidateSession({
    callbackUrl: `/careers/portal/applications/${applicationId}/assessment`,
  });

  const flashError = firstSearchParam(searchParams.error);
  const applied = firstSearchParam(searchParams.applied) === "1";
  const submitted = firstSearchParam(searchParams.submitted) === "1";
  const already = firstSearchParam(searchParams.already) === "1";

  const app = await prisma.hiringApplication.findFirst({
    where: { id: applicationId, candidateId: me.candidateId },
    include: {
      job: { select: { title: true, department: { select: { name: true } } } },
      pipelineStage: { select: { key: true, isHired: true, isRejected: true } },
      assessment: true,
    },
  });
  if (!app) notFound();

  const family = roleFamilyFromJob(app.job.title, app.job.department?.name);
  const action = submitApplicationAssessment.bind(null, app.id);

  if (app.assessment) {
    const responses = parseStoredResponses(app.assessment.responsesJson);
    const psychometric = responses.filter((r) => r.kind === "PSYCHOMETRIC");
    const role = responses.filter((r) => r.kind === "ROLE");

    return (
      <CareersChrome active="applications">
        <div className="space-y-8">
          <div>
            <Link href="/careers/portal/applications" className="text-sm font-medium text-sky-800 hover:underline">
              ← My applications
            </Link>
            <h1 className="text-2xl font-bold text-ink-900 mt-2 tracking-tight">Assessment submitted</h1>
            <p className="text-sm text-ink-500 mt-1">
              Thanks — our hiring team can see your answers for {app.job.title}. You&apos;ll see stage updates on My
              applications.
            </p>
          </div>

          {submitted || already ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Assessment received.
            </div>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">Your answers</h2>
            <ol className="space-y-3">
              {[...psychometric, ...role].map((row, i) => (
                <li key={row.key || String(i)} className="rounded-2xl border border-ink-100 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                    {row.kind === "PSYCHOMETRIC" ? "Personality" : "Role"} · {i + 1}
                  </p>
                  <p className="text-sm font-medium text-ink-800 mt-1">{row.prompt}</p>
                  <p className="text-sm text-ink-700 mt-2 whitespace-pre-wrap">{displayAnswerLabel(row)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </CareersChrome>
    );
  }

  if (!assessmentEligible(app.pipelineStage)) {
    redirect("/careers/portal/applications");
  }

  const questions = publicAssessmentQuestions(
    buildAssessmentQuestions({
      title: app.job.title,
      departmentName: app.job.department?.name ?? null,
    }),
  );

  return (
    <CareersChrome active="applications">
      <div className="space-y-8">
        <div>
          <Link href="/careers/portal/applications" className="text-sm font-medium text-sky-800 hover:underline">
            ← My applications
          </Link>
          <h1 className="text-2xl font-bold text-ink-900 mt-2 tracking-tight">Next step: assessment</h1>
          <p className="text-sm text-ink-500 mt-1">
            {app.job.title}
            {app.job.department?.name ? ` · ${app.job.department.name}` : ""} · {ROLE_FAMILY_LABEL[family]} track.
            A short personality questionnaire, then a few questions about how this role actually works at Skillinabox.
            Takes about 10–15 minutes.
          </p>
        </div>

        {applied ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Application submitted. Complete this assessment so we can learn a bit about you and how you think about this
            role.
          </div>
        ) : null}

        {flashError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {decodeURIComponent(flashError)}
          </div>
        ) : null}

        <AssessmentForm questions={questions} action={action} />

        <p className="text-xs text-ink-400">
          You can also finish this later from{" "}
          <Link href="/careers/portal/applications" className="underline">
            My applications
          </Link>
          .
        </p>
        <Link href="/careers/portal/applications">
          <Button variant="ghost" size="sm">
            Skip for now
          </Button>
        </Link>
      </div>
    </CareersChrome>
  );
}
