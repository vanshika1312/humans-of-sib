import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { RecruitmentHero } from "./_components/recruitment-hero";
import { RecruitmentKpis } from "./_components/recruitment-kpis";
import { RecruitmentSidebar } from "./_components/recruitment-sidebar";
import { InterviewPipelineFunnel } from "./_components/interview-pipeline-funnel";
import { getInterviewPipelineStagesOrdered } from "@/lib/interview-pipeline";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Lightbulb, Sparkles } from "lucide-react";

const HR_ROLES = ["CEO", "ADMIN", "HR"];

export default async function RecruitmentOverviewPage(props: {
  searchParams: Promise<{ pipelineSaved?: string }>;
}) {
  const { pipelineSaved } = await props.searchParams;
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !HR_ROLES.includes(me.role)) redirect("/home");

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [recentJoinCount, activeHeadcount, recentJoiners, pipelineStages] = await Promise.all([
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
    getInterviewPipelineStagesOrdered(),
  ]);

  const firstName = me.name?.split(/\s+/)[0] || "there";

  return (
    <div className="space-y-8 md:space-y-10 pb-4">
      <RecruitmentHero
        firstName={firstName}
        recentJoins={recentJoinCount}
        activeHeadcount={activeHeadcount}
      />

      <RecruitmentKpis recentJoins={recentJoinCount} activeHeadcount={activeHeadcount} />

      {pipelineSaved === "1" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Funnel counts saved. Conversion rates below updated for everyone viewing recruitment.
        </div>
      )}

      <section className="grid lg:grid-cols-12 gap-6 md:gap-8 items-start">
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <InterviewPipelineFunnel stages={pipelineStages} canEdit />

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
                    Headcount approvals, sourcing links, interviewer load-balancing, and offer letters will surface in this lane so HR and hiring managers never chase spreadsheets.
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
