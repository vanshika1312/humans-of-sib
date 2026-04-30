import { prisma } from "@/lib/prisma";
import { weekStartDate } from "@/lib/utils";
import { Users, CalendarCheck, HeartPulse, Trophy } from "lucide-react";

export async function OrgMetrics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [teamSize, checkedInToday, weekPulses, winsThisMonth] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.attendance.count({ where: { date: today, checkIn: { not: null } } }),
    prisma.pulseResponse.findMany({
      where: { weekStart: weekStartDate() },
      select: { score: true },
    }),
    prisma.win.count({ where: { createdAt: { gte: monthStart } } }),
  ]);

  const avgPulse =
    weekPulses.length > 0
      ? (weekPulses.reduce((s, r) => s + r.score, 0) / weekPulses.length).toFixed(1)
      : null;

  const metrics = [
    {
      icon: <Users className="size-4" />,
      label: "Team size",
      value: `${teamSize} people`,
      bg: "bg-sky-50 text-sky-600",
    },
    {
      icon: <CalendarCheck className="size-4" />,
      label: "In today",
      value: checkedInToday === 0 ? "None yet" : `${checkedInToday} of ${teamSize}`,
      bg: "bg-emerald-50 text-emerald-600",
    },
    {
      icon: <HeartPulse className="size-4" />,
      label: "Team pulse",
      value: avgPulse ? `${avgPulse} / 5` : "No data yet",
      bg: "bg-orange-50 text-orange-600",
    },
    {
      icon: <Trophy className="size-4" />,
      label: "Wins this month",
      value: `${winsThisMonth}`,
      bg: "bg-sun-50 text-sun-600",
    },
  ];

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
        Org at a glance
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="p-4 rounded-xl border border-ink-100 bg-white"
          >
            <div
              className={`size-8 rounded-md inline-flex items-center justify-center ${m.bg}`}
            >
              {m.icon}
            </div>
            <div className="mt-2 text-xs text-ink-400">{m.label}</div>
            <div className="text-sm font-semibold text-ink-700">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
