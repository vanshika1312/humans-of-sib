import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { cancelOwnJobRequisition } from "./actions";
import { firstSearchParam } from "@/lib/search-param";
import type { HiringRequisitionStatus } from "@/generated/prisma";
import { formatCalendarDate } from "@/lib/calendar-date";

type Props = {
  searchParams: Promise<{
    submitted?: string | string[];
    cancelled?: string | string[];
    error?: string | string[];
  }>;
};

export default async function MyRequisitionsPage(props: Props) {
  const searchParams = await props.searchParams;
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me) return null;

  const submitted = firstSearchParam(searchParams.submitted) === "1";
  const cancelled = firstSearchParam(searchParams.cancelled) === "1";
  const flashError = firstSearchParam(searchParams.error);

  const canSeeHiringDesk = ["CEO", "ADMIN", "HR"].includes(me.role);

  const rows = await prisma.hiringRequisition.findMany({
    where: { requestedByUserId: me.id },
    orderBy: { createdAt: "desc" },
    include: {
      department: { select: { name: true, emoji: true } },
      resultingJob: { select: { id: true, title: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Job requisitions"
        subtitle="Requests you&apos;ve submitted go to HR on the Hiring dashboard for approval."
        emoji="📨"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/requisitions/new">
              <Button variant="accent">New request</Button>
            </Link>
            {["CEO", "ADMIN", "HR"].includes(me.role) && (
              <Link href="/hiring">
                <Button variant="outline">Hiring dashboard</Button>
              </Link>
            )}
          </div>
        }
      />

      {submitted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Sent to HR — you&apos;ll see status updates below when they approve or decline.
        </div>
      )}
      {cancelled && (
        <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-800">
          Request withdrawn.
        </div>
      )}
      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(flashError)}
        </div>
      )}

      <div className="rounded-2xl border border-ink-100 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-ink-500">
                  Nothing here yet —{" "}
                  <Link href="/requisitions/new" className="font-semibold text-sky-700 hover:underline">
                    raise your first headcount request
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-ink-50/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-700">{r.title}</div>
                    <div className="text-xs text-ink-400 mt-0.5">
                      {r.positions} seat{r.positions === 1 ? "" : "s"}
                      {r.proposedDeadline && (
                        <span className="block mt-1 text-ink-500">
                          Target fill: {formatCalendarDate(r.proposedDeadline)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {r.department ? `${r.department.emoji ?? ""} ${r.department.name}`.trim() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <RequisitionStatusBadge status={r.status} />
                    {r.status === "APPROVED" &&
                      (canSeeHiringDesk && r.resultingJob ? (
                        <div className="mt-1">
                          <Link
                            href={`/hiring/jobs/${r.resultingJob.id}`}
                            className="text-[11px] font-semibold text-sky-700 hover:underline"
                          >
                            Open draft job →
                          </Link>
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] text-ink-500">Draft posting created — recruiting will publish when ready.</div>
                      ))}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-500">{formatDate(r.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "PENDING" ? (
                      <form action={cancelOwnJobRequisition.bind(null, r.id)} className="inline">
                        <Button type="submit" size="sm" variant="outline">
                          Withdraw
                        </Button>
                      </form>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-400 max-w-xl">
        Approvals and sourcing live under{" "}
        <Link href="/hiring" className="font-medium text-sky-700 hover:underline">
          Hiring
        </Link>{" "}
        (HR / Admin / CEO).
      </p>
    </div>
  );
}

function RequisitionStatusBadge({ status }: { status: HiringRequisitionStatus }) {
  const tone =
    status === "PENDING"
      ? "orange"
      : status === "APPROVED"
        ? "green"
        : status === "REJECTED"
          ? "red"
          : "ink";
  const label =
    status === "PENDING"
      ? "Pending HR"
      : status === "APPROVED"
        ? "Approved"
        : status === "REJECTED"
          ? "Declined"
          : "Withdrawn";
  return <Badge tone={tone}>{label}</Badge>;
}
