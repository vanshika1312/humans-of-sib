import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createJob } from "../../actions";
import { HIRING_JOB_STATUSES, JOB_STATUS_LABEL } from "@/lib/hiring-copy";
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
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="New opening"
        subtitle="Adds a canonical job posting for your ATS. Candidates are linked separately, then dropped into stages on Pipeline."
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

      <form action={createJob} className="rounded-2xl border border-ink-100 bg-white shadow-sm p-6 space-y-5">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required placeholder="e.g. Senior Instructional Designer" className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="departmentId">Department (optional)</Label>
          <Select id="departmentId" name="departmentId" defaultValue="" className="mt-1.5">
            <option value="">— Any / TBD —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {(d.emoji ? `${d.emoji} ` : "") + d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="employmentType">Employment type</Label>
            <Input id="employmentType" name="employmentType" placeholder="Full-time, Contract…" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" placeholder="Bengaluru, Remote IST…" className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue="OPEN" className="mt-1.5">
            {HIRING_JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Brief scope, grade, stakeholders, must-have skills."
            rows={6}
            className="mt-1.5"
          />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" variant="accent">
            Publish opening
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
