import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createJob } from "../../actions";
import { HIRING_JOB_STATUSES, JOB_STATUS_LABEL } from "@/lib/hiring-copy";
import { WORK_ARRANGEMENT_OPTIONS } from "@/lib/hiring-job-copy";
import { firstSearchParam } from "@/lib/search-param";

type Props = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function NewHiringJobPage(props: Props) {
  const sp = await props.searchParams;
  const error = firstSearchParam(sp.error);
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, emoji: true },
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-8">
      <PageHeader
        title="New job opening"
        subtitle="Create a full posting for the ATS. You can still attach candidates and move them through the pipeline separately."
        action={
          <Link href="/hiring/jobs">
            <Button variant="outline" size="md">
              ← Jobs
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>
      )}

      <form action={createJob} className="rounded-2xl border border-ink-100 bg-white shadow-sm p-6 md:p-8 space-y-6">
        <div>
          <Label htmlFor="title">Job title</Label>
          <Input
            id="title"
            name="title"
            required
            placeholder="e.g. Senior Instructional Designer"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="departmentId">Department</Label>
          <Select id="departmentId" name="departmentId" defaultValue="" className="mt-1.5">
            <option value="">— Select department —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {(d.emoji ? `${d.emoji} ` : "") + d.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Location</div>
          <div>
            <Label htmlFor="workArrangement">Work arrangement</Label>
            <Select id="workArrangement" name="workArrangement" required defaultValue="HYBRID" className="mt-1.5">
              {WORK_ARRANGEMENT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-ink-400 mt-1.5">Remote, hybrid, or on-site — pick how this role is expected to work.</p>
          </div>
          <div>
            <Label htmlFor="location">City / region (optional for fully remote)</Label>
            <Input
              id="location"
              name="location"
              placeholder="e.g. Bengaluru, Mumbai, Pan-India"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="employmentType">Employment type</Label>
            <Input id="employmentType" name="employmentType" placeholder="Full-time, Contract, Intern…" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="openings">Number of openings</Label>
            <Input
              id="openings"
              name="openings"
              type="number"
              min={1}
              max={500}
              defaultValue={1}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="experienceRequired">Experience required</Label>
            <Input
              id="experienceRequired"
              name="experienceRequired"
              placeholder="e.g. 3–5 years in L&D"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="salaryRange">Salary range</Label>
            <Input
              id="salaryRange"
              name="salaryRange"
              placeholder="e.g. ₹8–12 LPA, Competitive + ESOP"
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="skillsRequired">Skills required</Label>
          <Textarea
            id="skillsRequired"
            name="skillsRequired"
            rows={4}
            placeholder="Tools, languages, certifications, must-have competencies…"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="description">Job description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Responsibilities, expectations, team context, benefits…"
            rows={8}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="applicationDeadline">Application deadline</Label>
          <Input id="applicationDeadline" name="applicationDeadline" type="date" className="mt-1.5 max-w-[240px]" />
          <p className="text-xs text-ink-400 mt-1.5">Last day you will accept applications for this posting (optional).</p>
        </div>

        <div>
          <Label htmlFor="status">Posting status</Label>
          <Select id="status" name="status" defaultValue="OPEN" className="mt-1.5">
            {HIRING_JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-ink-100">
          <Button type="submit" variant="accent">
            Save opening
          </Button>
          <Link href="/hiring/jobs">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
