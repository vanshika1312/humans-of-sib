import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ApplicationStageControl } from "../_components/application-stage-control";
import { formatDate } from "@/lib/utils";
import {
  applicationSourceLabel,
  formatHiringJobLocation,
  splitCandidateFullName,
} from "@/lib/hiring-application-display";
import { firstSearchParam } from "@/lib/search-param";
import { loadPipelineStagesOrdered } from "@/lib/hiring-pipeline";

type Props = {
  searchParams: Promise<{
    error?: string | string[];
    moved?: string | string[];
    added?: string | string[];
    linked?: string | string[];
  }>;
};

export default async function ApplicationsPage(props: Props) {
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  const flashMoved = firstSearchParam(searchParams.moved) === "1";
  const flashAdded = firstSearchParam(searchParams.added) === "1";
  const flashLinked = firstSearchParam(searchParams.linked) === "1";

  const [pipelineStagesOrdered, rows] = await Promise.all([
    loadPipelineStagesOrdered(),
    prisma.hiringApplication.findMany({
      orderBy: { appliedAt: "desc" },
      include: {
        candidate: true,
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            workArrangement: true,
          },
        },
        pipelineStage: { select: { id: true, label: true } },
      },
    }),
  ]);

  const stageSelectOptions = pipelineStagesOrdered.map((s) => ({ id: s.id, label: s.label }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        emoji="📥"
        subtitle="Every submission linked to an opening — date, contact, role, locations, stage, and how they found us."
        action={
          <Link href="/hiring/pipeline">
            <Button variant="outline" size="md">
              Pipeline board
            </Button>
          </Link>
        }
      />

      {flashAdded && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Candidate and application recorded — use the Jobs page or timeline to refine their profile.
        </div>
      )}
      {flashLinked && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Duplicate email — attached the existing candidate to this job&apos;s funnel.
        </div>
      )}
      {flashMoved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Stage updated.
        </div>
      )}
      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(flashError)}
        </div>
      )}

      <div className="rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-4 py-3 whitespace-nowrap">Date applied</th>
                <th className="px-4 py-3 whitespace-nowrap">First name</th>
                <th className="px-4 py-3 whitespace-nowrap">Last name</th>
                <th className="px-4 py-3 min-w-[180px]">Email</th>
                <th className="px-4 py-3 whitespace-nowrap">Phone</th>
                <th className="px-4 py-3 min-w-[140px]">Role applied for</th>
                <th className="px-4 py-3 min-w-[120px]">Job location</th>
                <th className="px-4 py-3 min-w-[120px]">Candidate location</th>
                <th className="px-4 py-3 min-w-[120px]">Source / job portal</th>
                <th className="px-4 py-3 min-w-[200px]">Stage</th>
                <th className="px-4 py-3 whitespace-nowrap">Application</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-16 text-center text-ink-500">
                    No applications yet — attach candidates from a{" "}
                    <Link href="/hiring/jobs" className="font-semibold text-sky-700 hover:underline">
                      job posting
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                rows.map((app) => {
                  const { firstName, lastName } = splitCandidateFullName(app.candidate.fullName);
                  const portal = applicationSourceLabel(
                    app.applicationSource,
                    app.candidate.source,
                  );
                  const jobLoc = formatHiringJobLocation(app.job);
                  return (
                    <tr key={app.id} className="align-top hover:bg-ink-50/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-ink-600 tabular-nums">
                        {formatDate(app.appliedAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink-800">
                        <Link href={`/hiring/applications/${app.id}`} className="text-sky-800 hover:underline">
                          {firstName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-800">
                        <Link href={`/hiring/applications/${app.id}`} className="hover:underline">
                          {lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-600 break-all">{app.candidate.email}</td>
                      <td className="px-4 py-3 text-ink-600 whitespace-nowrap">{app.candidate.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/hiring/jobs/${app.job.id}`}
                          className="font-medium text-sky-800 hover:underline"
                        >
                          {app.job.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{jobLoc}</td>
                      <td className="px-4 py-3 text-ink-600">{app.candidate.candidateLocation ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-600">{portal}</td>
                      <td className="px-4 py-3">
                        <ApplicationStageControl
                          applicationId={app.id}
                          currentStageId={app.pipelineStageId}
                          stages={stageSelectOptions}
                          returnPath="/hiring/applications"
                          compact
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/hiring/applications/${app.id}`}
                          className="text-xs font-semibold text-sky-700 hover:underline whitespace-nowrap"
                        >
                          Open application →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
