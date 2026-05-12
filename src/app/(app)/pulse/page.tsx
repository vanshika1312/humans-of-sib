import Image from "next/image";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea, Label } from "@/components/ui/input";
import { formatDate, weekStartDate } from "@/lib/utils";
import { submitPulse } from "./actions";
import { WEEKLY_QUESTION } from "./constants";

const FACES = [
  { v: 1, e: "😩", l: "Tough" },
  { v: 2, e: "😕", l: "Meh" },
  { v: 3, e: "😐", l: "Okay" },
  { v: 4, e: "🙂", l: "Good" },
  { v: 5, e: "🤩", l: "Great" },
];

export default function PulsePage() {
  return (
    <div>
      <PageHeader title="Weekly Pulse" emoji="💗" subtitle="One question a week. A minute to answer. You — and SIB — get better." />
      <Suspense fallback={<RouteBodyFallback />}>
        <PulsePageBody />
      </Suspense>
    </div>
  );
}

async function PulsePageBody() {
  const me = await requireAppViewer();
  if (!me) return null;

  const weekStart = weekStartDate();
  const thisWeek = await prisma.pulseResponse.findUnique({
    where: { userId_weekStart: { userId: me.id, weekStart } },
  });

  const history = await prisma.pulseResponse.findMany({
    where: { userId: me.id },
    orderBy: { weekStart: "desc" },
    take: 10,
  });

  const avg = history.length
    ? (history.reduce((a, r) => a + r.score, 0) / history.length).toFixed(1)
    : "—";

  return (
    <>
      <Card className="mb-6">
        <CardContent className="pt-6">
          {/* Ritvik's question header */}
          <div className="flex items-center gap-4 mb-5 p-4 rounded-xl bg-gradient-to-r from-sky-50 to-orange-50 border border-sky-100">
            <div className="relative shrink-0">
              <div className="size-14 rounded-full overflow-hidden ring-2 ring-white shadow-md">
                <Image
                  src="/ritvik.jpeg"
                  alt="Ritvik"
                  width={56}
                  height={56}
                  className="object-cover object-top size-full"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 text-base">💗</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-sky-600">Ritvik · CPO</div>
              <p className="text-base font-semibold text-ink-700 mt-0.5 leading-snug">{WEEKLY_QUESTION}</p>
              <div className="text-xs text-ink-400 mt-1">Week of {formatDate(weekStart)}</div>
            </div>
          </div>

          <form action={submitPulse} className="mt-5 space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {FACES.map((f) => (
                <label key={f.v} className={`cursor-pointer rounded-xl p-3 text-center border-2 transition-colors ${
                  thisWeek?.score === f.v ? "border-sky-500 bg-sky-50" : "border-ink-100 hover:border-ink-200"
                }`}>
                  <input type="radio" name="score" value={f.v} defaultChecked={thisWeek?.score === f.v} className="sr-only" required />
                  <div className="text-3xl">{f.e}</div>
                  <div className="text-xs font-medium text-ink-600 mt-1">{f.l}</div>
                </label>
              ))}
            </div>
            <div>
              <Label htmlFor="comment">Why? (optional, just for you)</Label>
              <Textarea id="comment" name="comment" rows={3} defaultValue={thisWeek?.comment || ""} placeholder="Anything specific making this week this way?" />
            </div>
            <Button type="submit" className="w-full" variant="accent">{thisWeek ? "Update pulse" : "Submit pulse"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-ink-700">Your last {history.length || 0} weeks</h3>
            <Badge tone="sky">avg {avg}/5</Badge>
          </div>
          {history.length === 0 ? (
            <div className="text-sm text-ink-400 text-center py-6">No pulse history yet.</div>
          ) : (
            <ul className="space-y-2">
              {history.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-b-0">
                  <div className="text-2xl">{FACES.find((f) => f.v === p.score)?.e}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-ink-400">Week of {formatDate(p.weekStart)}</div>
                    {p.comment && <p className="text-sm text-ink-600 mt-0.5 truncate italic">&quot;{p.comment}&quot;</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
