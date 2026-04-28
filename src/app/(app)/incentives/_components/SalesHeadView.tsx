import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/page-header";
import { lockSheet, bulkImportForTeam } from "../actions";
import { BulkImportForm } from "./BulkImportForm";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_TONE: Record<string, "sky"|"orange"|"sun"|"ink"> = {
  DRAFT: "sky", LOCKED: "orange", APPROVED: "sun", PAID: "ink",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", LOCKED: "Locked", APPROVED: "Approved", PAID: "Paid",
};

export async function SalesHeadView({ year, month }: { year: number; month: number }) {
  // Note: BulkImportSection is rendered separately below the async content
  const [sheets, allSalesUsers] = await Promise.all([
    prisma.incentiveSheet.findMany({
      where: { year, month },
      orderBy: { finalAmount: "desc" },
      include: {
        user: { select: { id: true, name: true, image: true, department: { select: { name: true } } } },
        lockedBy: { select: { name: true } },
        _count: { select: { sales: { where: { status: "ACTIVE" } } } },
      },
    }),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: "EMPLOYEE",
        department: { slug: { in: ["sales", "counselling", "admissions"] } },
      },
      select: { id: true, name: true, image: true, department: { select: { name: true } } },
    }),
  ]);

  const sheetUserIds = new Set(sheets.map((s) => s.user.id));
  const usersWithoutSheet = allSalesUsers.filter((u) => !sheetUserIds.has(u.id));

  const draftCount  = sheets.filter((s) => s.status === "DRAFT").length;
  const lockedCount = sheets.filter((s) => s.status === "LOCKED").length;
  const totalPayout = sheets.reduce((acc, s) => acc + s.finalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-ink-400">Pending review</div>
          <div className="text-2xl font-bold text-sky-600">{draftCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-ink-400">Locked</div>
          <div className="text-2xl font-bold text-orange-500">{lockedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-ink-400">Total payout</div>
          <div className="text-2xl font-bold text-ink-700">₹{totalPayout.toLocaleString("en-IN")}</div>
        </Card>
      </div>

      {/* Team sheets */}
      <h2 className="text-sm font-semibold text-ink-600 -mb-3">
        {MONTHS[month - 1]} {year} · Team overview
      </h2>

      {sheets.length === 0 && usersWithoutSheet.length === 0 ? (
        <EmptyState
          emoji="📋"
          title="No sales logged yet"
          description="Counsellors will appear here once they log their first sale for the month."
        />
      ) : (
        <div className="space-y-4">
          {sheets.map((s) => (
            <Card key={s.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Counsellor info */}
                  <div className="flex items-center gap-3">
                    <Avatar src={s.user.image} name={s.user.name} />
                    <div>
                      <div className="font-semibold text-ink-700">{s.user.name}</div>
                      {s.user.department && (
                        <div className="text-xs text-ink-400">{s.user.department.name}</div>
                      )}
                    </div>
                  </div>

                  <Badge tone={STATUS_TONE[s.status] ?? "ink"}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                </div>

                {/* Stats row */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Sales" value={`${s._count.sales}`} />
                  <Stat label="Revenue" value={`₹${s.adjustedRevenue.toLocaleString("en-IN")}`} />
                  <Stat label="Rate" value={`${s.slabRate}%`} />
                  <Stat label="Incentive" value={`₹${s.incentiveAmount.toLocaleString("en-IN")}`} accent />
                </div>

                {/* Manual adjustment note (if any) */}
                {s.manualAdjustment !== 0 && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-ink-400">Adjustment:</span>
                    <span className={s.manualAdjustment >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                      {s.manualAdjustment >= 0 ? "+" : ""}₹{s.manualAdjustment.toLocaleString("en-IN")}
                    </span>
                    {s.adjustmentNote && <span className="text-ink-400 italic">"{s.adjustmentNote}"</span>}
                  </div>
                )}

                {/* Final amount + lock form */}
                <div className="mt-4 pt-4 border-t border-ink-100 flex items-end justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-xs text-ink-400">Final amount</div>
                    <div className="text-2xl font-bold text-ink-700">
                      ₹{s.finalAmount.toLocaleString("en-IN")}
                    </div>
                  </div>

                  {s.status === "DRAFT" && (
                    <form action={lockSheet} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="sheetId" value={s.id} />
                      <div>
                        <Label htmlFor={`adj-${s.id}`}>Adjustment (₹)</Label>
                        <Input
                          id={`adj-${s.id}`}
                          name="manualAdjustment"
                          type="number"
                          defaultValue={s.manualAdjustment}
                          placeholder="0"
                          className="w-32"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`note-${s.id}`}>Note</Label>
                        <Input
                          id={`note-${s.id}`}
                          name="adjustmentNote"
                          defaultValue={s.adjustmentNote ?? ""}
                          placeholder="Reason for adjustment"
                          className="w-48"
                        />
                      </div>
                      <Button type="submit" variant="accent" size="sm">
                        🔒 Lock sheet
                      </Button>
                    </form>
                  )}

                  {s.status !== "DRAFT" && s.lockedBy?.name && (
                    <div className="text-xs text-ink-400">
                      Locked by {s.lockedBy.name}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Users with no sales */}
          {usersWithoutSheet.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-300 mb-2">
                No sales logged yet
              </h3>
              <div className="flex flex-wrap gap-2">
                {usersWithoutSheet.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-ink-100 text-sm text-ink-500 bg-white">
                    <Avatar src={u.image} name={u.name} size="sm" />
                    {u.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <BulkImportSection />
    </div>
  );
}

export { BulkImportSection };

function BulkImportSection() {
  return (
    <Card>
      <CardContent className="pt-5">
        <h3 className="font-semibold text-ink-700 mb-1">📥 Bulk import for team</h3>
        <p className="text-xs text-ink-400 mb-4">
          Upload a CSV with a <code className="bg-ink-100 px-1 rounded">counsellor_email</code> column to import sales for multiple counsellors at once.
        </p>
        <BulkImportForm
          action={bulkImportForTeam}
          templateHref="/incentives/template?type=team"
          forTeam
        />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-ink-50">
      <div className="text-xs text-ink-400">{label}</div>
      <div className={`text-sm font-bold ${accent ? "text-sky-600" : "text-ink-700"}`}>{value}</div>
    </div>
  );
}
