import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { toggleOnboardingTask } from "./actions";

const DEFAULT_TASKS = [
  { dueDay: 30, title: "Meet 10 teammates outside your team", category: "People" },
  { dueDay: 30, title: "Shadow 1 LIVE class + 1 counselor call", category: "Product" },
  { dueDay: 30, title: "Ship your first piece of work", category: "Work" },
  { dueDay: 30, title: "Sign offer letter & complete KYC", category: "Setup" },
  { dueDay: 60, title: "Lead a small project end-to-end", category: "Work" },
  { dueDay: 60, title: "Give feedback on your onboarding experience", category: "Growth" },
  { dueDay: 90, title: "Set Q1 OKRs with your manager", category: "Growth" },
  { dueDay: 90, title: "Present your learnings to the team", category: "People" },
  { dueDay: 90, title: "Claim full ownership of your scope", category: "Work" },
];

export default async function OnboardingPage() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me) return null;

  let tasks = await prisma.onboardingTask.findMany({
    where: { userId: me.id },
    orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }],
  });

  // If the user has none, seed the default plan for them
  if (tasks.length === 0) {
    await prisma.onboardingTask.createMany({
      data: DEFAULT_TASKS.map((t) => ({ ...t, userId: me.id })),
    });
    tasks = await prisma.onboardingTask.findMany({
      where: { userId: me.id },
      orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }],
    });
  }

  const byDay: Record<number, typeof tasks> = { 30: [], 60: [], 90: [] };
  for (const t of tasks) (byDay[t.dueDay] ||= []).push(t);

  const completedCount = tasks.filter((t) => t.completed).length;
  const pct = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  const daysIn = Math.floor((Date.now() - me.joinedAt.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div>
      <PageHeader
        title="Onboarding Buddy"
        emoji="🌱"
        subtitle={`Your first 30 · 60 · 90 days at Skillinabox. Day ${daysIn} and counting.`}
      />

      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-ink-400">Progress</div>
              <div className="text-2xl font-bold text-ink-700">{pct}%</div>
            </div>
            <div className="text-sm text-ink-500">{completedCount} of {tasks.length} done</div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-ink-100 overflow-hidden">
            <div className="h-full brand-gradient" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>

      {[30, 60, 90].map((day) => (
        <section key={day} className="mb-6">
          <h2 className="text-sm font-semibold text-ink-600 mb-3">🎯 Day {day}</h2>
          {byDay[day]?.length === 0 ? (
            <EmptyState emoji="✨" title="All clear" />
          ) : (
            <div className="space-y-2">
              {byDay[day].map((t) => (
                <Card key={t.id}>
                  <CardContent className="py-3">
                    <form action={async () => { "use server"; await toggleOnboardingTask(t.id); }} className="flex items-center gap-3">
                      <button
                        type="submit"
                        aria-label="Toggle"
                        className={`size-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                          t.completed
                            ? "bg-sky-500 border-sky-500 text-white"
                            : "border-ink-200 hover:border-sky-500"
                        }`}
                      >
                        {t.completed && "✓"}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${t.completed ? "line-through text-ink-400" : "text-ink-700"}`}>
                          {t.title}
                        </div>
                        {t.category && <Badge tone="ink" className="mt-1">{t.category}</Badge>}
                      </div>
                      {t.completed && t.completedAt && (
                        <span className="text-xs text-ink-400">✓ {formatDate(t.completedAt)}</span>
                      )}
                    </form>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
