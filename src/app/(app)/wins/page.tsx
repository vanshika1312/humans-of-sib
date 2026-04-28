import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Label } from "@/components/ui/input";
import { relativeTime } from "@/lib/utils";
import { createWin, toggleClap } from "./actions";

export default async function WinsPage() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me) return null;

  const wins = await prisma.win.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { include: { department: true } },
      claps: { where: { userId: me.id }, select: { id: true } },
      _count: { select: { claps: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Wins Wall"
        emoji="🏆"
        subtitle="Share a win, clap for teammates, remember the good stuff."
      />

      <Card className="mb-6">
        <CardContent className="pt-5">
          <form action={createWin} className="space-y-3">
            <div>
              <Label htmlFor="title">What&apos;s the win?</Label>
              <Input id="title" name="title" required placeholder="Shipped my first campaign · Closed a 2L deal · Learner got a job…" />
            </div>
            <div>
              <Label htmlFor="description">Tell us more (optional)</Label>
              <Textarea id="description" name="description" rows={3} placeholder="Share the story behind it." />
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input id="tags" name="tags" placeholder="campaign, learner-love, teamwork" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="accent">Share win 🎉</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {wins.length === 0 ? (
        <EmptyState emoji="🏆" title="No wins yet" description="Be the first to share one!" />
      ) : (
        <div className="space-y-4">
          {wins.map((w) => {
            const clapped = w.claps.length > 0;
            return (
              <Card key={w.id}>
                <CardContent className="pt-5">
                  <div className="flex gap-3">
                    <Avatar src={w.user.image} name={w.user.name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 text-sm">
                        <span className="font-semibold text-ink-700">{w.user.name}</span>
                        {w.user.department && <Badge tone="sky">{w.user.department.name}</Badge>}
                        <span className="text-xs text-ink-400 ml-auto">{relativeTime(w.createdAt)}</span>
                      </div>
                      <div className="mt-1.5 font-semibold text-ink-700">{w.title}</div>
                      {w.description && <p className="mt-1 text-sm text-ink-500 whitespace-pre-wrap">{w.description}</p>}
                      {w.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {w.tags.map((t) => (
                            <Badge key={t} tone="orange">#{t}</Badge>
                          ))}
                        </div>
                      )}
                      <form action={async () => { "use server"; await toggleClap(w.id); }} className="mt-3">
                        <button
                          type="submit"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            clapped
                              ? "bg-orange-100 text-orange-700"
                              : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                          }`}
                        >
                          👏 {w._count.claps} {clapped ? "clapped" : "clap"}
                        </button>
                      </form>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
