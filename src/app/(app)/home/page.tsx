import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate, relativeTime, weekStartDate } from "@/lib/utils";
import { Trophy, Megaphone, CalendarClock, HeartPulse, Target, Cake, Sparkles, GraduationCap } from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  const me = await prisma.user.findUnique({
    where: { email: session!.user!.email! },
    include: { department: true },
  });
  if (!me) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [recentWins, todayAttendance, weeklyPulse, upcomingBirthdays, activeOkrs, myTrainings, unreadCeoCount, myEventsCount] =
    await Promise.all([
      prisma.win.findMany({
        take: 4,
        orderBy: { createdAt: "desc" },
        include: { user: { include: { department: true } }, _count: { select: { claps: true } } },
      }),
      prisma.attendance.findFirst({ where: { userId: me.id, date: today } }),
      prisma.pulseResponse.findFirst({ where: { userId: me.id, weekStart: weekStartDate() } }),
      prisma.user.findMany({
        where: {
          status: "ACTIVE",
          birthday: { not: null },
        },
        select: { id: true, name: true, image: true, birthday: true, department: { select: { name: true } } },
        take: 100,
      }),
      prisma.oKR.count({ where: { userId: me.id, status: { in: ["ON_TRACK", "AT_RISK", "OFF_TRACK"] } } }),
      prisma.trainingEnrollment.count({ where: { userId: me.id, status: "IN_PROGRESS" } }),
      me.role === "CEO" ? prisma.cEOFeedback.count({ where: { status: "NEW" } }) : 0,
      prisma.journeyEvent.count({ where: { userId: me.id } }),
    ]);

  const upcoming = upcomingBirthdays
    .map((u) => ({ ...u, next: nextOccurrence(u.birthday!) }))
    .filter((u) => u.next.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 14)
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-2xl brand-gradient p-6 md:p-8 text-white">
        <div className="absolute inset-0 confetti opacity-30" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="text-sm opacity-90">{formatDate(new Date(), { weekday: "long" })}</div>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">
              {greeting()}, {me.name?.split(" ")[0] || "human"} 👋
            </h1>
            <p className="mt-2 text-sm md:text-base text-white/90 max-w-lg">
              You&apos;ve had {myEventsCount} moment{myEventsCount === 1 ? "" : "s"} in your SIB journey so far. Make today one to RISHAV remember.
            </p>
          </div>
          <Avatar src={me.image} name={me.name} size="lg" className="ring-4" />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          href="/attendance"
          icon={<CalendarClock className="size-5" />}
          label="Today"
          value={todayAttendance?.checkIn ? "Checked in ✅" : "Not marked"}
          tone="sky"
        />
        <StatCard
          href="/pulse"
          icon={<HeartPulse className="size-5" />}
          label="Pulse"
          value={weeklyPulse ? `You: ${weeklyPulse.score}/5` : "Share pulse"}
          tone="orange"
        />
        <StatCard
          href="/okrs"
          icon={<Target className="size-5" />}
          label="Active OKRs"
          value={`${activeOkrs}`}
          tone="sun"
        />
        <StatCard
          href="/trainings"
          icon={<GraduationCap className="size-5" />}
          label="Trainings"
          value={`${myTrainings} in progress`}
          tone="ink"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-5">
          {/* Wins wall */}
          <Card>
            <CardHeader className="flex items-start justify-between flex-row">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="size-4 text-orange-500" /> Wins Wall
                </CardTitle>
                <CardDescription>Latest wins from the team</CardDescription>
              </div>
              <Link href="/wins" className="text-xs font-medium text-sky-600 hover:underline">
                See all →
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentWins.length === 0 && (
                <p className="text-sm text-ink-400">
                  No wins yet. Be the first to <Link href="/wins" className="text-sky-600 hover:underline">share one</Link>.
                </p>
              )}
              {recentWins.map((w) => (
                <div key={w.id} className="flex gap-3 p-3 rounded-lg bg-ink-50/50">
                  <Avatar src={w.user.image} name={w.user.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-ink-700">{w.user.name}</span>
                      {w.user.department && (
                        <Badge tone="sky">{w.user.department.name}</Badge>
                      )}
                      <span className="text-xs text-ink-400 ml-auto">{relativeTime(w.createdAt)}</span>
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-ink-700">{w.title}</div>
                    {w.description && <p className="text-sm text-ink-500 mt-0.5 line-clamp-2">{w.description}</p>}
                    <div className="mt-1.5 text-xs text-ink-400">👏 {w._count.claps}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Direct to CEO card */}
          <Card className="overflow-hidden">
            <div className="p-5 md:p-6 flex items-center gap-4 bg-gradient-to-r from-orange-50 to-sun-50">
              <div className="relative shrink-0">
                <div className="size-14 rounded-full overflow-hidden ring-2 ring-white shadow-md">
                  <Image
                    src="/ritvik.jpeg"
                    alt="Ritvik"
                    width={56}
                    height={56}
                    className="object-cover object-top size-full"
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 text-base">📣</span>
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-orange-500 mb-0.5">Ritvik · CPO</div>
                <div className="font-semibold text-ink-700">Got something on your mind?</div>
                <p className="text-sm text-ink-500 mt-0.5">
                  Send an idea, concern, or kudos straight to the CEO — anonymously if you want.
                </p>
              </div>
              <Link
                href="/feedback/ceo/new"
                className="hidden sm:inline-flex h-10 px-4 rounded-md bg-orange-500 text-white font-medium items-center hover:bg-orange-600"
              >
                Message the CEO
              </Link>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Birthdays */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cake className="size-4 text-sun-600" /> Coming up
              </CardTitle>
              <CardDescription>Birthdays &amp; work-aversaries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 && <p className="text-sm text-ink-400">Nothing in the next 2 weeks.</p>}
              {upcoming.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <Avatar src={u.image} name={u.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-700 truncate">{u.name}</div>
                    <div className="text-xs text-ink-400">🎂 {formatDate(u.next, { day: "2-digit", month: "short" })}</div>
                  </div>
                </div>
              ))}
              <Link href="/birthdays" className="block text-xs font-medium text-sky-600 hover:underline pt-1">
                See calendar →
              </Link>
            </CardContent>
          </Card>

          {me.role === "CEO" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="size-4 text-orange-500" /> CEO Inbox
                </CardTitle>
                <CardDescription>Messages from the team</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-ink-700">{unreadCeoCount}</div>
                <div className="text-xs text-ink-400">new messages</div>
                <Link href="/feedback/ceo/inbox" className="mt-3 inline-block text-xs font-medium text-sky-600 hover:underline">
                  Open inbox →
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Quick actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-sky-500" /> Quick actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <QuickAction href="/attendance" label="Check in" emoji="🟢" />
              <QuickAction href="/wins/new" label="Share a win" emoji="🏆" />
              <QuickAction href="/pulse" label="Pulse check" emoji="💗" />
              <QuickAction href="/journey" label="My journey" emoji="🧭" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

function nextOccurrence(dob: Date) {
  const today = new Date();
  const y = today.getFullYear();
  const next = new Date(y, dob.getMonth(), dob.getDate());
  if (next < today) next.setFullYear(y + 1);
  return next;
}

function StatCard({ href, icon, label, value, tone }: { href: string; icon: React.ReactNode; label: string; value: string; tone: "sky" | "orange" | "sun" | "ink" }) {
  const toneClass = {
    sky: "text-sky-600 bg-sky-50",
    orange: "text-orange-600 bg-orange-50",
    sun: "text-sun-600 bg-sun-50",
    ink: "text-ink-600 bg-ink-100",
  }[tone];
  return (
    <Link href={href} className="block p-4 rounded-xl border border-ink-100 bg-white hover:border-sky-200 transition-colors">
      <div className={`size-8 rounded-md inline-flex items-center justify-center ${toneClass}`}>{icon}</div>
      <div className="mt-2 text-xs text-ink-400">{label}</div>
      <div className="text-sm font-semibold text-ink-700">{value}</div>
    </Link>
  );
}

function QuickAction({ href, label, emoji }: { href: string; label: string; emoji: string }) {
  return (
    <Link
      href={href}
      className="p-3 rounded-lg bg-ink-50 hover:bg-ink-100 flex items-center gap-2 text-sm font-medium text-ink-600 transition-colors"
    >
      <span>{emoji}</span>
      {label}
    </Link>
  );
}
