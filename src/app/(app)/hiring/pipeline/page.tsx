import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { HIRING_APPLICATION_STAGES, STAGE_LABEL } from "@/lib/hiring-copy";
import { ApplicationStageControl } from "../_components/application-stage-control";
import type { HiringApplicationStage } from "@/generated/prisma";
import { formatDate } from "@/lib/utils";
import { firstSearchParam } from "@/lib/search-param";

type Props = {
  searchParams: Promise<{ error?: string | string[]; moved?: string | string[] }>;
};

export default async function HiringPipelinePage(props: Props) {
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  const flashMoved = firstSearchParam(searchParams.moved) === "1";

  const rows = await prisma.hiringApplication.findMany({
    orderBy: { appliedAt: "desc" },
    include: {
      candidate: true,
      job: { select: { id: true, title: true, status: true } },
    },
  });

  const byStage = new Map<HiringApplicationStage, typeof rows>();
  HIRING_APPLICATION_STAGES.forEach((s) => byStage.set(s, []));
  rows.forEach((r) => {
    const bucket = byStage.get(r.stage);
    if (bucket) bucket.push(r);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        emoji="🧭"
        subtitle="One board for every applicant — comparable to pipeline views inside Zoho Recruit."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/hiring/candidates">
              <Button variant="outline" size="md">
                Talent pool →
              </Button>
            </Link>
            <Link href="/hiring/jobs">
              <Button variant="ghost" size="md">
                Jobs
              </Button>
            </Link>
          </div>
        }
      />

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

      <div className="grid xl:grid-cols-6 gap-4 xl:gap-3 items-start pb-10">
        {HIRING_APPLICATION_STAGES.map((stage) => (
          <div key={stage} className="min-w-[200px] flex-1 rounded-2xl border border-ink-100 bg-gradient-to-b from-white to-ink-50/50 overflow-hidden shadow-sm flex flex-col max-h-[calc(100vh-12rem)]">
            <div className="sticky top-0 z-10 px-3 py-3 border-b border-ink-100 bg-white/95 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-2 gap-y-1 flex-wrap">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-600">{STAGE_LABEL[stage]}</div>
                <div className="text-[11px] font-semibold tabular-nums text-ink-400 bg-ink-100 px-2 py-0.5 rounded-full shrink-0">
                  {byStage.get(stage)?.length ?? 0}
                </div>
              </div>
            </div>
            <div className="p-2 space-y-2 overflow-y-auto flex-1 overscroll-contain">
              {(byStage.get(stage) ?? []).map((app) => (
                <article
                  key={app.id}
                  className="rounded-xl bg-white ring-1 ring-ink-100 p-3 space-y-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <div>
                    <div className="font-medium text-sm text-ink-800 leading-snug">{app.candidate.fullName}</div>
                    <div className="text-[11px] text-ink-400 truncate">{app.candidate.email}</div>
                  </div>
                  <Link
                    href={`/hiring/jobs/${app.job.id}`}
                    className="inline-flex text-[11px] font-semibold text-sky-700 hover:underline truncate max-w-full"
                  >
                    {app.job.title}
                  </Link>
                  <div className="text-[10px] text-ink-400">Applied {formatDate(app.appliedAt)}</div>
                  <ApplicationStageControl applicationId={app.id} stage={app.stage} returnPath="/hiring/pipeline" compact />
                </article>
              ))}
              {(byStage.get(stage) ?? []).length === 0 ? (
                <p className="text-[11px] text-center text-ink-400 py-10 px-1">Nobody here yet.</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
