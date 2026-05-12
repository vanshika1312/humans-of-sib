import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { WORK_ARRANGEMENT_LABEL } from "@/lib/hiring-job-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Careers · Humans of SIB",
  description: "Open roles at Skillinabox. Apply on our company application form.",
};

export default async function CareersPage() {
  const jobs = await prisma.hiringJob.findMany({
    where: { status: "OPEN" },
    orderBy: [{ updatedAt: "desc" }],
    include: { department: { select: { name: true, emoji: true } } },
  });

  const withApply = jobs.filter((j) => Boolean(j.externalApplyUrl));

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/80 to-white text-ink-800">
      <header className="border-b border-ink-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Skillinabox</p>
            <h1 className="text-xl font-bold text-ink-900 mt-1">Careers</h1>
          </div>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-sky-800 hover:text-sky-950 underline underline-offset-2"
          >
            Team sign-in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <p className="text-sm text-ink-600 leading-relaxed">
          We hire people who believe in equitable skilling across India. When a role is live, use{" "}
          <strong className="font-semibold text-ink-800">Apply on company site</strong> to complete our application —
          submissions go straight to our hiring workflows.
        </p>

        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-10 text-center text-ink-500 text-sm shadow-sm">
            No open postings right now. Check back soon.
          </div>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => {
              const locale =
                [job.workArrangement ? WORK_ARRANGEMENT_LABEL[job.workArrangement] : null, job.location]
                  .filter(Boolean)
                  .join(" · ") || null;
              return (
                <li
                  key={job.id}
                  className="rounded-2xl border border-ink-100 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <h2 className="text-lg font-semibold text-ink-900">{job.title}</h2>
                      <div className="text-sm text-ink-500 flex flex-wrap gap-x-2 gap-y-1">
                        {job.department && (
                          <span>
                            {job.department.emoji} {job.department.name}
                          </span>
                        )}
                        {job.department && locale && <span aria-hidden className="text-ink-300">·</span>}
                        {locale && <span>{locale}</span>}
                        {job.employmentType && (
                          <>
                            {(job.department || locale) && <span aria-hidden className="text-ink-300">·</span>}
                            <span>{job.employmentType}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {job.externalApplyUrl ? (
                      <a
                        href={job.externalApplyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex justify-center items-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors"
                      >
                        Apply on company site
                      </a>
                    ) : (
                      <p className="shrink-0 text-xs text-ink-400 max-w-[200px] sm:text-right leading-snug">
                        Application link isn&apos;t set for public boards yet — follow updates on our channels.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {jobs.length > 0 && withApply.length === 0 && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            Open roles are listed, but no public apply URLs are configured. Recruiters can add{" "}
            <strong className="font-semibold">Company apply URL</strong> on each job in the hiring module.
          </p>
        )}
      </main>
    </div>
  );
}
