import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea, Select, Label } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { relativeTime } from "@/lib/utils";
import { respondCeoFeedback } from "../actions";

export default async function CeoInboxPage() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !["CEO", "ADMIN"].includes(me.role)) redirect("/home");

  const all = await prisma.cEOFeedback.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { user: { select: { name: true, image: true, department: { select: { name: true } } } } },
    take: 200,
  });

  const stats = {
    total: all.length,
    new: all.filter((f) => f.status === "NEW").length,
    resolved: all.filter((f) => f.status === "RESOLVED").length,
  };

  return (
    <div>
      <PageHeader title="CEO Inbox" emoji="📬" subtitle="Every message sent to you by the team." />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4"><div className="text-xs text-ink-400">Total</div><div className="text-2xl font-bold text-ink-700">{stats.total}</div></Card>
        <Card className="p-4"><div className="text-xs text-ink-400">New</div><div className="text-2xl font-bold text-orange-500">{stats.new}</div></Card>
        <Card className="p-4"><div className="text-xs text-ink-400">Resolved</div><div className="text-2xl font-bold text-emerald-600">{stats.resolved}</div></Card>
      </div>

      <div className="space-y-4">
        {all.map((f) => (
          <Card key={f.id}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                {f.anonymous ? (
                  <div className="size-10 rounded-full bg-ink-100 flex items-center justify-center text-lg">🕶️</div>
                ) : (
                  <Avatar src={f.user?.image} name={f.user?.name} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink-700">
                      {f.anonymous ? "Anonymous" : f.user?.name}
                    </span>
                    {!f.anonymous && f.user?.department && <Badge tone="sky">{f.user.department.name}</Badge>}
                    <Badge tone="orange">{f.category}</Badge>
                    <Badge tone={f.status === "RESOLVED" ? "green" : f.status === "NEW" ? "orange" : "sky"}>
                      {f.status.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-ink-400 ml-auto">{relativeTime(f.createdAt)}</span>
                  </div>
                  <div className="mt-2 font-semibold text-ink-700">{f.subject}</div>
                  <p className="text-sm text-ink-500 mt-1 whitespace-pre-wrap">{f.message}</p>

                  <form
                    action={async (fd) => { "use server"; await respondCeoFeedback(f.id, fd); }}
                    className="mt-4 p-3 bg-ink-50 rounded-lg space-y-3"
                  >
                    <div>
                      <Label htmlFor={`response-${f.id}`}>Reply (optional)</Label>
                      <Textarea id={`response-${f.id}`} name="response" defaultValue={f.response || ""} rows={3} placeholder="Your reply shows to the sender (unless anonymous)." />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label htmlFor={`status-${f.id}`}>Status</Label>
                        <Select id={`status-${f.id}`} name="status" defaultValue={f.status}>
                          <option value="NEW">New</option>
                          <option value="ACKNOWLEDGED">Acknowledged</option>
                          <option value="IN_PROGRESS">In progress</option>
                          <option value="RESOLVED">Resolved</option>
                          <option value="ARCHIVED">Archived</option>
                        </Select>
                      </div>
                      <Button type="submit" className="mt-6">Save</Button>
                    </div>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {all.length === 0 && <Card className="p-10 text-center text-ink-400">No messages yet.</Card>}
      </div>
    </div>
  );
}
