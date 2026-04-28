import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { weekStartDate } from "@/lib/utils";
import { CalendarClock, HeartPulse, Target, GraduationCap } from "lucide-react";

type Props = { userId: string };

export async function QuickStats({ userId }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [attendance, pulse, activeOkrs, myTrainings] = await Promise.all([
    prisma.attendance.findFirst({ where: { userId, date: today } }),
    prisma.pulseResponse.findFirst({ where: { userId, weekStart: weekStartDate() } }),
    prisma.oKR.count({ where: { userId, status: { in: ["ON_TRACK", "AT_RISK", "OFF_TRACK"] } } }),
    prisma.trainingEnrollment.count({ where: { userId, status: "IN_PROGRESS" } }),
  ]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        href="/attendance"
        icon={<CalendarClock className="size-5" />}
        label="Today"
        value={attendance?.checkIn ? "Checked in ✅" : "Not marked"}
        tone="sky"
      />
      <StatCard
        href="/pulse"
        icon={<HeartPulse className="size-5" />}
        label="Pulse"
        value={pulse ? `You: ${pulse.score}/5` : "Share pulse"}
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
  );
}

function StatCard({
  href,
  icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "sky" | "orange" | "sun" | "ink";
}) {
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
