import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { RecruitmentHero } from "./_components/recruitment-hero";
import { RecruitmentKpis } from "./_components/recruitment-kpis";
import { RecruitmentSidebar } from "./_components/recruitment-sidebar";
import { RecruitmentFunnel } from "./_components/recruitment-funnel";
import { RecruitmentMetricStrip } from "./_components/recruitment-metric-strip";
import {
  FUNNEL_BAR_SLUG_ORDER,
  getRecruitmentFunnelStages,
  pickStagesBySlugOrder,
  STRIP_SLUG_ORDER,
} from "@/lib/recruitment-funnel";
import { getRecruitmentDailyReportSuggestions, utcCalendarToday } from "@/lib/recruitment-daily-report";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Lightbulb, Sparkles } from "lucide-react";
import { DailyReportForm } from "./_components/daily-report-form";

const HR_ROLES = ["CEO", "ADMIN", "HR"];

type RecruitmentOverviewSearchParams = {
  funnelSaved?: string;
  metricsForbidden?: string;
  dailyReportSaved?: string;
  dailyReportError?: string;
};

export default async function RecruitmentOverviewPage(props: {
  searchParams: Promise<RecruitmentOverviewSearchParams>;
}) {
  const sp = await props.searchParams;
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <RecruitmentOverviewBody searchParams={sp} />
    </Suspense>
  );
}

async function RecruitmentOverviewBody({ searchParams }: { searchParams: RecruitmentOverviewSearchParams }) {
  const {
    funnelSaved,
    metricsForbidden,
    dailyReportSaved,
    dailyReportError,
  } = searchParams;
  const me = await requireAppViewer();
  if (!me || !HR_ROLES.includes(me.role)) redirect("/home");

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [recentJoinCount, activeHeadcount, recentJoiners, funnelStagesRaw, dailySuggestions] =
    await Promise.all([
    prisma.user.count({
      where: {
        joinedAt: { gte: since },
        status: { not: "EXITED" },
      },
    }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.findMany({
      where: { status: { not: "EXITED" } },
      orderBy: { joinedAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        image: true,
        email: true,
        joinedAt: true,
        department: { select: { name: true, emoji: true } },
      },
    }),
    getRecruitmentFunnelStages(),
    getRecruitmentDailyReportSuggestions(),
  ]);

  const headlineTotalCount = funnelStagesRaw.find((s) => s.slug === "total")?.count ?? 0;
  const metricStripStages = pickStagesBySlugOrder(funnelStagesRaw, STRIP_SLUG_ORDER);
  const funnelBarStages = pickStagesBySlugOrder(funnelStagesRaw, FUNNEL_BAR_SLUG_ORDER);

  /** Only Workspace Admin + CEO mutate headline funnel data */
  const canEditRecruitmentRollups = me.role === "CEO" || me.role === "ADMIN";

  const firstName = me.name?.split(/\s+/)[0] || "there";

  return (
    <div className="space-y-8 md:space-y-10 pb-4">
      <RecruitmentHero
        firstName={firstName}
        recentJoins={recentJoinCount}
        activeHeadcount={activeHeadcount}
      />

      <RecruitmentKpis recentJoins={recentJoinCount} activeHeadcount={activeHeadcount} />

      {dailyReportSaved === "1" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Daily report saved — recruiter and location appear in dropdown suggestions next time.
        </div>
      )}

      {dailyReportError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {dailyReportError}
        </div>
      )}

      <section id="daily-report" className="scroll-mt-24">
        <DailyReportForm
          recruiterOptions={dailySuggestions.recruiters}
          locationOptions={dailySuggestions.locations}
          defaultReportDate={utcCalendarToday()}
        />
      </section>

      {funnelSaved === "1" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Recruitment rollups saved — headline strip and funnel below refresh for the whole workspace.
        </div>
      )}

      {metricsForbidden === "1" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Only Workspace Admin or CEO can change headline metrics and funnel numbers.
        </div>
      )}

      <section className="grid lg:grid-cols-12 gap-6 md:gap-8 items-start">
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <RecruitmentMetricStrip stages={metricStripStages} canEdit={canEditRecruitmentRollups} />
          <RecruitmentFunnel
            barStages={funnelBarStages}
            headlineTotalCount={headlineTotalCount}
            canEdit={canEditRecruitmentRollups}
          />

          <div className="relative rounded-2xl overflow-hidden border border-ink-200/80 bg-ink-50/40 p-px">
            <div className="rounded-[15px] bg-gradient-to-br from-sky-50/90 via-white to-orange-50/60 px-5 py-5 md:px-6 md:py-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-ink-100 text-orange-600">
                  <Lightbulb className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-sky-600">Product note</span>
                    <Sparkles className="size-4 text-orange-500" aria-hidden />
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-ink-700 tracking-tight">What wires in next</h3>
                  <p className="mt-2 text-sm text-ink-500 leading-relaxed max-w-2xl">
                    Headcount approvals, sourcing links, panel scheduling on this workspace, and offer letters —
                    kept in one place instead of scattered bolt-on tracking tools.
                  </p>
                  <Link
                    href="/admin"
                    className={cn(
                      "inline-flex mt-4 text-sm font-semibold text-sky-700 hover:text-sky-800",
                      "underline-offset-4 hover:underline",
                    )}
                  >
                    Shape org data in Manage Team →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 lg:self-start">
          <RecruitmentSidebar recent={recentJoiners} />
        </div>
      </section>
    </div>
  );
}
