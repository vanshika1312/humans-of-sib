import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { formatDate, formatTime } from "@/lib/utils";
import { createOneOnOne, saveOneOnOne } from "./actions";

export default function OneOnOnePage() {
  return (
    <div>
      <PageHeader title="1-on-1s" emoji="🤝" subtitle="Keep the conversations going — agenda, notes, action items." />
      <Suspense fallback={<RouteBodyFallback />}>
        <OneOnOnePageBody />
      </Suspense>
    </div>
  );
}

async function OneOnOnePageBody() {
  const base = await requireAppViewer();
  if (!base) return null;

  const me = await prisma.user.findUnique({
    where: { id: base.id },
    include: { reports: { orderBy: { name: "asc" } }, manager: true },
  });
  if (!me) return null;

  const [asManager, asReport] = await Promise.all([
    prisma.oneOnOne.findMany({
      where: { managerId: me.id },
      orderBy: { scheduledAt: "desc" },
      include: { report: { select: { name: true, image: true } } },
      take: 30,
    }),
    prisma.oneOnOne.findMany({
      where: { reportId: me.id },
      orderBy: { scheduledAt: "desc" },
      include: { manager: { select: { name: true, image: true } } },
      take: 30,
    }),
  ]);

  return (
    <>
      <div className="grid md:grid-cols-[1fr,380px] gap-6">
        <div className="space-y-6">
          {asManager.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-ink-600 mb-3">As manager</h2>
              <div className="space-y-3">
                {asManager.map((o) => (
                  <OneOnOneRow key={o.id} o={o} counterparty={o.report} role="with" />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-ink-600 mb-3">As team member</h2>
            {asReport.length === 0 ? (
              <EmptyState emoji="🤝" title="No 1-on-1s yet" description="Your manager will schedule these with you." />
            ) : (
              <div className="space-y-3">
                {asReport.map((o) => (
                  <OneOnOneRow key={o.id} o={o} counterparty={o.manager} role="with" />
                ))}
              </div>
            )}
          </section>
        </div>

        {me.reports.length > 0 && (
          <Card className="h-fit sticky top-20">
            <CardContent className="pt-5">
              <h3 className="font-semibold text-ink-700 mb-3">➕ Schedule a 1-on-1</h3>
              <form action={createOneOnOne} className="space-y-3">
                <div>
                  <Label htmlFor="reportId">With</Label>
                  <Select id="reportId" name="reportId" required>
                    {me.reports.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="scheduledAt">Date &amp; time</Label>
                  <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
                </div>
                <div>
                  <Label htmlFor="agenda">Agenda (optional)</Label>
                  <Textarea
                    id="agenda"
                    name="agenda"
                    rows={4}
                    placeholder="• What's on your mind&#10;• Goals progress&#10;• Blockers&#10;• Support needed"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Schedule
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function OneOnOneRow({
  o,
  counterparty,
  role,
}: {
  o: any;
  counterparty: { name: string | null; image: string | null } | null;
  role: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <Avatar src={counterparty?.image} name={counterparty?.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-ink-700">
                {role} {counterparty?.name}
              </span>
              {o.completed && <Badge tone="green">Done</Badge>}
              <span className="text-xs text-ink-400 ml-auto">
                {formatDate(o.scheduledAt, { weekday: "short", day: "2-digit", month: "short" })} ·{" "}
                {formatTime(o.scheduledAt)}
              </span>
            </div>
            {o.agenda && (
              <div className="mt-2">
                <div className="text-xs font-medium text-ink-400 uppercase">Agenda</div>
                <p className="text-sm text-ink-600 mt-1 whitespace-pre-wrap">{o.agenda}</p>
              </div>
            )}
            <form
              action={async (fd) => {
                "use server";
                await saveOneOnOne(o.id, fd);
              }}
              className="mt-3 space-y-2"
            >
              <div>
                <Label htmlFor={`n-${o.id}`}>Notes</Label>
                <Textarea
                  id={`n-${o.id}`}
                  name="notes"
                  rows={3}
                  defaultValue={o.notes || ""}
                  placeholder="Key discussion points, decisions..."
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-ink-600">
                <input type="checkbox" name="completed" defaultChecked={o.completed} /> Mark as completed
              </label>
              <Button type="submit" size="sm" variant="outline">
                Save notes
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
