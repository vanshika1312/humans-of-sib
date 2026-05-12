import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { createOkr, updateOkrProgress } from "./actions";

const STATUS_TONE: Record<string, "green" | "sky" | "orange" | "red" | "ink"> = {
  ON_TRACK: "green",
  AT_RISK: "orange",
  OFF_TRACK: "red",
  COMPLETED: "sky",
  ARCHIVED: "ink",
};

const CYCLE_EMOJI: Record<string, string> = { YEAR: "📅", QUARTER: "🗓️", MONTH: "📆" };

export default function OKRPage() {
  return (
    <div>
      <PageHeader title="OKRs & Goals" emoji="🎯" subtitle="Year → Quarter → Month. Cascade your ambitions." />
      <Suspense fallback={<RouteBodyFallback />}>
        <OKRPageBody />
      </Suspense>
    </div>
  );
}

async function OKRPageBody() {
  const me = await requireAppViewer();
  if (!me) return null;

  const now = new Date();
  const year = now.getFullYear();

  const [year_, quarter_, month_, parents] = await Promise.all([
    prisma.oKR.findMany({ where: { userId: me.id, cycle: "YEAR", year }, orderBy: { createdAt: "desc" } }),
    prisma.oKR.findMany({ where: { userId: me.id, cycle: "QUARTER", year }, orderBy: { quarter: "asc" } }),
    prisma.oKR.findMany({ where: { userId: me.id, cycle: "MONTH", year }, orderBy: [{ month: "asc" }, { createdAt: "desc" }] }),
    prisma.oKR.findMany({ where: { userId: me.id, cycle: { in: ["YEAR", "QUARTER"] } }, select: { id: true, title: true, cycle: true, year: true, quarter: true } }),
  ]);

  return (
    <>
      <div className="grid md:grid-cols-[1fr,380px] gap-6">
        <div className="space-y-6">
          <OkrSection title="🧭 Year" items={year_} />
          <OkrSection title="🗓️ Quarter" items={quarter_} />
          <OkrSection title="📆 Month" items={month_} />
        </div>

        <Card className="h-fit sticky top-20">
          <CardContent className="pt-5">
            <h3 className="font-semibold text-ink-700 mb-3">➕ New goal</h3>
            <form action={createOkr} className="space-y-3">
              <div>
                <Label htmlFor="cycle">Cycle</Label>
                <Select id="cycle" name="cycle" defaultValue="MONTH" required>
                  <option value="YEAR">📅 Year</option>
                  <option value="QUARTER">🗓️ Quarter</option>
                  <option value="MONTH">📆 Month</option>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" name="year" type="number" defaultValue={year} required />
                </div>
                <div>
                  <Label htmlFor="quarter">Qtr</Label>
                  <Select id="quarter" name="quarter">
                    <option value="">—</option>
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="month">Month</Label>
                  <Select id="month" name="month">
                    <option value="">—</option>
                    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                      <option key={m} value={i+1}>{m}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required placeholder="Grow enrollments 3x" />
              </div>
              <div>
                <Label htmlFor="description">Key results (optional)</Label>
                <Textarea id="description" name="description" rows={3} placeholder="• KR1: …&#10;• KR2: …" />
              </div>
              <div>
                <Label htmlFor="parentId">Parent goal (optional)</Label>
                <Select id="parentId" name="parentId">
                  <option value="">— Standalone —</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{CYCLE_EMOJI[p.cycle]} {p.cycle === "QUARTER" ? `Q${p.quarter} ` : ""}{p.year}] {p.title}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" className="w-full">Create goal</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function OkrSection({ title, items }: { title: string; items: any[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-ink-600 mb-3">{title}</h2>
      {items.length === 0 ? (
        <EmptyState emoji="🎯" title="No goals yet" description="Add one on the right." />
      ) : (
        <div className="space-y-3">
          {items.map((o) => (
            <Card key={o.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={STATUS_TONE[o.status]}>{o.status.replace("_", " ")}</Badge>
                      {o.cycle === "QUARTER" && o.quarter && <Badge tone="ink">Q{o.quarter} {o.year}</Badge>}
                      {o.cycle === "MONTH" && o.month && <Badge tone="ink">{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][o.month-1]} {o.year}</Badge>}
                      {o.cycle === "YEAR" && <Badge tone="ink">{o.year}</Badge>}
                    </div>
                    <div className="mt-2 font-semibold text-ink-700">{o.title}</div>
                    {o.description && <p className="text-sm text-ink-500 mt-1 whitespace-pre-wrap">{o.description}</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-sky-600">{o.progress}%</div>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-ink-100 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-sky-500 to-orange-500" style={{ width: `${o.progress}%` }} />
                </div>
                <form action={async (fd) => { "use server"; await updateOkrProgress(o.id, fd); }} className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`p-${o.id}`}>Progress %</Label>
                    <Input id={`p-${o.id}`} name="progress" type="number" min={0} max={100} defaultValue={o.progress} />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor={`s-${o.id}`}>Status</Label>
                    <Select id={`s-${o.id}`} name="status" defaultValue={o.status}>
                      <option value="ON_TRACK">On track</option>
                      <option value="AT_RISK">At risk</option>
                      <option value="OFF_TRACK">Off track</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="ARCHIVED">Archived</option>
                    </Select>
                  </div>
                  <Button type="submit" size="sm" variant="outline">Save</Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
