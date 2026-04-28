import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { addJourneyEvent } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  JOINED: "Joined SIB",
  MILESTONE: "Milestone",
  PROMOTION: "Promotion",
  AWARD: "Award",
  WIN: "Win",
  FEEDBACK_RECEIVED: "Feedback received",
  TRAINING_COMPLETED: "Training completed",
  ANNIVERSARY: "Work anniversary",
  CUSTOM: "Moment",
};

const TYPE_EMOJI: Record<string, string> = {
  JOINED: "🌱",
  MILESTONE: "🎯",
  PROMOTION: "🚀",
  AWARD: "🏅",
  WIN: "🏆",
  FEEDBACK_RECEIVED: "💌",
  TRAINING_COMPLETED: "🎓",
  ANNIVERSARY: "🎂",
  CUSTOM: "✨",
};

export default async function JourneyPage() {
  const session = await auth();
  const me = await prisma.user.findUnique({
    where: { email: session!.user!.email! },
    include: { department: true, city: true },
  });
  if (!me) return null;

  const events = await prisma.journeyEvent.findMany({
    where: { userId: me.id },
    orderBy: { occurredAt: "desc" },
  });

  const tenureDays = Math.floor((Date.now() - me.joinedAt.getTime()) / (1000 * 60 * 60 * 24));

  const stats = {
    events: events.length,
    wins: events.filter((e) => e.type === "WIN").length,
    milestones: events.filter((e) => e.type === "MILESTONE" || e.type === "PROMOTION" || e.type === "AWARD").length,
    trainings: events.filter((e) => e.type === "TRAINING_COMPLETED").length,
  };

  return (
    <div>
      <PageHeader
        title="My Journey"
        subtitle="Your story at Skillinabox — every milestone, win, and moment worth remembering."
        emoji="🧭"
      />

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-xs text-ink-400">At SIB since</div>
          <div className="text-lg font-semibold text-ink-700 mt-1">{formatDate(me.joinedAt)}</div>
          <div className="text-xs text-ink-400">{tenureDays} days</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-ink-400">Moments</div>
          <div className="text-2xl font-bold text-sky-600">{stats.events}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-ink-400">Wins</div>
          <div className="text-2xl font-bold text-orange-500">{stats.wins}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-ink-400">Milestones</div>
          <div className="text-2xl font-bold text-sun-600">{stats.milestones}</div>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2">
          {events.length === 0 ? (
            <EmptyState
              emoji="🧭"
              title="Your journey starts here"
              description="Log a milestone, a win, or any moment you want to remember."
            />
          ) : (
            <ol className="relative border-l-2 border-ink-100 ml-4 space-y-5">
              {events.map((e) => (
                <li key={e.id} className="ml-6 relative">
                  <span className="absolute -left-[34px] top-0.5 size-6 rounded-full bg-white border-2 border-sky-500 flex items-center justify-center text-xs">
                    {e.emoji || TYPE_EMOJI[e.type] || "✨"}
                  </span>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Badge tone="sky">{TYPE_LABEL[e.type]}</Badge>
                        <span className="text-xs text-ink-400 ml-auto">{formatDate(e.occurredAt)}</span>
                      </div>
                      <div className="mt-2 font-semibold text-ink-700">{e.title}</div>
                      {e.description && <p className="text-sm text-ink-500 mt-1">{e.description}</p>}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <Card className="p-5 sticky top-20">
            <div className="font-semibold text-ink-700">Add a moment</div>
            <p className="text-xs text-ink-400 mt-1">Log anything worth remembering.</p>
            <form action={addJourneyEvent} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select id="type" name="type" defaultValue="MILESTONE">
                  <option value="MILESTONE">🎯 Milestone</option>
                  <option value="WIN">🏆 Win</option>
                  <option value="PROMOTION">🚀 Promotion</option>
                  <option value="AWARD">🏅 Award</option>
                  <option value="TRAINING_COMPLETED">🎓 Training</option>
                  <option value="ANNIVERSARY">🎂 Anniversary</option>
                  <option value="CUSTOM">✨ Other</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required placeholder="Shipped my first launch" />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea id="description" name="description" rows={3} placeholder="What happened, how it felt..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="emoji">Emoji</Label>
                  <Input id="emoji" name="emoji" maxLength={4} placeholder="✨" />
                </div>
                <div>
                  <Label htmlFor="occurredAt">Date</Label>
                  <Input id="occurredAt" name="occurredAt" type="date" />
                </div>
              </div>
              <Button type="submit" className="w-full">Add to journey</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
