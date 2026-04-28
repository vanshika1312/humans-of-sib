import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { approveSheet, markPaid } from "../actions";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export async function AccountsView() {
  const [lockedSheets, recentSheets] = await Promise.all([
    prisma.incentiveSheet.findMany({
      where: { status: "LOCKED" },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: {
        user: { select: { id: true, name: true, image: true, department: { select: { name: true } } } },
        lockedBy: { select: { name: true } },
      },
    }),
    prisma.incentiveSheet.findMany({
      where: { status: { in: ["APPROVED", "PAID"] } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 20,
      include: {
        user: { select: { id: true, name: true, image: true } },
        approvedBy: { select: { name: true } },
      },
    }),
  ]);

  const totalPending = lockedSheets.reduce((acc, s) => acc + s.finalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Pending approval */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-600">
          Pending approval {lockedSheets.length > 0 && `(${lockedSheets.length})`}
        </h2>
        {lockedSheets.length > 0 && (
          <span className="text-sm text-ink-400">
            Total: <span className="font-semibold text-ink-700">₹{totalPending.toLocaleString("en-IN")}</span>
          </span>
        )}
      </div>

      {lockedSheets.length === 0 ? (
        <EmptyState
          emoji="✅"
          title="All caught up"
          description="No sheets are awaiting your approval right now."
        />
      ) : (
        <div className="space-y-4">
          {lockedSheets.map((s) => (
            <Card key={s.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Avatar src={s.user.image} name={s.user.name} />
                    <div>
                      <div className="font-semibold text-ink-700">{s.user.name}</div>
                      <div className="text-sm text-ink-400">
                        {MONTHS[s.month - 1]} {s.year}
                        {s.user.department && ` · ${(s.user as any).department?.name}`}
                      </div>
                    </div>
                  </div>
                  <Badge tone="orange">Awaiting approval</Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-ink-50">
                    <div className="text-xs text-ink-400">Revenue</div>
                    <div className="text-sm font-semibold text-ink-700">₹{s.adjustedRevenue.toLocaleString("en-IN")}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-ink-50">
                    <div className="text-xs text-ink-400">Rate</div>
                    <div className="text-sm font-semibold text-ink-700">{s.slabRate}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-sky-50">
                    <div className="text-xs text-sky-600">Final payout</div>
                    <div className="text-sm font-bold text-sky-700">₹{s.finalAmount.toLocaleString("en-IN")}</div>
                  </div>
                </div>

                {(s.manualAdjustment !== 0 || s.adjustmentNote) && (
                  <div className="mt-2 text-sm text-ink-400">
                    {s.manualAdjustment !== 0 && (
                      <span className={s.manualAdjustment >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {s.manualAdjustment >= 0 ? "+" : ""}₹{s.manualAdjustment.toLocaleString("en-IN")} adjustment
                      </span>
                    )}
                    {s.adjustmentNote && <span className="italic ml-1">· "{s.adjustmentNote}"</span>}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-ink-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-xs text-ink-400">
                    Locked{s.lockedBy?.name ? ` by ${s.lockedBy.name}` : ""}
                    {s.lockedAt && ` · ${formatDate(s.lockedAt, { day: "2-digit", month: "short" })}`}
                  </div>
                  <form action={approveSheet.bind(null, s.id)}>
                    <Button type="submit" variant="accent" size="sm">
                      ✓ Approve
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* History */}
      {recentSheets.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink-600 mb-3">Approved &amp; paid</h2>
          <Card>
            <CardContent className="pt-4">
              <ul className="divide-y divide-ink-100">
                {recentSheets.map((s) => (
                  <li key={s.id} className="py-3 flex items-center gap-3 flex-wrap">
                    <Avatar src={s.user.image} name={s.user.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink-700">{s.user.name}</div>
                      <div className="text-xs text-ink-400">{MONTHS[s.month - 1]} {s.year}</div>
                    </div>
                    <div className="font-semibold text-ink-700 shrink-0">
                      ₹{s.finalAmount.toLocaleString("en-IN")}
                    </div>
                    <Badge tone={s.status === "PAID" ? "sky" : "sun"}>
                      {s.status === "PAID" ? "Paid ✓" : "Approved"}
                    </Badge>
                    {s.status === "APPROVED" && (
                      <form action={markPaid.bind(null, s.id)}>
                        <Button type="submit" variant="outline" size="sm">
                          Mark paid
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
