import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { relativeTime } from "@/lib/utils";
import { submitDeptFeedback } from "./actions";

const TYPE_TONE: Record<string, "sky" | "orange" | "sun"> = {
  KUDOS: "sky",
  CONSTRUCTIVE: "orange",
  REQUEST: "sun",
};

const TYPE_LABEL: Record<string, string> = {
  KUDOS: "🙌 Kudos",
  CONSTRUCTIVE: "💬 Constructive",
  REQUEST: "📬 Request",
};

export default async function DeptFeedbackPage() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me) return null;

  const [departments, publicFeedback, toMyDept] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.deptFeedback.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        fromUser: { select: { name: true, image: true, department: { select: { name: true } } } },
        toDepartment: { select: { name: true, emoji: true } },
      },
    }),
    me.departmentId
      ? prisma.deptFeedback.findMany({
          where: { toDepartmentId: me.departmentId },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            fromUser: { select: { name: true, image: true } },
            toDepartment: { select: { name: true, emoji: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Department Feedback"
        emoji="🤝"
        subtitle="Send kudos, constructive notes, or requests to other departments. Public by default — build the team together."
      />

      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-1 order-2 md:order-1">
          <Card className="sticky top-20">
            <CardContent className="pt-5">
              <h3 className="font-semibold text-ink-700 mb-3">Send feedback</h3>
              <form action={submitDeptFeedback} className="space-y-3">
                <div>
                  <Label htmlFor="toDepartmentId">To department</Label>
                  <Select id="toDepartmentId" name="toDepartmentId" required>
                    <option value="">Choose…</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select id="type" name="type" defaultValue="KUDOS">
                    <option value="KUDOS">🙌 Kudos</option>
                    <option value="CONSTRUCTIVE">💬 Constructive</option>
                    <option value="REQUEST">📬 Request</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" name="subject" required />
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" name="message" required rows={4} />
                </div>
                <label className="flex items-center gap-2 text-sm text-ink-600">
                  <input type="checkbox" name="isPublic" defaultChecked />
                  Share on public feedback wall
                </label>
                <Button type="submit" className="w-full">Send</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 order-1 md:order-2 space-y-5">
          {me.departmentId && (
            <div>
              <h2 className="text-sm font-semibold text-ink-600 mb-3">📥 For my department</h2>
              {toMyDept.length === 0 ? (
                <EmptyState emoji="📭" title="Nothing yet" description="Feedback for your department will appear here." />
              ) : (
                <div className="space-y-3">
                  {toMyDept.map((f) => <FeedbackRow key={f.id} f={f} />)}
                </div>
              )}
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-ink-600 mb-3">🌍 Public wall</h2>
            {publicFeedback.length === 0 ? (
              <EmptyState emoji="🤝" title="No public feedback yet" description="Be the first to appreciate another team." />
            ) : (
              <div className="space-y-3">
                {publicFeedback.map((f) => <FeedbackRow key={f.id} f={f} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedbackRow({ f }: { f: any }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex gap-3">
          <Avatar src={f.fromUser.image} name={f.fromUser.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-semibold text-ink-700">{f.fromUser.name}</span>
              <span className="text-ink-400 text-xs">→</span>
              <Badge tone="sky">{f.toDepartment.emoji} {f.toDepartment.name}</Badge>
              <Badge tone={TYPE_TONE[f.type]}>{TYPE_LABEL[f.type]}</Badge>
              <span className="text-xs text-ink-400 ml-auto">{relativeTime(f.createdAt)}</span>
            </div>
            <div className="mt-1.5 font-semibold text-ink-700">{f.subject}</div>
            <p className="text-sm text-ink-500 mt-1 whitespace-pre-wrap">{f.message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
