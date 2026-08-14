import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCandidateSession } from "@/lib/candidate-session";
import { firstSearchParam } from "@/lib/search-param";
import { formatHiringJobLocation } from "@/lib/hiring-application-display";
import { formatDate } from "@/lib/utils";
import { CareersChrome } from "../../_components/careers-chrome";
import { ApplicationsLiveRefresh } from "../../_components/applications-live-refresh";
import { withdrawApplication } from "../../actions";
import { Button } from "@/components/ui/button";
import { assessmentEligible } from "@/lib/hiring-assessment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My applications · Skillinabox",
};

type Props = {
  searchParams: Promise<{
    error?: string | string[];
    applied?: string | string[];
    already?: string | string[];
    withdrawn?: string | string[];
  }>;
};

export default async function CareersApplicationsPage(props: Props) {
  const me = await requireCandidateSession({ callbackUrl: "/careers/portal/applications" });
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  const applied = firstSearchParam(searchParams.applied) === "1";
  const already = firstSearchParam(searchParams.already) === "1";
  const withdrawn = firstSearchParam(searchParams.withdrawn) === "1";

  const applications = await prisma.hiringApplication.findMany({
    where: { candidateId: me.candidateId },
    orderBy: { appliedAt: "desc" },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          location: true,
          workArrangement: true,
          department: { select: { name: true, emoji: true } },
        },
      },
      pipelineStage: { select: { id: true, key: true, label: true, isHired: true, isRejected: true } },
      assessment: { select: { id: true } },
    },
  });

  return (
    <CareersChrome active="applications">
      <ApplicationsLiveRefresh />
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">My applications</h1>
            <p className="text-sm text-ink-500 mt-1">
              Status updates when our hiring team moves your application.{" "}
              <Link href="/careers/jobs" className="text-sky-800 underline">
                Browse open roles
              </Link>
            </p>
          </div>
          <Link href="/careers/portal/profile">
            <Button variant="outline" size="sm">
              Edit profile
            </Button>
          </Link>
        </div>

        {applied ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Application submitted — next, complete a short personality and role assessment.
          </div>
        ) : null}
        {already ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            You already applied to that role.
          </div>
        ) : null}
        {withdrawn ? (
          <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-700">
            Application withdrawn.
          </div>
        ) : null}
        {flashError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {decodeURIComponent(flashError)}
          </div>
        ) : null}

        {applications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-10 text-center text-sm text-ink-500">
            No applications yet.{" "}
            <Link href="/careers/jobs" className="font-semibold text-sky-800 hover:underline">
              Explore open roles
            </Link>
            .
          </div>
        ) : (
          <ul className="space-y-4">
            {applications.map((app) => {
              const loc = formatHiringJobLocation(app.job);
              const canWithdraw =
                app.pipelineStage.key !== "WITHDRAWN" &&
                !app.pipelineStage.isHired &&
                app.pipelineStage.key !== "REJECTED";
              const withdraw = withdrawApplication.bind(null, app.id);
              const needsAssessment = !app.assessment && assessmentEligible(app.pipelineStage);

              return (
                <li
                  key={app.id}
                  className="rounded-2xl border border-ink-100 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <h2 className="text-lg font-semibold text-ink-900">{app.job.title}</h2>
                      <div className="text-sm text-ink-500 flex flex-wrap gap-x-2">
                        {app.job.department && (
                          <span>
                            {app.job.department.emoji} {app.job.department.name}
                          </span>
                        )}
                        {app.job.department && loc !== "—" && <span aria-hidden>·</span>}
                        {loc !== "—" && <span>{loc}</span>}
                      </div>
                      <p className="text-xs text-ink-400">Applied {formatDate(app.appliedAt)}</p>
                    </div>
                    <div className="shrink-0 space-y-2 text-right">
                      <div
                        className={
                          app.pipelineStage.isRejected || app.pipelineStage.key === "WITHDRAWN"
                            ? "inline-flex rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-700"
                            : app.pipelineStage.isHired
                              ? "inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                              : "inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900"
                        }
                      >
                        {app.pipelineStage.label}
                      </div>
                      {needsAssessment ? (
                        <Link href={`/careers/portal/applications/${app.id}/assessment`} className="block">
                          <Button variant="accent" size="sm" className="w-full">
                            Take assessment
                          </Button>
                        </Link>
                      ) : app.assessment ? (
                        <Link
                          href={`/careers/portal/applications/${app.id}/assessment`}
                          className="block text-xs font-medium text-sky-800 hover:underline"
                        >
                          View assessment
                        </Link>
                      ) : null}
                      {canWithdraw ? (
                        <form action={withdraw}>
                          <button
                            type="submit"
                            className="block w-full text-xs font-medium text-ink-500 hover:text-red-700 underline underline-offset-2"
                          >
                            Withdraw
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CareersChrome>
  );
}
