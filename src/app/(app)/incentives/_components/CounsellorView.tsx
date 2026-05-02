import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/page-header";
import { ExternalLink } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getChaChing(revenue: number, target: number): string {
  if (target === 0) return "No target set for this month";
  const pct = Math.round((revenue / target) * 100);
  if (revenue >= target) return "Yayyy....Target achieved — now maximize your earnings";
  if (pct >= 90) return "You're one step away from incentives 💥";
  if (pct >= 70) return "You're close — don't slow down now 🔥";
  if (pct >= 40) return "Momentum is building — keep pushing";
  return `Only ${pct}% completed — pick up the pace`;
}

const SHEET_STATUS: Record<string, { label: string; tone: "sky"|"orange"|"sun"|"ink" }> = {
  DRAFT:    { label: "Estimate",  tone: "sky"    },
  LOCKED:   { label: "Locked",    tone: "orange" },
  APPROVED: { label: "Approved",  tone: "sun"    },
  PAID:     { label: "Paid ✓",    tone: "sky"    },
};

export async function CounsellorView({ userId }: { userId: string }) {
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [currentSheet, period, slabs, pastSheets, teamSheets] = await Promise.all([
    prisma.incentiveSheet.findUnique({
      where: { userId_year_month: { userId, year: currentYear, month: currentMonth } },
      include: { lockedBy: { select: { name: true } } },
    }),
    prisma.incentivePeriod.findUnique({
      where: { year_month: { year: currentYear, month: currentMonth } },
    }),
    prisma.incentiveSlab.findMany({ orderBy: { order: "asc" } }),
    prisma.incentiveSheet.findMany({
      where: { userId, NOT: { year: currentYear, month: currentMonth } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 6,
    }),
    prisma.incentiveSheet.findMany({
      where: { year: currentYear, month: currentMonth },
      orderBy: { adjustedRevenue: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            department: { select: { name: true } },
            city: { select: { name: true } },
          },
        },
        eligibilityOption: { select: { label: true, color: true } },
      },
    }),
  ]);

  const revenue    = currentSheet?.adjustedRevenue ?? 0;
  const slabRate   = currentSheet?.slabRate ?? 0;
  const incentive  = currentSheet?.finalAmount ?? 0;
  const status     = currentSheet?.status ?? null;

  // Find active slab for visual highlight
  const activeSlab = slabs.find(
    (s) => revenue >= s.minRev && (s.maxRev === null || revenue <= s.maxRev)
  );

  return (
    <div className="space-y-6">
      {/* Hero estimate */}
      <Card className="overflow-hidden">
        <div className="p-5 md:p-6 brand-gradient text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm opacity-80 uppercase tracking-wide font-medium">
                {MONTHS[currentMonth - 1]} {currentYear} · Your incentive
              </div>
              <div className="mt-1 text-4xl font-bold">
                ₹{incentive.toLocaleString("en-IN")}
              </div>
              {revenue > 0 && (
                <div className="mt-1.5 text-sm text-white/75">
                  ₹{revenue.toLocaleString("en-IN")} revenue
                  {slabRate > 0 && ` · ${slabRate}% rate`}
                  {activeSlab && ` · ${activeSlab.label} tier`}
                </div>
              )}
              {status === "DRAFT" && (
                <div className="mt-2 text-xs text-white/60">
                  Estimated — subject to Sales Head review
                </div>
              )}
              {status === "LOCKED" && currentSheet?.lockedBy?.name && (
                <div className="mt-2 text-xs text-white/60">
                  Reviewed by {currentSheet.lockedBy.name}
                </div>
              )}
            </div>
            {status && (
              <Badge tone={SHEET_STATUS[status]?.tone ?? "ink"} className="shrink-0">
                {SHEET_STATUS[status]?.label ?? status}
              </Badge>
            )}
          </div>
        </div>

        {/* Slab ladder */}
        {slabs.length > 0 && (
          <CardContent className="pt-4 flex flex-wrap gap-2">
            {slabs.map((s) => {
              const isActive = revenue > 0 && revenue >= s.minRev && (s.maxRev === null || revenue <= s.maxRev);
              return (
                <div
                  key={s.id}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    isActive
                      ? "bg-sky-50 text-sky-700 border-sky-200"
                      : "bg-ink-50 text-ink-400 border-ink-100"
                  }`}
                >
                  {isActive && "▶ "}{s.label} · {s.rate}%
                  {s.maxRev
                    ? ` (up to ₹${(s.maxRev / 1000).toFixed(0)}k)`
                    : ` (₹${(s.minRev / 1000).toFixed(0)}k+)`}
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* Current month breakdown */}
      <h2 className="text-sm font-semibold text-ink-600 -mb-3">
        {MONTHS[currentMonth - 1]} {currentYear} breakdown
      </h2>
      <Card>
        <CardContent className="pt-5">
          {!currentSheet ? (
            <EmptyState
              emoji="⏳"
              title="Revenue not entered yet"
              description="Your Sales Head will enter your revenue for this month. Check back soon."
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatTile label="Revenue" value={`₹${currentSheet.adjustedRevenue.toLocaleString("en-IN")}`} />
                <StatTile label="Incentive rate" value={`${currentSheet.slabRate}%`} />
                <StatTile label="Base incentive" value={`₹${currentSheet.incentiveAmount.toLocaleString("en-IN")}`} />
                {currentSheet.manualAdjustment !== 0 && (
                  <StatTile
                    label="Adjustment"
                    value={`${currentSheet.manualAdjustment >= 0 ? "+" : ""}₹${currentSheet.manualAdjustment.toLocaleString("en-IN")}`}
                    highlight={currentSheet.manualAdjustment >= 0 ? "green" : "red"}
                  />
                )}
                <StatTile label="Final payout" value={`₹${currentSheet.finalAmount.toLocaleString("en-IN")}`} highlight="sky" />
              </div>

              {currentSheet.adjustmentNote && (
                <p className="text-sm text-ink-500 italic">
                  Note from Sales Head: &quot;{currentSheet.adjustmentNote}&quot;
                </p>
              )}

              {period?.sheetUrl && (
                <a
                  href={period.sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 hover:underline"
                >
                  <ExternalLink className="size-3.5" /> View sales sheet
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                      {ps.slabRate > 0 && <span className="ml-2 text-xs text-ink-400">@ {ps.slabRate}%</span>}
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

      {/* Team dashboard — read-only */}
      {teamSheets.length > 0 && (() => {
        const totalRevenue   = teamSheets.reduce((a, s) => a + s.adjustedRevenue, 0);
        const totalPayout    = teamSheets.reduce((a, s) => a + s.finalAmount, 0);
        const avgIncentive   = Math.round(totalPayout / teamSheets.length);
        const eligibleCount  = teamSheets.filter((s) => s.eligibilityOption !== null).length;
        const topSlabMinRev  = slabs.reduce((m, s) => Math.max(m, s.minRev), 0);

        return (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-ink-600">
              Team — {FULL_MONTHS[currentMonth - 1]} {currentYear}
            </h2>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard emoji="💰" label="Total Incentives (Est.)" value={`₹${totalPayout.toLocaleString("en-IN")}`} accent="orange" />
              <SummaryCard emoji="📈" label="Revenue Collected" value={`₹${(totalRevenue / 100000).toFixed(1)}L`} sub={`${teamSheets.length} counsellor${teamSheets.length !== 1 ? "s" : ""}`} accent="blue" />
              <SummaryCard emoji="✅" label="Eligibility Set" value={`${eligibleCount} / ${teamSheets.length}`} sub="counsellors with status" accent="green" />
              <SummaryCard emoji="⚡" label="Avg. Incentive" value={`₹${avgIncentive.toLocaleString("en-IN")}`} accent="gold" />
            </div>

            {/* Slab reference chips */}
            {slabs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {slabs.map((s) => (
                  <div key={s.id} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-ink-100 text-ink-500">
                    {s.label} · {s.rate}%
                    {s.maxRev
                      ? ` (₹${(s.minRev / 1000).toFixed(0)}k–₹${(s.maxRev / 1000).toFixed(0)}k)`
                      : ` (₹${(s.minRev / 1000).toFixed(0)}k+)`}
                  </div>
                ))}
              </div>
            )}

            {/* Team breakdown table */}
            <Card>
              <div className="px-5 py-4 border-b border-ink-100">
                <h3 className="font-semibold text-ink-700">Team Breakdown</h3>
                <p className="text-xs text-ink-400 mt-0.5">
                  {FULL_MONTHS[currentMonth - 1]} {currentYear} · figures from the sales sheet
                  {period?.note && ` · ${period.note}`}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 border-b border-ink-100 text-[10.5px] text-ink-400 uppercase tracking-wide font-semibold">
                      <th className="text-left py-3 px-5">Counsellor</th>
                      <th className="text-left py-3 px-5">Team</th>
                      <th className="text-right py-3 px-5">Target</th>
                      <th className="text-right py-3 px-5">Revenue</th>
                      <th className="text-left py-3 px-5">Cha-Ching Meter 🎰</th>
                      <th className="text-right py-3 px-5">Incentive (Est.)</th>
                      <th className="text-left py-3 px-5">Eligibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {teamSheets.map((s) => {
                      const isMe = s.user.id === userId;
                      const pct = s.monthlyTarget > 0
                        ? Math.min(100, Math.round((s.adjustedRevenue / s.monthlyTarget) * 100))
                        : 0;
                      const barColor = s.monthlyTarget === 0 ? "bg-ink-200" : pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400";
                      return (
                        <tr key={s.id} className={`transition-colors ${isMe ? "bg-sky-50/60" : "hover:bg-ink-50/50"}`}>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <Avatar src={s.user.image} name={s.user.name} size="sm" />
                              <div>
                                <span className="font-medium text-ink-700">{s.user.name}</span>
                                {isMe && (
                                  <span className="ml-2 text-[10px] font-semibold text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded">You</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-xs text-ink-500">
                            {s.user.city?.name ?? <span className="text-ink-300">—</span>}
                          </td>
                          <td className="py-3.5 px-5 text-right tabular-nums">
                            {s.monthlyTarget > 0
                              ? <span className="text-ink-600 font-medium">₹{s.monthlyTarget.toLocaleString("en-IN")}</span>
                              : <span className="text-ink-300 text-xs">Not set</span>}
                          </td>
                          <td className="py-3.5 px-5 text-right font-medium text-ink-700 tabular-nums">
                            ₹{s.adjustedRevenue.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="min-w-[180px] space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-[5px] rounded-full bg-ink-100 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-ink-400 w-8 text-right tabular-nums">{pct}%</span>
                              </div>
                              <div className="text-[10px] text-ink-400 leading-snug">
                                {getChaChing(s.adjustedRevenue, s.monthlyTarget)}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span className="font-bold text-ink-700 tabular-nums">₹{s.finalAmount.toLocaleString("en-IN")}</span>
                            {s.status === "DRAFT"
                              ? <span className="ml-1.5 text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">EST</span>
                              : <span className="ml-1.5 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">FINAL</span>
                            }
                          </td>
                          <td className="py-3.5 px-5">
                            {s.eligibilityOption ? (
                              <span className="text-xs font-medium text-ink-600 bg-ink-100 px-2 py-1 rounded">
                                {s.eligibilityOption.label}
                              </span>
                            ) : (
                              <span className="text-xs text-ink-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-ink-100 bg-ink-50/50">
                      <td colSpan={3} className="py-3 px-5 text-xs font-semibold text-ink-500">
                        Team total · {teamSheets.length} counsellor{teamSheets.length !== 1 ? "s" : ""}
                      </td>
                      <td className="py-3 px-5 text-right text-xs font-semibold text-ink-600 tabular-nums">
                        ₹{totalRevenue.toLocaleString("en-IN")}
                      </td>
                      <td />
                      <td className="py-3 px-5 text-right text-xs font-bold text-ink-700 tabular-nums">
                        ₹{totalPayout.toLocaleString("en-IN")}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-ink-100 bg-ink-50/50">
                <p className="text-xs text-ink-400">
                  Figures tagged <span className="font-bold text-orange-500">EST</span> are estimates — pending Sales Head review
                </p>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}

const accentMap = {
  orange: "bg-orange-50",
  blue:   "bg-blue-50",
  green:  "bg-green-50",
  gold:   "bg-amber-50",
} as const;

function SummaryCard({ emoji, label, value, sub, accent }: {
  emoji: string; label: string; value: string; sub?: string; accent: keyof typeof accentMap;
}) {
  return (
    <Card className="p-5 relative overflow-hidden">
      <div className={`size-9 rounded-xl flex items-center justify-center text-base mb-3 ${accentMap[accent]}`}>
        {emoji}
      </div>
      <div className="text-[10px] text-ink-400 uppercase tracking-widest font-medium mb-1">{label}</div>
      <div className="text-[28px] font-bold text-ink-700 leading-none tabular-nums">{value}</div>
      {sub && <div className="text-xs text-ink-400 mt-1.5">{sub}</div>}
    </Card>
  );
}

function StatTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "sky" | "green" | "red";
}) {
  const valueClass =
    highlight === "sky"   ? "text-sky-600"
    : highlight === "green" ? "text-green-600"
    : highlight === "red"   ? "text-red-600"
    : "text-ink-700";

  return (
    <div className="p-3 rounded-lg bg-ink-50">
      <div className="text-xs text-ink-400">{label}</div>
      <div className={`text-sm font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}
