import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import { displayName } from "@/lib/user-display-name";
import {
  daysUntil,
  nextOccurrence,
  startOfDay,
  workAnniversaryYears,
} from "@/lib/celebrations";
import { Cake } from "lucide-react";

const HOME_HORIZON_DAYS = 14;
const HOME_LIMIT = 5;

export async function UpcomingCelebrations() {
  const today = startOfDay();

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      image: true,
      birthday: true,
      joinedAt: true,
    },
  });

  type Row = {
    userId: string;
    name: string;
    image: string | null;
    next: Date;
    label: string;
  };

  const rows: Row[] = [];

  for (const u of users) {
    const name = displayName(u);
    if (u.birthday) {
      const next = nextOccurrence(u.birthday, today);
      const until = daysUntil(next, today);
      if (until < HOME_HORIZON_DAYS) {
        rows.push({
          userId: u.id,
          name,
          image: u.image,
          next,
          label: until === 0 ? "🎂 Birthday today" : `🎂 ${formatDate(next, { day: "2-digit", month: "short" })}`,
        });
      }
    }

    const annivNext = nextOccurrence(u.joinedAt, today);
    const years = workAnniversaryYears(u.joinedAt, annivNext);
    const until = daysUntil(annivNext, today);
    if (years > 0 && until < HOME_HORIZON_DAYS) {
      rows.push({
        userId: u.id,
        name,
        image: u.image,
        next: annivNext,
        label:
          until === 0
            ? `🎉 ${years}y at SIB today`
            : `🎉 ${years}y · ${formatDate(annivNext, { day: "2-digit", month: "short" })}`,
      });
    }
  }

  const upcoming = rows
    .sort((a, b) => a.next.getTime() - b.next.getTime() || a.name.localeCompare(b.name))
    .slice(0, HOME_LIMIT);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cake className="size-4 text-sun-600" /> Coming up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcoming.length === 0 && (
          <p className="text-sm text-ink-400">Nothing in the next {HOME_HORIZON_DAYS} days.</p>
        )}
        {upcoming.map((row) => (
          <Link
            key={`${row.userId}-${row.label}`}
            href={`/people/${row.userId}`}
            className="flex items-center gap-3 rounded-lg hover:bg-ink-50/80 -mx-1 px-1 py-0.5 transition-colors"
          >
            <Avatar src={row.image} name={row.name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-700 truncate">{row.name}</div>
              <div className="text-xs text-ink-400">{row.label}</div>
            </div>
          </Link>
        ))}
        <Link href="/celebrations" className="block text-xs font-medium text-sky-600 hover:underline pt-1">
          See all celebrations →
        </Link>
      </CardContent>
    </Card>
  );
}
