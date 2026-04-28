import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { addSale, deleteSale, markSaleRefunded, bulkImportSales } from "../actions";
import { BulkImportForm } from "./BulkImportForm";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const SHEET_STATUS: Record<string, { label: string; tone: "sky"|"orange"|"sun"|"ink"|"green" }> = {
  DRAFT:    { label: "Live estimate",  tone: "sky"    },
  LOCKED:   { label: "Locked",         tone: "orange" },
  APPROVED: { label: "Approved",       tone: "sun"    },
  PAID:     { label: "Paid ✓",         tone: "sky"    },
};

type Slab = { id: string; minRev: number; maxRev: number | null; rate: number; label: string };

function resolveRate(revenue: number, slabs: Slab[]) {
  let rate = 0;
  for (const s of slabs) {
    if (revenue >= s.minRev && (s.maxRev === null || revenue <= s.maxRev)) rate = s.rate;
  }
  return rate;
}

export async function CounsellorView({ userId }: { userId: string }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [currentSheet, currentSales, slabs, pastSheets] = await Promise.all([
    prisma.incentiveSheet.findUnique({
      where: { userId_year_month: { userId, year: currentYear, month: currentMonth } },
      include: { lockedBy: { select: { name: true } } },
    }),
    prisma.saleEntry.findMany({
      where: { userId, year: currentYear, month: currentMonth },
      orderBy: { saleDate: "desc" },
    }),
    prisma.incentiveSlab.findMany({ orderBy: { order: "asc" } }),
    prisma.incentiveSheet.findMany({
      where: { userId, NOT: { year: currentYear, month: currentMonth } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 6,
    }),
  ]);

  const isLocked = !!currentSheet && currentSheet.status !== "DRAFT";
  const activeSales = currentSales.filter((s) => s.status === "ACTIVE");
  const activeRevenue = activeSales.reduce((acc, s) => acc + s.revenue, 0);

  const estimatedRate   = currentSheet?.slabRate   ?? resolveRate(activeRevenue, slabs);
  const estimatedAmount = currentSheet?.finalAmount ?? Math.round((activeRevenue * estimatedRate) / 100);

  return (
    <div className="grid md:grid-cols-[1fr,360px] gap-6 items-start">
      {/* Left column */}
      <div className="space-y-6">
        {/* Hero */}
        <Card className="overflow-hidden">
          <div className="p-5 md:p-6 brand-gradient text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm opacity-80 font-medium uppercase tracking-wide">
                  {MONTHS[currentMonth - 1]} {currentYear} · Incentive estimate
                </div>
                <div className="mt-1 text-4xl font-bold">
                  ₹{estimatedAmount.toLocaleString("en-IN")}
                </div>
                <div className="mt-1.5 text-sm text-white/75">
                  {activeSales.length} sale{activeSales.length !== 1 ? "s" : ""} · ₹{activeRevenue.toLocaleString("en-IN")} revenue
                  {estimatedRate > 0 && ` · ${estimatedRate}% rate`}
                </div>
              </div>
              {currentSheet && (
                <Badge tone={SHEET_STATUS[currentSheet.status]?.tone ?? "ink"} className="shrink-0">
                  {SHEET_STATUS[currentSheet.status]?.label ?? currentSheet.status}
                </Badge>
              )}
            </div>
          </div>

          {/* Slab ladder */}
          {slabs.length > 0 && (
            <CardContent className="pt-4 flex flex-wrap gap-2">
              {slabs.map((s) => {
                const active = activeRevenue >= s.minRev && (s.maxRev == null || activeRevenue <= s.maxRev);
                return (
                  <div
                    key={s.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      active
                        ? "bg-sky-50 text-sky-700 border-sky-200"
                        : "bg-ink-50 text-ink-400 border-ink-100"
                    }`}
                  >
                    {s.label} · {s.rate}%
                    {s.maxRev
                      ? ` (up to ₹${(s.maxRev / 1000).toFixed(0)}k)`
                      : ` (₹${(s.minRev / 1000).toFixed(0)}k+)`}
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        {/* Sales this month */}
        <div>
          <h2 className="text-sm font-semibold text-ink-600 mb-3">
            {MONTHS[currentMonth - 1]} sales
          </h2>
          <Card>
            <CardContent className="pt-4">
              {isLocked && (
                <div className="mb-4 flex items-center justify-between flex-wrap gap-2 p-3 rounded-lg bg-orange-50 border border-orange-100">
                  <p className="text-sm text-orange-700">
                    Sheet locked{currentSheet?.lockedBy?.name ? ` by ${currentSheet.lockedBy.name}` : ""}. Contact your Sales Head to make changes.
                  </p>
                  {currentSheet?.manualAdjustment !== 0 && (
                    <span className={`text-sm font-semibold ${(currentSheet?.manualAdjustment ?? 0) >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {(currentSheet?.manualAdjustment ?? 0) >= 0 ? "+" : ""}₹{(currentSheet?.manualAdjustment ?? 0).toLocaleString("en-IN")} adj.
                    </span>
                  )}
                </div>
              )}

              {currentSales.length === 0 ? (
                <EmptyState
                  emoji="📋"
                  title="No sales yet"
                  description="Log your first sale using the form on the right."
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {currentSales.map((s) => (
                    <li key={s.id} className={`py-3 flex items-center gap-3 flex-wrap ${s.status !== "ACTIVE" ? "opacity-50" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-ink-700 truncate">{s.studentName}</div>
                        <div className="text-sm text-ink-400">{s.courseName}</div>
                      </div>
                      <div className="text-sm font-semibold text-ink-700 shrink-0">
                        ₹{s.revenue.toLocaleString("en-IN")}
                      </div>
                      <div className="text-xs text-ink-400 shrink-0">
                        {formatDate(s.saleDate, { day: "2-digit", month: "short" })}
                      </div>
                      <SaleStatusBadge status={s.status} />
                      {!isLocked && (
                        <div className="flex items-center gap-1 shrink-0">
                          {s.status === "ACTIVE" && (
                            <form action={markSaleRefunded.bind(null, s.id)}>
                              <button type="submit" className="text-xs text-ink-400 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50 transition-colors">
                                Refund
                              </button>
                            </form>
                          )}
                          <form action={deleteSale.bind(null, s.id)}>
                            <button type="submit" className="text-xs text-ink-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                              Delete
                            </button>
                          </form>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {currentSales.length > 0 && (
                <div className="mt-3 pt-3 border-t border-ink-100 flex justify-between text-sm">
                  <span className="text-ink-400">Active revenue total</span>
                  <span className="font-bold text-ink-700">₹{activeRevenue.toLocaleString("en-IN")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Past months */}
        {pastSheets.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-ink-600 mb-3">Past incentives</h2>
            <Card>
              <CardContent className="pt-4">
                <ul className="divide-y divide-ink-100">
                  {pastSheets.map((ps) => (
                    <li key={ps.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-medium text-ink-700">{MONTHS[ps.month - 1]} {ps.year}</span>
                        <span className="ml-2 text-xs text-ink-400">@ {ps.slabRate}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-ink-700">₹{ps.finalAmount.toLocaleString("en-IN")}</span>
                        <Badge tone={SHEET_STATUS[ps.status]?.tone ?? "ink"}>
                          {SHEET_STATUS[ps.status]?.label ?? ps.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Right column: log a sale + bulk import */}
      {!isLocked && (
        <div className="space-y-5">
          <Card className="h-fit sticky top-20">
            <CardContent className="pt-5">
              <h3 className="font-semibold text-ink-700 mb-3">➕ Log a sale</h3>
              <form action={addSale} className="space-y-3">
                <div>
                  <Label htmlFor="studentName">Student name</Label>
                  <Input id="studentName" name="studentName" required placeholder="Priya Sharma" />
                </div>
                <div>
                  <Label htmlFor="courseName">Course / program</Label>
                  <Input id="courseName" name="courseName" required placeholder="Full-Stack Bootcamp" />
                </div>
                <div>
                  <Label htmlFor="revenue">Revenue collected (₹)</Label>
                  <Input id="revenue" name="revenue" type="number" min={1} required placeholder="25000" />
                </div>
                <div>
                  <Label htmlFor="saleDate">Date of sale</Label>
                  <Input
                    id="saleDate"
                    name="saleDate"
                    type="date"
                    required
                    defaultValue={now.toISOString().slice(0, 10)}
                  />
                </div>
                <Button type="submit" variant="accent" className="w-full">Add sale +</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <h3 className="font-semibold text-ink-700 mb-1">📥 Bulk import via CSV</h3>
              <p className="text-xs text-ink-400 mb-4">Have a lot of sales? Import them all at once.</p>
              <BulkImportForm
                action={bulkImportSales}
                templateHref="/incentives/template"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SaleStatusBadge({ status }: { status: string }) {
  if (status === "REFUNDED") return <Badge tone="orange">Refunded</Badge>;
  if (status === "CANCELLED") return <Badge tone="ink">Cancelled</Badge>;
  return null;
}
