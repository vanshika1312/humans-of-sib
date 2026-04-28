import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

function nextOccurrence(from: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const y = today.getFullYear();
  const next = new Date(y, from.getMonth(), from.getDate());
  if (next < today) next.setFullYear(y + 1);
  return next;
}

export default async function BirthdaysPage() {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true, name: true, image: true, email: true,
      birthday: true, joinedAt: true,
      department: { select: { name: true, emoji: true } },
      city: { select: { name: true } },
    },
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thirtyDays = 1000 * 60 * 60 * 24 * 30;

  const birthdays = users
    .filter((u) => u.birthday)
    .map((u) => ({ u, next: nextOccurrence(u.birthday!) }))
    .sort((a, b) => a.next.getTime() - b.next.getTime());

  const anniversaries = users
    .map((u) => ({ u, next: nextOccurrence(u.joinedAt), years: today.getFullYear() - u.joinedAt.getFullYear() + (nextOccurrence(u.joinedAt) < new Date(today.getFullYear(), u.joinedAt.getMonth(), u.joinedAt.getDate()) ? 1 : 0) }))
    .sort((a, b) => a.next.getTime() - b.next.getTime());

  const soonBirthdays = birthdays.filter((b) => b.next.getTime() - today.getTime() < thirtyDays);
  const soonAnniversaries = anniversaries.filter((a) => a.next.getTime() - today.getTime() < thirtyDays && a.years > 0);

  return (
    <div>
      <PageHeader title="Celebrations" emoji="🎉" subtitle="Birthdays and work-aversaries — never miss a moment." />

      <div className="grid md:grid-cols-2 gap-5">
        <section>
          <h2 className="text-sm font-semibold text-ink-600 mb-3">🎂 Birthdays — next 30 days</h2>
          {soonBirthdays.length === 0 ? (
            <Card className="p-6 text-center text-sm text-ink-400">No birthdays in the next 30 days.</Card>
          ) : (
            <div className="space-y-3">
              {soonBirthdays.map(({ u, next }) => {
                const sameDay = next.getTime() === today.getTime();
                return (
                  <Card key={u.id} className={sameDay ? "brand-gradient confetti" : ""}>
                    <CardContent className={`pt-5 ${sameDay ? "bg-white/90 rounded-xl m-0.5" : ""}`}>
                      <div className="flex items-center gap-3">
                        <Avatar src={u.image} name={u.name} size="lg" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-ink-700">{u.name}</div>
                          <div className="text-xs text-ink-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                            {u.department && <Badge tone="sky">{u.department.emoji} {u.department.name}</Badge>}
                            {u.city && <Badge tone="ink">📍 {u.city.name}</Badge>}
                          </div>
                          <div className="mt-1 text-sm text-orange-600 font-medium">
                            🎂 {formatDate(next, { day: "2-digit", month: "long" })}
                            {sameDay && " · TODAY! 🎉"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink-600 mb-3">💼 Work-aversaries — next 30 days</h2>
          {soonAnniversaries.length === 0 ? (
            <Card className="p-6 text-center text-sm text-ink-400">No work-aversaries in the next 30 days.</Card>
          ) : (
            <div className="space-y-3">
              {soonAnniversaries.map(({ u, next, years }) => {
                const sameDay = next.getTime() === today.getTime();
                return (
                  <Card key={u.id} className={sameDay ? "brand-gradient confetti" : ""}>
                    <CardContent className={`pt-5 ${sameDay ? "bg-white/90 rounded-xl m-0.5" : ""}`}>
                      <div className="flex items-center gap-3">
                        <Avatar src={u.image} name={u.name} size="lg" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-ink-700">{u.name}</div>
                          <div className="text-xs text-ink-400">Joined {formatDate(u.joinedAt)}</div>
                          <div className="mt-1 text-sm text-sky-600 font-medium">
                            🎉 {years} {years === 1 ? "year" : "years"} on {formatDate(next, { day: "2-digit", month: "long" })}
                            {sameDay && " · TODAY!"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
