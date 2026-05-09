import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/page-header";
import { ExternalLink } from "lucide-react";
import { TabNav } from "./TabNav";
import { BulkImportForm } from "./BulkImportForm";
import { MonthSelector } from "./MonthSelector";
import { ReviewForm, type ReviewRow, type LockBulkState } from "./ReviewForm";
import { SendModal, type SendSummary } from "./SendModal";
import { DeleteButton } from "./DeleteButton";
import { EligibilitySelect, type EligibilityOption } from "./EligibilitySelect";
import { ClusterFilter } from "./ClusterFilter";
import { EligibilityOptionManager } from "./EligibilityOptionManager";
import { SyncButton } from "./SyncButton";
import {
  setPeriodSheetUrl, bulkImportRevenue, lockMonthBulk, sendMonthToAccounts,
  deleteSheet, unlockSheet, saveTargets,
  setEligibility, upsertEligibilityOption, deleteEligibilityOption,
  markPaidAction, syncRevenueFromSheetAction,
} from "../actions";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AccountsView } from "./AccountsView";

const MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetWithUser = Awaited<ReturnType<typeof fetchMonthData>>["sheets"][number];
type Slab = { id: string; minRev: number; maxRev: number | null; rate: number; label: string };

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function fetchMonthData(year: number, month: number) {
  const [period, sheets, allSalesUsers, slabs, eligibilityOptions] = await Promise.all([
    prisma.incentivePeriod.findUnique({ where: { year_month: { year, month } } }),
    prisma.incentiveSheet.findMany({
      where: { year, month },
      orderBy: { adjustedRevenue: "desc" },
      include: {
        user: {
          select: {
            id: true, name: true, image: true,
            department: { select: { name: true } },
            city:       { select: { name: true } },
          },
        },
        lockedBy:          { select: { name: true } },
        approvedBy:        { select: { name: true } },
        eligibilityOption: { select: { id: true, label: true, color: true } },
      },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true, name: true, image: true,
        department: { select: { name: true } },
        city:       { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.incentiveSlab.findMany({ orderBy: { order: "asc" } }),
    prisma.incentiveEligibilityOption.findMany({ orderBy: { order: "asc" } }),
  ]);
  return { period, sheets, allSalesUsers, slabs, eligibilityOptions };
}

function topSlabMinRev(slabs: Slab[]) {
  return slabs.reduce((max, s) => Math.max(max, s.minRev), 0);
}

/** Progress towards the monthly target: (revenue / target) * 100 */
function getSlabProgress(revenue: number, target: number) {
  if (target === 0) return 0;
  return Math.min(100, Math.round((revenue / target) * 100));
}

function getChaChing(revenue: number, target: number): string {
  if (target === 0) return "No target set for this month";
  const pct = Math.round((revenue / target) * 100);
  if (revenue >= target) return "Yayyy....Target achieved — now maximize your earnings";
  if (pct >= 90) return "You're one step away from incentives 💥";
  if (pct >= 70) return "You're close — don't slow down now 🔥";
  if (pct >= 40) return "Momentum is building — keep pushing";
  return `Only ${pct}% completed — pick up the pace`;
}

/** Group sheets by their counsellor's department name. */
function groupByCluster(sheets: SheetWithUser[]): Record<string, SheetWithUser[]> {
  const groups: Record<string, SheetWithUser[]> = {};
  for (const s of sheets) {
    const key = s.user.department?.name ?? "Unassigned";
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return groups;
}

// ─── Main component ───────────────────────────────────────────────────────────

export async function SalesHeadView({
  year, month, tab, historyYear, historyMonth, userName, cluster, team, showApprovalsTab = false,
}: {
  year: number; month: number; tab: string;
  historyYear?: number; historyMonth?: number;
  userName: string; cluster: string; team: string;
  /** ADMIN / HR / CEO: extra tab with locked-sheet approval + disbursement queue */
  showApprovalsTab?: boolean;
}) {
  const { period, sheets, allSalesUsers, slabs, eligibilityOptions } = await fetchMonthData(year, month);

  const sheetUserIds = new Set(sheets.map((s) => s.user.id));
  const noRevenueYet = allSalesUsers.filter((u) => !sheetUserIds.has(u.id));

  const totalRevenue  = sheets.reduce((a, s) => a + s.adjustedRevenue, 0);
  const totalPayout   = sheets.reduce((a, s) => a + s.finalAmount, 0);
  const avgIncentive  = sheets.length ? Math.round(totalPayout / sheets.length) : 0;
  const eligibleCount = sheets.filter((s) => s.eligibilityOption !== null).length;
  const allLocked     = sheets.length > 0 && sheets.every((s) => s.status !== "DRAFT");

  const allClusters = Array.from(
    new Set(allSalesUsers.map((u) => u.department?.name ?? "Unassigned").filter(Boolean))
  ).sort();

  const allTeams = Array.from(
    new Set(allSalesUsers.map((u) => u.city?.name).filter((c): c is string => !!c))
  ).sort();

  const BASE_TABS = [
    { id: "live",    label: "Live View" },
    { id: "review",  label: "Month-End Review" },
    { id: "history", label: "History" },
    { id: "payment", label: "Payment Status" },
  ];
  const tabs = showApprovalsTab
    ? [...BASE_TABS, { id: "approvals", label: "Payout approvals" }]
    : BASE_TABS;
  const tabIds = new Set(tabs.map((t) => t.id));
  const effectiveTab = tabIds.has(tab) ? tab : "live";

  const sendSummary: SendSummary = {
    year,
    month,
    counsellorCount: sheets.length + noRevenueYet.length,
    totalRevenue,
    totalIncentive: totalPayout,
    sentBy: userName,
  };

  return (
    <div className="space-y-6">
      {/* Tab bar + month selector + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <TabNav tabs={tabs} active={effectiveTab} />
          {effectiveTab !== "approvals" && <MonthSelector year={year} month={month} />}
        </div>

        {/* Tab-level actions (Live View only) */}
        {effectiveTab === "live" && (
          <div className="flex items-center gap-2">
            {period?.sheetUrl && (
              <a
                href={period.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-ink-200 text-sm font-medium text-sky-600 hover:bg-sky-50 transition-colors"
              >
                <ExternalLink className="size-3.5" /> Sales Sheet
              </a>
            )}
            <SyncButton
              year={year}
              month={month}
              hasSheetUrl={!!period?.sheetUrl}
              syncAction={syncRevenueFromSheetAction}
            />
            <ExportButton sheets={sheets} year={year} month={month} />
            {!allLocked ? (
              <Link
                href={`/incentives?tab=review&year=${year}&month=${month}`}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-ink-700 text-white text-sm font-medium hover:bg-ink-600 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 8l5 5 7-7"/>
                </svg>
                Send to Accounts
              </Link>
            ) : (
              <SendModal summary={sendSummary} sendAction={sendMonthToAccounts} />
            )}
          </div>
        )}
      </div>

      {effectiveTab === "live"    && <LiveView sheets={sheets} noRevenueYet={noRevenueYet} slabs={slabs} year={year} month={month} period={period} totalRevenue={totalRevenue} totalPayout={totalPayout} avgIncentive={avgIncentive} eligibleCount={eligibleCount} allLocked={allLocked} eligibilityOptions={eligibilityOptions} cluster={cluster} allClusters={allClusters} team={team} allTeams={allTeams} />}
      {effectiveTab === "review"  && <ReviewTab sheets={sheets} allSalesUsers={allSalesUsers} noRevenueYet={noRevenueYet} slabs={slabs} year={year} month={month} period={period} allLocked={allLocked} />}
      {effectiveTab === "history" && <HistoryView currentYear={year} currentMonth={month} historyYear={historyYear} historyMonth={historyMonth} />}
      {effectiveTab === "payment" && <PaymentStatusView sheets={sheets} year={year} month={month} cluster={cluster} allClusters={allClusters} team={team} allTeams={allTeams} />}
      {effectiveTab === "approvals" && showApprovalsTab && <AccountsView />}
    </div>
  );
}

// ─── Live View ────────────────────────────────────────────────────────────────

function LiveView({ sheets, noRevenueYet, slabs, year, month, period, totalRevenue, totalPayout, avgIncentive, eligibleCount, allLocked, eligibilityOptions, cluster, allClusters, team, allTeams }: {
  sheets: SheetWithUser[];
  noRevenueYet: { id: string; name: string | null; image: string | null; department: { name: string } | null; city: { name: string } | null }[];
  slabs: Slab[];
  year: number; month: number;
  period: { sheetUrl: string | null; note: string | null } | null;
  totalRevenue: number; totalPayout: number; avgIncentive: number; eligibleCount: number;
  allLocked: boolean;
  eligibilityOptions: EligibilityOption[];
  cluster: string; allClusters: string[];
  team: string;    allTeams: string[];
}) {
  const filteredSheets = sheets.filter((s) => {
    if (cluster && (s.user.department?.name ?? "Unassigned") !== cluster) return false;
    if (team    && (s.user.city?.name ?? "") !== team)                      return false;
    return true;
  });
  const filteredNoRevenue = noRevenueYet.filter((u) => {
    if (cluster && (u.department?.name ?? "Unassigned") !== cluster) return false;
    if (team    && (u.city?.name ?? "") !== team)                    return false;
    return true;
  });
  const grouped = groupByCluster(filteredSheets);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          emoji="💰"
          label="Total Incentives (Est.)"
          value={`₹${totalPayout.toLocaleString("en-IN")}`}
          accent="orange"
        />
        <SummaryCard
          emoji="📈"
          label="Revenue Collected"
          value={`₹${(totalRevenue / 100000).toFixed(1)}L`}
          sub={`${sheets.length} counsellor${sheets.length !== 1 ? "s" : ""}`}
          accent="blue"
        />
        <SummaryCard
          emoji="✅"
          label="Eligibility Set"
          value={`${eligibleCount} / ${sheets.length}`}
          sub="counsellors with status"
          accent="green"
        />
        <SummaryCard
          emoji="⚡"
          label="Avg. Incentive"
          value={`₹${avgIncentive.toLocaleString("en-IN")}`}
          accent="gold"
        />
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
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-ink-700">Team Breakdown</h2>
            <p className="text-xs text-ink-400 mt-0.5">
              {FULL_MONTHS[month - 1]} {year} · figures from the sales sheet
              {period?.note && ` · ${period.note}`}
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Cluster</span>
              <ClusterFilter clusters={allClusters} paramKey="cluster" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Team</span>
              <ClusterFilter clusters={allTeams} paramKey="team" />
            </div>
            <Link
              href={`/incentives?tab=review&year=${year}&month=${month}`}
              className="text-xs font-medium text-sky-600 hover:underline"
            >
              Go to review →
            </Link>
          </div>
        </div>

        {filteredSheets.length === 0 ? (
          <div className="p-6">
            <EmptyState emoji="📋" title="No revenue entered yet" description="Switch to Month-End Review to enter revenue figures for the team." />
          </div>
        ) : (
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
                  <th className="py-3 px-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {Object.entries(grouped).map(([clusterName, clusterSheets]) => (
                  <React.Fragment key={`cluster-${clusterName}`}>
                    {/* Cluster / department header row */}
                    <tr className="bg-orange-50/20 border-y border-ink-100">
                      <td colSpan={8} className="px-5 py-2 text-[10.5px] font-bold text-ink-500 uppercase tracking-widest">
                        {clusterName}
                        <span className="ml-2 font-normal text-ink-400">({clusterSheets.length})</span>
                      </td>
                    </tr>

                    {clusterSheets.map((s) => {
                      const pct = getSlabProgress(s.adjustedRevenue, s.monthlyTarget);
                      const barColor = s.monthlyTarget === 0 ? "bg-ink-200" : pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400";
                      return (
                        <tr key={s.id} className="hover:bg-ink-50/50 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <Avatar src={s.user.image} name={s.user.name} size="sm" />
                              <div className="font-medium text-ink-700">{s.user.name}</div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5">
                            <span className="text-xs text-ink-500">
                              {s.user.city?.name ?? <span className="text-ink-300">—</span>}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right tabular-nums">
                            {s.monthlyTarget > 0 ? (
                              <span className="text-ink-600 font-medium">₹{s.monthlyTarget.toLocaleString("en-IN")}</span>
                            ) : (
                              <span className="text-ink-300 text-xs">Not set</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right font-medium text-ink-700 tabular-nums">
                            ₹{s.adjustedRevenue.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="group min-w-[160px] space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-[5px] rounded-full bg-ink-100 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-ink-400 w-8 text-right tabular-nums">{pct}%</span>
                              </div>
                              <div className="text-[10px] text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150 truncate max-w-[160px]">
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
                            <div className="space-y-1.5">
                              <EligibilitySelect
                                sheetId={s.id}
                                currentOptionId={s.eligibilityOption?.id ?? null}
                                options={eligibilityOptions}
                                setEligibilityAction={setEligibility}
                              />
                              {s.monthlyTarget > 0 && (
                                <p className="text-[10px] text-ink-400 leading-snug max-w-[200px]">
                                  {getChaChing(s.adjustedRevenue, s.monthlyTarget)}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/incentives?tab=review&year=${year}&month=${month}`}
                                className="h-7 px-2.5 rounded-md border border-ink-200 text-xs font-medium text-ink-600 hover:bg-ink-50 transition-colors inline-flex items-center"
                              >
                                Edit
                              </Link>
                              {s.status === "LOCKED" && (
                                <form action={unlockSheet}>
                                  <input type="hidden" name="sheetId" value={s.id} />
                                  <button
                                    type="submit"
                                    className="h-7 px-2.5 rounded-md border border-amber-200 text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                                  >
                                    Unlock
                                  </button>
                                </form>
                              )}
                              <DeleteButton sheetId={s.id} userName={s.user.name ?? ""} deleteAction={deleteSheet} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-ink-100 bg-ink-50/50 flex items-center justify-between gap-3">
              <p className="text-xs text-ink-400">
                Figures tagged <span className="font-bold text-orange-500">EST</span> are estimates — finalise in Month-End Review before payout
              </p>
              <Link
                href={`/incentives?tab=review&year=${year}&month=${month}`}
                className="inline-flex items-center h-7 px-3 rounded-md bg-ink-700 text-white text-xs font-medium hover:bg-ink-600 transition-colors"
              >
                Go to Review →
              </Link>
            </div>
          </div>
        )}
      </Card>

      {/* Eligibility options manager */}
      <Card>
        <CardContent className="pt-5">
          <EligibilityOptionManager
            options={eligibilityOptions}
            upsertAction={upsertEligibilityOption}
            deleteAction={deleteEligibilityOption}
          />
        </CardContent>
      </Card>

      {/* Counsellors with no revenue */}
      {filteredNoRevenue.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="text-sm font-semibold text-ink-600 mb-3">No revenue entered yet ({filteredNoRevenue.length})</h3>
            <div className="flex flex-wrap gap-2">
              {filteredNoRevenue.map((u) => (
                <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-ink-100 text-sm text-ink-500 bg-white">
                  <Avatar src={u.image} name={u.name} size="sm" />
                  {u.name}
                  {u.department && <span className="text-xs text-ink-400">· {u.department.name}</span>}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Switch to{" "}
              <Link href={`/incentives?tab=review&year=${year}&month=${month}`} className="text-sky-600 hover:underline">
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

// ─── Review Tab ───────────────────────────────────────────────────────────────

function ReviewTab({ sheets, allSalesUsers, noRevenueYet, slabs, year, month, period, allLocked }: {
  sheets: SheetWithUser[];
  allSalesUsers: { id: string; name: string | null; image: string | null; department: { name: string } | null }[];
  noRevenueYet: { id: string; name: string | null; image: string | null; department: { name: string } | null }[];
  slabs: Slab[];
  year: number; month: number;
  period: { sheetUrl: string | null; note: string | null } | null;
  allLocked: boolean;
}) {
  // Build rows for ALL users (sheets + those without revenue)
  const rows: ReviewRow[] = allSalesUsers.map((u) => {
    const sheet = sheets.find((s) => s.user.id === u.id);
    return {
      userId:         u.id,
      name:           u.name,
      image:          u.image,
      department:     u.department?.name ?? null,
      estRevenue:     sheet?.adjustedRevenue ?? 0,
      estIncentive:   sheet?.incentiveAmount ?? 0,
      isLocked:       sheet ? sheet.status !== "DRAFT" : false,
      adjustmentNote: sheet?.adjustmentNote ?? null,
      monthlyTarget:  sheet?.monthlyTarget ?? 0,
    };
  });

  return (
    <div className="space-y-5">
      {/* Sales sheet URL form */}
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
              <a href={period.sheetUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-ink-200 text-sm font-medium text-sky-600 hover:bg-sky-50 transition-colors">
                <ExternalLink className="size-3.5" /> Open
              </a>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Main review form */}
      <ReviewForm
        rows={rows}
        slabs={slabs}
        year={year}
        month={month}
        periodSheetUrl={period?.sheetUrl ?? null}
        periodNote={period?.note ?? null}
        allLocked={allLocked}
        lockAction={lockMonthBulk}
        saveTargetsAction={saveTargets}
      />

      {/* Bulk import (secondary) */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold text-ink-700 mb-1">📥 Bulk import via CSV</h3>
          <p className="text-xs text-ink-400 mb-4">Two columns: <code>counsellor_email</code> and <code>revenue</code></p>
          <BulkImportForm action={bulkImportRevenue} templateHref="/incentives/template" year={year} month={month} forTeam />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── History View ─────────────────────────────────────────────────────────────

async function HistoryView({
  currentYear,
  currentMonth,
  historyYear,
  historyMonth,
}: {
  currentYear: number;
  currentMonth: number;
  historyYear?: number;
  historyMonth?: number;
}) {
  const past = await prisma.incentiveSheet.groupBy({
    by: ["year", "month"],
    _sum:   { finalAmount: true, adjustedRevenue: true },
    _count: { userId: true },
    where:  { NOT: { year: currentYear, month: currentMonth } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 12,
  });

  const periodStatuses = await Promise.all(
    past.map(async (p) => {
      const statuses = await prisma.incentiveSheet.findMany({
        where:  { year: p.year, month: p.month },
        select: { status: true },
      });
      const statusOrder = ["DRAFT", "LOCKED", "APPROVED", "PAID"];
      const worst = statuses.reduce((a, s) => {
        return statusOrder.indexOf(s.status) < statusOrder.indexOf(a) ? s.status : a;
      }, "PAID" as string);
      return { ...p, overallStatus: worst };
    }),
  );

  if (past.length === 0) {
    return (
      <EmptyState
        emoji="📅"
        title="No history yet"
        description="Past months will appear here once locked and processed."
      />
    );
  }

  // Which month is selected for detail
  const selYear  = historyYear  ?? past[0].year;
  const selMonth = historyMonth ?? past[0].month;

  // Fetch detail for selected month
  const detailSheets = await prisma.incentiveSheet.findMany({
    where:   { year: selYear, month: selMonth },
    orderBy: { finalAmount: "desc" },
    include: { user: { select: { id: true, name: true, image: true, department: { select: { name: true } } } } },
  });

  return (
    <div className="space-y-5">
      {/* Month cards grid */}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {periodStatuses.map((p) => {
          const isPaid    = p.overallStatus === "PAID";
          const isActive  = p.year === selYear && p.month === selMonth;
          return (
            <Link
              key={`${p.year}-${p.month}`}
              href={`/incentives?tab=history&year=${currentYear}&month=${currentMonth}&historyYear=${p.year}&historyMonth=${p.month}`}
              className={`p-5 rounded-xl border bg-white transition-all hover:shadow-md cursor-pointer ${
                isActive
                  ? "border-orange-400 bg-orange-50/30"
                  : isPaid
                  ? "border-green-200 hover:border-green-300"
                  : "border-amber-200 hover:border-amber-300"
              }`}
            >
              <div className="font-semibold text-ink-700">{MONTHS[p.month - 1]} {p.year}</div>
              <div className="text-xs text-ink-400 mt-0.5">{p._count.userId} counsellor{p._count.userId !== 1 ? "s" : ""}</div>
              <div className="mt-3 text-2xl font-bold text-ink-700 tabular-nums">
                ₹{(p._sum.finalAmount ?? 0).toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-ink-400 tabular-nums">₹{(p._sum.adjustedRevenue ?? 0).toLocaleString("en-IN")} revenue</div>
              <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold ${isPaid ? "text-green-600" : "text-amber-600"}`}>
                <span className={`size-1.5 rounded-full ${isPaid ? "bg-green-500" : "bg-amber-400"}`} />
                {isPaid ? "✓ Paid Out" : p.overallStatus === "APPROVED" ? "Approved" : p.overallStatus === "LOCKED" ? "● Locked" : "● In Progress"}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Detail for selected month */}
      {detailSheets.length > 0 && (
        <Card>
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink-700">{FULL_MONTHS[selMonth - 1]} {selYear} — Paid Breakdown</h2>
              <p className="text-xs text-ink-400 mt-0.5">
                {detailSheets.length} counsellor{detailSheets.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Badge tone="sky">{detailSheets[0]?.status}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 border-b border-ink-100 text-[10.5px] text-ink-400 uppercase tracking-wide font-semibold">
                  <th className="text-left py-3 px-5">Counsellor</th>
                  <th className="text-right py-3 px-5">Final Revenue</th>
                  <th className="text-right py-3 px-5">Incentive Paid</th>
                  <th className="text-left py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {detailSheets.map((s) => (
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
                    <td className="py-3.5 px-5 text-right tabular-nums text-ink-600">
                      ₹{s.adjustedRevenue.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="font-bold text-ink-700 tabular-nums">₹{s.finalAmount.toLocaleString("en-IN")}</span>
                      <span className="ml-1.5 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">FINAL</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                        <span className="size-1.5 rounded-full bg-green-500" /> {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Small reusable parts ─────────────────────────────────────────────────────

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

// ─── Export button (client) ───────────────────────────────────────────────────
// Inline client component — small enough to keep in the same file via a
// "use client" boundary, but Next.js doesn't allow mixed directives in one file,
// so we keep it as a server component that renders a plain <button> with onclick.
// For a real CSV export we use a simple anchor pointing to a generated route.

function ExportButton({ sheets, year, month }: {
  sheets: SheetWithUser[];
  year: number;
  month: number;
}) {
  void sheets; // data available if needed for a custom export route
  return (
    <a
      href={`/incentives/export?year=${year}&month=${month}`}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-ink-200 text-sm font-medium text-ink-600 hover:bg-ink-50 transition-colors"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 2v9M4 7l4 4 4-4"/><path d="M2 13h12"/>
      </svg>
      Export
    </a>
  );
}

// ─── Payment Status View ──────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  DRAFT:    { label: "Draft",    color: "text-ink-400 bg-ink-50 border-ink-200",       dot: "bg-ink-300"    },
  LOCKED:   { label: "Locked",   color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-400"  },
  APPROVED: { label: "Approved", color: "text-sky-700 bg-sky-50 border-sky-200",       dot: "bg-sky-500"    },
  PAID:     { label: "Paid",     color: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-500"  },
};

function PaymentStatusView({
  sheets, year, month, cluster, allClusters, team, allTeams,
}: {
  sheets: SheetWithUser[];
  year: number; month: number;
  cluster: string; allClusters: string[];
  team: string;    allTeams: string[];
}) {
  const filtered = sheets.filter((s) => {
    if (cluster && (s.user.department?.name ?? "Unassigned") !== cluster) return false;
    if (team    && (s.user.city?.name ?? "") !== team)                      return false;
    return true;
  });

  const counts = { DRAFT: 0, LOCKED: 0, APPROVED: 0, PAID: 0 };
  for (const s of filtered) counts[s.status as keyof typeof counts] = (counts[s.status as keyof typeof counts] ?? 0) + 1;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["DRAFT", "LOCKED", "APPROVED", "PAID"] as const).map((st) => {
          const meta = STATUS_META[st];
          return (
            <div key={st} className="bg-white rounded-xl border border-ink-100 p-4 flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
              <div>
                <p className="text-[10.5px] text-ink-400 uppercase tracking-wide font-semibold">{meta.label}</p>
                <p className="text-xl font-bold text-ink-800">{counts[st]}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
        {/* Filters */}
        <div className="px-5 py-3 border-b border-ink-100 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Cluster</span>
            <ClusterFilter clusters={allClusters} paramKey="cluster" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Team</span>
            <ClusterFilter clusters={allTeams} paramKey="team" />
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 border-b border-ink-100 text-[10.5px] text-ink-400 uppercase tracking-wide font-semibold">
              <th className="text-left py-3 px-5">Counsellor</th>
              <th className="text-left py-3 px-5">Team</th>
              <th className="text-left py-3 px-5">Cluster</th>
              <th className="text-right py-3 px-5">Incentive</th>
              <th className="text-left py-3 px-5">Status</th>
              <th className="text-left py-3 px-5">Locked By</th>
              <th className="text-left py-3 px-5">Approved By</th>
              <th className="text-left py-3 px-5">Paid On</th>
              <th className="py-3 px-5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-ink-400 text-sm">
                  No data for {FULL_MONTHS[month - 1]} {year}
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const meta = STATUS_META[s.status] ?? STATUS_META.DRAFT;
                return (
                  <tr key={s.id} className="hover:bg-ink-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <Avatar src={s.user.image} name={s.user.name} size="sm" />
                        <span className="font-medium text-ink-700">{s.user.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-ink-500">
                      {s.user.city?.name ?? <span className="text-ink-300">—</span>}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-ink-500">
                      {s.user.department?.name ?? <span className="text-ink-300">—</span>}
                    </td>
                    <td className="py-3.5 px-5 text-right font-bold text-ink-700 tabular-nums">
                      ₹{s.finalAmount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${meta.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-ink-500">
                      {s.lockedAt
                        ? <span>{s.lockedBy?.name ?? "—"}<br /><span className="text-ink-400">{new Date(s.lockedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></span>
                        : <span className="text-ink-300">—</span>
                      }
                    </td>
                    <td className="py-3.5 px-5 text-xs text-ink-500">
                      {s.approvedAt
                        ? <span>{(s as any).approvedBy?.name ?? "—"}<br /><span className="text-ink-400">{new Date(s.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></span>
                        : <span className="text-ink-300">—</span>
                      }
                    </td>
                    <td className="py-3.5 px-5 text-xs text-ink-500">
                      {s.paidAt
                        ? new Date(s.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : <span className="text-ink-300">—</span>
                      }
                    </td>
                    <td className="py-3.5 px-5">
                      {s.status === "APPROVED" && (
                        <form action={markPaidAction}>
                          <input type="hidden" name="sheetId" value={s.id} />
                          <button
                            type="submit"
                            className="h-7 px-3 rounded-md bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
                          >
                            Mark Paid
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-ink-100 bg-ink-50/50">
            <p className="text-xs text-ink-400">
              {filtered.filter((s) => s.status === "PAID").length} of {filtered.length} counsellors paid for {FULL_MONTHS[month - 1]} {year}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
