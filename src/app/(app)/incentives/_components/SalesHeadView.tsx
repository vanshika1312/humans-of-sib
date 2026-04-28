import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/page-header";
import { ExternalLink } from "lucide-react";
import { TabNav } from "./TabNav";
import { BulkImportForm } from "./BulkImportForm";
import { setRevenue, setPeriodSheetUrl, lockSheet, bulkImportRevenue } from "../actions";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetWithUser = Awaited<ReturnType<typeof fetchMonthData>>["sheets"][number];
type Slab = { id: string; minRev: number; maxRev: number | null; rate: number; label: string };

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function fetchMonthData(year: number, month: number) {
  const [period, sheets, allSalesUsers, slabs] = await Promise.all([
    prisma.incentivePeriod.findUnique({ where: { year_month: { year, month } } }),
    prisma.incentiveSheet.findMany({
      where: { year, month },
      orderBy: { adjustedRevenue: "desc" },
      include: {
        user: { select: { id: true, name: true, image: true, department: { select: { name: true } } } },
        lockedBy: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE", role: "EMPLOYEE", department: { slug: { in: ["sales", "counselling", "admissions"] } } },
      select: { id: true, name: true, image: true, department: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.incentiveSlab.findMany({ orderBy: { order: "asc" } }),
  ]);
  return { period, sheets, allSalesUsers, slabs };
}

function topSlabMinRev(slabs: Slab[]) {
  return slabs.reduce((max, s) => Math.max(max, s.minRev), 0);
}

function getStatus(revenue: number, slabs: Slab[]) {
  const top = topSlabMinRev(slabs);
  if (top === 0) return "neutral";
  const pct = revenue / top;
  if (pct >= 1)   return "on-track";
  if (pct >= 0.5) return "needs-push";
  return "below-target";
}

// ─── Main component ───────────────────────────────────────────────────────────

export async function SalesHeadView({ year, month, tab }: { year: number; month: number; tab: string }) {
  const { period, sheets, allSalesUsers, slabs } = await fetchMonthData(year, month);

  const sheetUserIds  = new Set(sheets.map((s) => s.user.id));
  const noRevenueYet  = allSalesUsers.filter((u) => !sheetUserIds.has(u.id));

  const totalRevenue  = sheets.reduce((a, s) => a + s.adjustedRevenue, 0);
  const totalPayout   = sheets.reduce((a, s) => a + s.finalAmount, 0);
  const avgIncentive  = sheets.length ? Math.round(totalPayout / sheets.length) : 0;
  const onTrackCount  = sheets.filter((s) => getStatus(s.adjustedRevenue, slabs) === "on-track").length;

  const TABS = [
    { id: "live",    label: "Live View" },
    { id: "review",  label: "Month-End Review" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <TabNav tabs={TABS} active={tab} />
        {tab === "live" && period?.sheetUrl && (
          <a
            href={period.sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:underline"
          >
            <ExternalLink className="size-3.5" /> Open sales sheet
          </a>
        )}
      </div>

      {tab === "live"    && <LiveView    sheets={sheets} noRevenueYet={noRevenueYet} slabs={slabs} year={year} month={month} period={period} totalRevenue={totalRevenue} totalPayout={totalPayout} avgIncentive={avgIncentive} onTrackCount={onTrackCount} />}
      {tab === "review"  && <ReviewView  sheets={sheets} noRevenueYet={noRevenueYet} slabs={slabs} year={year} month={month} period={period} />}
      {tab === "history" && <HistoryView year={year} month={month} />}
    </div>
  );
}

// ─── Live View ────────────────────────────────────────────────────────────────

function LiveView({ sheets, noRevenueYet, slabs, year, month, period, totalRevenue, totalPayout, avgIncentive, onTrackCount }: {
  sheets: SheetWithUser[];
  noRevenueYet: { id: string; name: string | null; image: string | null; department: { name: string } | null }[];
  slabs: Slab[];
  year: number; month: number;
  period: { sheetUrl: string | null; note: string | null } | null;
  totalRevenue: number; totalPayout: number; avgIncentive: number; onTrackCount: number;
}) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard emoji="💰" label="Total incentive (est.)" value={`₹${totalPayout.toLocaleString("en-IN")}`} />
        <SummaryCard emoji="📈" label="Revenue collected" value={`₹${(totalRevenue / 100000).toFixed(1)}L`} sub={`${sheets.length} counsellor${sheets.length !== 1 ? "s" : ""}`} />
        <SummaryCard emoji="🎯" label="On target" value={`${onTrackCount} / ${sheets.length}`} sub="≥ top slab revenue" />
        <SummaryCard emoji="⚡" label="Avg. incentive" value={`₹${avgIncentive.toLocaleString("en-IN")}`} />
      </div>

      {/* Slab reference */}
      {slabs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {slabs.map((s) => (
            <div key={s.id} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-ink-50 border border-ink-100 text-ink-500">
              {s.label} · {s.rate}%
              {s.maxRev
                ? ` (₹${(s.minRev/1000).toFixed(0)}k–₹${(s.maxRev/1000).toFixed(0)}k)`
                : ` (₹${(s.minRev/1000).toFixed(0)}k+)`}
            </div>
          ))}
        </div>
      )}

      {/* Team table */}
      <Card>
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink-700">Team breakdown</h2>
            <p className="text-xs text-ink-400 mt-0.5">
              {MONTHS[month - 1]} {year} · figures from the sales sheet
              {period?.note && ` · ${period.note}`}
            </p>
          </div>
          <Link
            href="/incentives?tab=review"
            className="text-xs font-medium text-sky-600 hover:underline"
          >
            Go to review →
          </Link>
        </div>

        {sheets.length === 0 ? (
          <div className="p-6">
            <EmptyState emoji="📋" title="No revenue entered yet" description="Switch to Month-End Review to enter revenue figures." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 border-b border-ink-100 text-xs text-ink-400 uppercase tracking-wide">
                  <th className="text-left py-3 px-5 font-medium">Counsellor</th>
                  <th className="text-right py-3 px-5 font-medium">Revenue</th>
                  <th className="text-left py-3 px-5 font-medium">Progress</th>
                  <th className="text-right py-3 px-5 font-medium">Incentive (est.)</th>
                  <th className="text-left py-3 px-5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {sheets.map((s) => {
                  const st = getStatus(s.adjustedRevenue, slabs);
                  const topMin = topSlabMinRev(slabs);
                  const pct = topMin > 0 ? Math.min(100, Math.round((s.adjustedRevenue / topMin) * 100)) : 0;
                  return (
                    <tr key={s.id} className="hover:bg-ink-50/50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <Avatar src={s.user.image} name={s.user.name} size="sm" />
                          <div>
                            <div className="font-medium text-ink-700">{s.user.name}</div>
                            {s.user.department && <div className="text-xs text-ink-400">{s.user.department.name}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right font-medium text-ink-700">
                        ₹{s.adjustedRevenue.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${st === "on-track" ? "bg-green-500" : st === "needs-push" ? "bg-orange-400" : "bg-red-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-ink-400 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <span className="font-semibold text-ink-700">₹{s.finalAmount.toLocaleString("en-IN")}</span>
                        {s.status === "DRAFT" && (
                          <span className="ml-1.5 text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">EST</span>
                        )}
                        {s.status !== "DRAFT" && (
                          <span className="ml-1.5 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">FINAL</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <StatusPill status={st} sheetStatus={s.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Bottom bar */}
            <div className="px-5 py-3 border-t border-ink-100 bg-ink-50/50 flex items-center justify-between gap-3">
              <p className="text-xs text-ink-400">
                Figures tagged <span className="font-bold text-orange-500">EST</span> are estimates — finalise in Month-End Review before payout
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Counsellors with no revenue + sheet link */}
      {noRevenueYet.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="text-sm font-semibold text-ink-600 mb-3">No revenue entered yet</h3>
            <div className="flex flex-wrap gap-2">
              {noRevenueYet.map((u) => (
                <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-ink-100 text-sm text-ink-500 bg-white">
                  <Avatar src={u.image} name={u.name} size="sm" />
                  {u.name}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Switch to{" "}
              <Link href="/incentives?tab=review" className="text-sky-600 hover:underline">
                Month-End Review
              </Link>{" "}
              to enter their figures.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Review View ──────────────────────────────────────────────────────────────

function ReviewView({ sheets, noRevenueYet, slabs, year, month, period }: {
  sheets: SheetWithUser[];
  noRevenueYet: { id: string; name: string | null; image: string | null; department: { name: string } | null }[];
  slabs: Slab[];
  year: number; month: number;
  period: { sheetUrl: string | null; note: string | null } | null;
}) {
  const allLocked = sheets.length > 0 && sheets.every((s) => s.status !== "DRAFT");

  return (
    <div className="space-y-5">
      {/* Alert or locked banner */}
      {!allLocked ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-50 border border-orange-100">
          <span className="text-lg shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-orange-700">Review before locking</p>
            <p className="text-sm text-orange-600 mt-0.5">
              Adjust any figures that need correction (refunds, data errors). Add a note for each change. Once locked, figures are frozen for payout.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100">
          <span className="text-lg">🔒</span>
          <p className="font-semibold text-green-700">All sheets locked for {MONTHS[month - 1]} {year} — ready to send to Accounts Manager.</p>
        </div>
      )}

      {/* Sales sheet link */}
      <Card>
        <CardContent className="pt-5">
          <form action={setPeriodSheetUrl} className="flex items-end gap-3 flex-wrap">
            <input type="hidden" name="year"  value={year} />
            <input type="hidden" name="month" value={month} />
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="sheetUrl">Sales sheet URL</Label>
              <Input id="sheetUrl" name="sheetUrl" type="url" defaultValue={period?.sheetUrl ?? ""} placeholder="https://docs.google.com/spreadsheets/d/…" />
            </div>
            <div className="w-44">
              <Label htmlFor="note">Note</Label>
              <Input id="note" name="note" defaultValue={period?.note ?? ""} placeholder="e.g. Q2 run" />
            </div>
            <Button type="submit" variant="outline">Save</Button>
            {period?.sheetUrl && (
              <a href={period.sheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-ink-200 text-sm font-medium text-sky-600 hover:bg-sky-50 transition-colors">
                <ExternalLink className="size-3.5" /> Open
              </a>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Adjustment table */}
      <Card>
        <div className="px-5 py-4 border-b border-ink-100">
          <h2 className="font-semibold text-ink-700">Final adjustment sheet</h2>
          <p className="text-xs text-ink-400 mt-0.5">
            {MONTHS[month - 1]} {year} · Edit revenue figures as needed; incentive recalculates on save
          </p>
        </div>

        {sheets.length === 0 && noRevenueYet.length === 0 ? (
          <div className="p-6">
            <EmptyState emoji="📋" title="No counsellors yet" description="No revenue data for this month." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 border-b border-ink-100 text-xs text-ink-400 uppercase tracking-wide">
                  <th className="text-left py-3 px-5 font-medium">Counsellor</th>
                  <th className="text-right py-3 px-5 font-medium">Current revenue</th>
                  <th className="text-right py-3 px-5 font-medium">Rate</th>
                  <th className="text-right py-3 px-5 font-medium">Incentive</th>
                  <th className="text-right py-3 px-5 font-medium">Adj.</th>
                  <th className="text-right py-3 px-5 font-medium">Final</th>
                  <th className="py-3 px-5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {sheets.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50/50 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <Avatar src={s.user.image} name={s.user.name} size="sm" />
                        <div>
                          <div className="font-medium text-ink-700">{s.user.name}</div>
                          {s.user.department && <div className="text-xs text-ink-400">{s.user.department.name}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-right text-ink-600">₹{s.adjustedRevenue.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-5 text-right text-ink-400">{s.slabRate}%</td>
                    <td className="py-3 px-5 text-right font-medium text-ink-700">₹{s.incentiveAmount.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-5 text-right">
                      {s.manualAdjustment !== 0 ? (
                        <span className={`text-sm font-medium ${s.manualAdjustment >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {s.manualAdjustment >= 0 ? "+" : ""}₹{s.manualAdjustment.toLocaleString("en-IN")}
                        </span>
                      ) : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="py-3 px-5 text-right font-bold text-ink-700">₹{s.finalAmount.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-5">
                      {s.status === "DRAFT" ? (
                        <div className="flex flex-col gap-2">
                          <form action={setRevenue} className="flex items-center gap-2">
                            <input type="hidden" name="userId" value={s.user.id} />
                            <input type="hidden" name="year"   value={year} />
                            <input type="hidden" name="month"  value={month} />
                            <Input name="revenue" type="number" min={0} defaultValue={s.adjustedRevenue} className="w-28 h-8 text-sm" />
                            <Button type="submit" variant="outline" size="sm">Update</Button>
                          </form>
                          <form action={lockSheet} className="flex items-center gap-2 flex-wrap">
                            <input type="hidden" name="sheetId" value={s.id} />
                            <Input name="manualAdjustment" type="number" defaultValue={0} className="w-20 h-8 text-sm" placeholder="Adj." />
                            <Input name="adjustmentNote" placeholder="Reason" className="w-28 h-8 text-sm" />
                            <Button type="submit" variant="accent" size="sm">🔒 Lock</Button>
                          </form>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge tone="orange">Locked</Badge>
                          {s.lockedBy?.name && <span className="text-xs text-ink-400">by {s.lockedBy.name}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Empty rows for counsellors with no revenue */}
                {noRevenueYet.map((u) => (
                  <tr key={u.id} className="hover:bg-ink-50/50 transition-colors opacity-60">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.image} name={u.name} size="sm" />
                        <div>
                          <div className="font-medium text-ink-700">{u.name}</div>
                          {u.department && <div className="text-xs text-ink-400">{u.department.name}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-right text-ink-300">—</td>
                    <td className="py-3 px-5 text-right text-ink-300">—</td>
                    <td className="py-3 px-5 text-right text-ink-300">—</td>
                    <td className="py-3 px-5 text-right text-ink-300">—</td>
                    <td className="py-3 px-5 text-right text-ink-300">—</td>
                    <td className="py-3 px-5">
                      <form action={setRevenue} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="year"   value={year} />
                        <input type="hidden" name="month"  value={month} />
                        <Input name="revenue" type="number" min={0} required placeholder="₹0" className="w-28 h-8 text-sm" />
                        <Button type="submit" variant="accent" size="sm">Set</Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals footer */}
            {sheets.length > 0 && (
              <div className="px-5 py-4 border-t border-ink-100 bg-ink-50/50 flex items-center gap-6 flex-wrap">
                <div className="text-sm text-ink-500">
                  Total revenue: <span className="font-semibold text-ink-700">₹{sheets.reduce((a, s) => a + s.adjustedRevenue, 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="text-sm text-ink-500">
                  Total payout: <span className="font-semibold text-sky-600">₹{sheets.reduce((a, s) => a + s.finalAmount, 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="text-sm text-ink-500">
                  Net adj.: <span className="font-semibold text-ink-700">
                    {(() => {
                      const adj = sheets.reduce((a, s) => a + s.manualAdjustment, 0);
                      return adj === 0 ? "—" : `${adj >= 0 ? "+" : ""}₹${adj.toLocaleString("en-IN")}`;
                    })()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Bulk import */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold text-ink-700 mb-1">📥 Bulk import via CSV</h3>
          <p className="text-xs text-ink-400 mb-4">Paste revenue figures from the sales sheet — two columns, one row per counsellor.</p>
          <BulkImportForm action={bulkImportRevenue} templateHref="/incentives/template" year={year} month={month} forTeam />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── History View ─────────────────────────────────────────────────────────────

async function HistoryView({ year, month }: { year: number; month: number }) {
  const past = await prisma.incentiveSheet.groupBy({
    by: ["year", "month"],
    _sum: { finalAmount: true, adjustedRevenue: true },
    _count: { userId: true },
    where: { NOT: { year, month } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 12,
  });

  // Get status for each period (show worst status = most advanced)
  const periodStatuses = await Promise.all(
    past.map(async (p) => {
      const statuses = await prisma.incentiveSheet.findMany({
        where: { year: p.year, month: p.month },
        select: { status: true },
      });
      const statusOrder = ["DRAFT", "LOCKED", "APPROVED", "PAID"];
      const worst = statuses.reduce((a, s) => {
        return statusOrder.indexOf(s.status) < statusOrder.indexOf(a) ? s.status : a;
      }, "PAID" as string);
      return { ...p, overallStatus: worst };
    })
  );

  if (past.length === 0) {
    return <EmptyState emoji="📅" title="No history yet" description="Past months will appear here once locked and processed." />;
  }

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {periodStatuses.map((p) => {
          const isPaid = p.overallStatus === "PAID";
          return (
            <div
              key={`${p.year}-${p.month}`}
              className={`p-5 rounded-xl border bg-white transition-colors cursor-default ${isPaid ? "border-green-200" : "border-orange-200"}`}
            >
              <div className="font-semibold text-ink-700">{MONTHS[p.month - 1]} {p.year}</div>
              <div className="text-xs text-ink-400 mt-0.5">{p._count.userId} counsellor{p._count.userId !== 1 ? "s" : ""}</div>
              <div className="mt-3 text-2xl font-bold text-ink-700">
                ₹{(p._sum.finalAmount ?? 0).toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-ink-400">₹{(p._sum.adjustedRevenue ?? 0).toLocaleString("en-IN")} revenue</div>
              <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold ${isPaid ? "text-green-600" : "text-orange-600"}`}>
                <span className={`size-1.5 rounded-full ${isPaid ? "bg-green-500" : "bg-orange-400"}`} />
                {isPaid ? "Paid out" : p.overallStatus === "APPROVED" ? "Approved" : p.overallStatus === "LOCKED" ? "Locked" : "In progress"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Small reusable parts ─────────────────────────────────────────────────────

function SummaryCard({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <div className="text-2xl mb-3">{emoji}</div>
      <div className="text-xs text-ink-400 uppercase tracking-wide font-medium">{label}</div>
      <div className="text-2xl font-bold text-ink-700 mt-1">{value}</div>
      {sub && <div className="text-xs text-ink-400 mt-1">{sub}</div>}
    </Card>
  );
}

function StatusPill({ status, sheetStatus }: { status: string; sheetStatus: string }) {
  if (sheetStatus !== "DRAFT") {
    const colors: Record<string, string> = {
      LOCKED: "bg-orange-50 text-orange-600",
      APPROVED: "bg-sun-50 text-sun-600",
      PAID: "bg-green-50 text-green-600",
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors[sheetStatus] ?? "bg-ink-100 text-ink-500"}`}>
        <span className="size-1.5 rounded-full bg-current" />
        {sheetStatus}
      </span>
    );
  }
  const map = {
    "on-track":     { label: "On Track",      cls: "bg-green-50 text-green-700" },
    "needs-push":   { label: "Needs Push",     cls: "bg-orange-50 text-orange-600" },
    "below-target": { label: "Below Target",   cls: "bg-red-50 text-red-600" },
    "neutral":      { label: "—",              cls: "bg-ink-50 text-ink-400" },
  } as const;
  const s = map[status as keyof typeof map] ?? map.neutral;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
