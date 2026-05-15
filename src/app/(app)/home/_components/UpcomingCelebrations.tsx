import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import { Cake } from "lucide-react";

export async function UpcomingCelebrations() {
  const allUsers = await prisma.user.findMany({
    where: { status: "ACTIVE", birthday: { not: null } },
    select: { id: true, name: true, image: true, birthday: true, department: { select: { name: true } } },
    take: 100,
  });

  const upcoming = allUsers
    .map((u) => ({ ...u, next: nextOccurrence(u.birthday!) }))
    .filter((u) => u.next.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 14)
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cake className="size-4 text-sun-600" /> Coming up
        </CardTitle>
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
  );
}

function nextOccurrence(dob: Date) {
  const today = new Date();
  const y = today.getFullYear();
  const next = new Date(y, dob.getMonth(), dob.getDate());
  if (next < today) next.setFullYear(y + 1);
  return next;
}
