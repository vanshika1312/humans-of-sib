import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { DepartmentNameField } from "@/components/workspace/department-name-field";
import { submitJobRequisition } from "../actions";
import { canPickDepartmentOnRequisition, canSubmitJobRequisition } from "@/lib/hiring-requisition-access";
import { firstSearchParam } from "@/lib/search-param";

type Props = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function NewRequisitionPage(props: Props) {
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <NewRequisitionPageBody flashError={flashError} />
    </Suspense>
  );
}

async function NewRequisitionPageBody({ flashError }: { flashError: string | undefined }) {
  const me = await requireAppViewer();
  if (!me || !canSubmitJobRequisition(me.role)) redirect("/home");

  const pickDept = canPickDepartmentOnRequisition(me.role);

  const deptLabel =
    me.role === "DEPT_HEAD" && me.headedDept
      ? `${me.headedDept.emoji ?? ""} ${me.headedDept.name}`.trim()
      : me.department
        ? `${me.department.emoji ?? ""} ${me.department.name}`.trim()
        : null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Request headcount"
        subtitle="Describe the role and business need. HR will review on the Hiring dashboard and can publish a posting when approved."
        action={
          <Link href="/requisitions">
            <Button variant="outline" size="md">
              My requests →
            </Button>
          </Link>
        }
      />

      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(flashError)}
        </div>
      )}

      {!pickDept && deptLabel && (
        <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-ink-700">
          This request will be attributed to <strong>{deptLabel}</strong>.
        </div>
      )}

      <form action={submitJobRequisition} className="rounded-2xl border border-ink-100 bg-white shadow-sm p-6 space-y-5">
        {pickDept && <DepartmentNameField label="Department" required placeholder="Which team is this for?" />}

        <div>
          <Label htmlFor="title">Role title</Label>
          <Input id="title" name="title" required placeholder="e.g. Senior Graphic Designer" className="mt-1.5" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="positions">Number of hires</Label>
            <Input
              id="positions"
              name="positions"
              type="number"
              min={1}
              max={99}
              defaultValue={1}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="employmentType">Employment type</Label>
            <Input id="employmentType" name="employmentType" placeholder="Full-time, Contract…" className="mt-1.5" />
          </div>
        </div>

        <div>
          <Label htmlFor="location">Preferred location</Label>
          <Input id="location" name="location" placeholder="Hybrid · Bengaluru" className="mt-1.5" />
        </div>

        <div>
          <Label htmlFor="skillsRequired">Skills &amp; qualifications required</Label>
          <Textarea
            id="skillsRequired"
            name="skillsRequired"
            rows={4}
            placeholder="Degrees, certifications, tools, years of experience, soft skills…"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="proposedDeadline">Proposed deadline</Label>
          <Input id="proposedDeadline" name="proposedDeadline" type="date" className="mt-1.5 max-w-[220px]" />
          <p className="text-xs text-ink-400 mt-1.5">Target date by which you aim to have this role filled or interviews completed.</p>
        </div>

        <div>
          <Label htmlFor="description">Role summary</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            placeholder="Scope, seniority, reporting line — use Skills &amp; qualifications for must-haves."
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="justification">Business justification</Label>
          <Textarea
            id="justification"
            name="justification"
            rows={3}
            placeholder="Why now? Impact if unfilled?"
            className="mt-1.5"
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" variant="accent">
            Submit for HR approval
          </Button>
          <Link href="/requisitions">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
