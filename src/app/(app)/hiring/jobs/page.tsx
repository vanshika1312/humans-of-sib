import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { HiringJobStatus } from "@/generated/prisma";
import { WORK_ARRANGEMENT_LABEL } from "@/lib/hiring-job-copy";
import { closeJobPosting } from "../actions";
import { firstSearchParam } from "@/lib/search-param";

type Props = { searchParams: Promise<{ closed?: string | string[]; deleted?: string | string[] }> };

export default async function HiringJobsPage(props: Props) {
  const sp = await props.searchParams;
  const flashClosed = firstSearchParam(sp.closed) === "1";
  const flashDeleted = firstSearchParam(sp.deleted) === "1";
  const jobs = await prisma.hiringJob.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: {
      department: { select: { name: true, emoji: true } },
      _count: { select: { applications: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job openings"
        emoji="🪧"
        subtitle="Post roles, track applicants, and move people through stages. Public OPEN listings (with apply links) appear at /careers."
        action={
          <div className="flex gap-2">
            <Link href="/hiring">
              <Button variant="ghost" size="md">
                ← Overview
              </Button>
            </Link>
            <Link href="/hiring/jobs/new">
              <Button variant="accent">New job</Button>
            </Link>
          </div>
        }
      />

      {flashClosed && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Job marked as closed.
        </div>
      )}
      {flashDeleted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Closed posting was permanently deleted.
        </div>
      )}

      <div className="rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Team</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3 text-right tabular-nums">Openings</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-center">Ext. apply</th>
                <th className="px-5 py-3 text-right">Pipeline</th>
                <th className="px-5 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-ink-500">
                    No postings yet.{" "}
                    <Link href="/hiring/jobs/new" className="font-semibold text-sky-700 hover:underline">
                      Create the first job
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-ink-50/40 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/hiring/jobs/${j.id}`} className="font-medium text-sky-800 hover:underline">
                        {j.title}
                      </Link>
                      {j.employmentType && (
                        <div className="text-xs text-ink-400 mt-0.5">{j.employmentType}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {j.department ? (
                        <span>
                          {j.department.emoji} {j.department.name}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      <span className="block">
                        {[j.workArrangement ? WORK_ARRANGEMENT_LABEL[j.workArrangement] : null, j.location]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">{j.openings}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="px-5 py-3 text-center text-ink-600">
                      {j.externalApplyUrl ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                          Set
                        </span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">{j._count.applications}</td>
                    <td className="px-5 py-3 text-right">
                      {j.status === "CLOSED" ? (
                        <span className="text-xs text-ink-300">—</span>
                      ) : (
                        <form action={closeJobPosting.bind(null, j.id)} className="inline">
                          <input type="hidden" name="returnTo" value="list" />
                          <Button type="submit" variant="outline" size="sm">
                            Close
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: HiringJobStatus }) {
  const tone =
    status === "OPEN" ? "green" : status === "DRAFT" ? "ink" : status === "ON_HOLD" ? "orange" : "sky";
  const label =
    status === "OPEN"
      ? "Open"
      : status === "DRAFT"
        ? "Draft"
        : status === "ON_HOLD"
          ? "On hold"
          : "Closed";
  return <Badge tone={tone}>{label}</Badge>;
}
