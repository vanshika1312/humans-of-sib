import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hiringPublicCareersJobsWhere } from "@/lib/hiring-job-active";
import { CareersChrome } from "../_components/careers-chrome";
import { jobLocaleLine } from "../_components/job-posting-details";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open roles · Skillinabox",
  description: "Open roles at Skillinabox. Apply in a few minutes — your profile stays with you.",
};

export default async function CareersJobsPage() {
  const jobs = await prisma.hiringJob.findMany({
    where: hiringPublicCareersJobsWhere(),
    orderBy: [{ updatedAt: "desc" }],
    include: { department: { select: { name: true, emoji: true } } },
  });

  return (
    <CareersChrome active="jobs">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Open roles</h1>
          <p className="text-sm text-ink-600 leading-relaxed mt-2">
            We hire people who believe in equitable skilling across India. Browse open roles below and apply
            in a few minutes — your profile stays with you for every application.
          </p>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-10 text-center text-ink-500 text-sm shadow-sm">
            No open postings right now. Check back soon.
          </div>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => {
              const locale = jobLocaleLine(job);
              return (
                <li
                  key={job.id}
                  className="rounded-2xl border border-ink-100 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <h2 className="text-lg font-semibold text-ink-900">
                        <Link href={`/careers/${job.id}`} className="hover:text-sky-900 hover:underline">
                          {job.title}
                        </Link>
                      </h2>
                      <div className="text-sm text-ink-500 flex flex-wrap gap-x-2 gap-y-1">
                        {job.department && (
                          <span>
                            {job.department.emoji} {job.department.name}
                          </span>
                        )}
                        {job.department && locale && (
                          <span aria-hidden className="text-ink-300">
                            ·
                          </span>
                        )}
                        {locale && <span>{locale}</span>}
                        {job.employmentType && (
                          <>
                            {(job.department || locale) && (
                              <span aria-hidden className="text-ink-300">
                                ·
                              </span>
                            )}
                            <span>{job.employmentType}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/careers/${job.id}`}
                      className="shrink-0 inline-flex justify-center items-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors"
                    >
                      View role
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CareersChrome>
  );
}
