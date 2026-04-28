import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { enrollInTraining, markTrainingComplete } from "./actions";

export default async function TrainingsPage() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me) return null;

  const [trainings, myCerts] = await Promise.all([
    prisma.training.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      include: {
        enrollments: { where: { userId: me.id }, take: 1 },
      },
    }),
    prisma.certificate.findMany({
      where: { userId: me.id },
      include: { training: true },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Internal Trainings" emoji="🎓" subtitle="Level up. Complete to earn a SIB certificate." />

      {myCerts.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div className="brand-gradient p-5 text-white">
            <h3 className="font-semibold flex items-center gap-2">
              🏅 Your certificates <span className="text-sm opacity-80">({myCerts.length})</span>
            </h3>
          </div>
          <CardContent className="pt-4">
            <div className="grid md:grid-cols-2 gap-3">
              {myCerts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-ink-50 rounded-lg">
                  <div className="size-10 rounded-md brand-gradient flex items-center justify-center text-lg">🎓</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink-700 truncate">{c.training.title}</div>
                    <div className="text-xs text-ink-400">#{c.number} · {formatDate(c.issuedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {trainings.length === 0 ? (
        <EmptyState emoji="📚" title="No trainings yet" description="Admins will add trainings here soon." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {trainings.map((t) => {
            const enrolled = t.enrollments[0];
            const done = enrolled?.status === "COMPLETED";
            return (
              <Card key={t.id} className="overflow-hidden">
                <div className="h-24 brand-gradient confetti relative">
                  <div className="absolute inset-0 bg-white/60" />
                  <div className="relative p-4 text-ink-700 text-sm font-medium flex items-center gap-2">
                    <Badge tone="sky">{t.type}</Badge>
                    {t.category && <Badge tone="ink">{t.category}</Badge>}
                    {t.durationMin && <Badge tone="ink">{t.durationMin} min</Badge>}
                  </div>
                </div>
                <CardContent className="pt-4">
                  <h3 className="font-semibold text-ink-700">{t.title}</h3>
                  {t.description && <p className="text-sm text-ink-500 mt-1 line-clamp-2">{t.description}</p>}

                  {done ? (
                    <Badge tone="green" className="mt-3">✅ Completed · {enrolled?.score}%</Badge>
                  ) : enrolled?.status === "IN_PROGRESS" ? (
                    <form action={async (fd) => { "use server"; await markTrainingComplete(t.id, fd); }} className="mt-3 flex items-end gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`s-${t.id}`}>Score %</Label>
                        <Input id={`s-${t.id}`} name="score" type="number" min={0} max={100} required placeholder="e.g. 85" />
                      </div>
                      <Button type="submit" size="sm">Submit &amp; earn cert</Button>
                    </form>
                  ) : (
                    <form action={async () => { "use server"; await enrollInTraining(t.id); }} className="mt-3">
                      <Button type="submit" size="sm" variant="accent">Start training →</Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
