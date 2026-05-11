import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { HiringJobStatus } from "@/generated/prisma";
import { WORK_ARRANGEMENT_LABEL } from "@/lib/hiring-job-copy";

export default async function HiringJobsPage() {
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
        subtitle="Post roles, track applicants, and move people through stages — similar to Zoho Recruit job records."
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
                <th className="px-5 py-3 text-right">Pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-ink-500">
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
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">{j._count.applications}</td>
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
