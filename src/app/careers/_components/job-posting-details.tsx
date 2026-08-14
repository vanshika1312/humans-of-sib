import { WORK_ARRANGEMENT_LABEL } from "@/lib/hiring-job-copy";
import { formatCalendarDate } from "@/lib/calendar-date";
import type { HiringJobWorkArrangement } from "@/generated/prisma";
import { JobDescriptionBody } from "@/components/hiring/job-description-body";

export type PublicJobPosting = {
  title: string;
  description: string | null;
  employmentType: string | null;
  location: string | null;
  workArrangement: HiringJobWorkArrangement | null;
  experienceRequired: string | null;
  salaryRange: string | null;
  skillsRequired: string | null;
  applicationDeadline: Date | null;
  openings: number;
  department: { name: string; emoji: string | null } | null;
  _count?: { applicationQuestions: number };
};

export const PUBLIC_JOB_POSTING_SELECT = {
  id: true,
  title: true,
  description: true,
  employmentType: true,
  location: true,
  workArrangement: true,
  experienceRequired: true,
  salaryRange: true,
  skillsRequired: true,
  applicationDeadline: true,
  openings: true,
  department: { select: { name: true, emoji: true } },
  _count: { select: { applicationQuestions: true } },
} as const;

export function jobLocaleLine(job: Pick<PublicJobPosting, "workArrangement" | "location">): string | null {
  const bits = [
    job.workArrangement ? WORK_ARRANGEMENT_LABEL[job.workArrangement] : null,
    job.location?.trim() || null,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

export function JobPostingDetails({ job }: { job: PublicJobPosting }) {
  const locale = jobLocaleLine(job);
  const facts: { label: string; value: string }[] = [];
  if (job.experienceRequired?.trim()) facts.push({ label: "Experience", value: job.experienceRequired.trim() });
  if (job.salaryRange?.trim()) facts.push({ label: "Compensation", value: job.salaryRange.trim() });
  if (job.openings > 1) facts.push({ label: "Openings", value: String(job.openings) });
  if (job.applicationDeadline) {
    facts.push({ label: "Apply by", value: formatCalendarDate(job.applicationDeadline) });
  }
  const questionCount = job._count?.applicationQuestions ?? 0;
  if (questionCount > 0) {
    facts.push({
      label: "Application form",
      value: `${questionCount} extra question${questionCount === 1 ? "" : "s"}`,
    });
  }

  return (
    <div className="space-y-5">
      <div className="text-sm text-ink-500 flex flex-wrap gap-x-2 gap-y-1">
        {job.department && (
          <span>
            {job.department.emoji} {job.department.name}
          </span>
        )}
        {job.department && locale && <span aria-hidden>·</span>}
        {locale && <span>{locale}</span>}
        {job.employmentType && (
          <>
            <span aria-hidden>·</span>
            <span>{job.employmentType}</span>
          </>
        )}
      </div>

      {facts.length > 0 ? (
        <dl className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{f.label}</dt>
              <dd className="text-sm text-ink-700 mt-0.5 whitespace-pre-wrap">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {job.description?.trim() ? (
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink-800 mb-3">Role description</h2>
          <JobDescriptionBody text={job.description} className="text-sm text-ink-700" />
        </div>
      ) : null}

      {job.skillsRequired?.trim() ? (
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-ink-800 mb-2">Skills</h2>
          <p className="text-sm text-ink-600 whitespace-pre-wrap">{job.skillsRequired}</p>
        </div>
      ) : null}
    </div>
  );
}
