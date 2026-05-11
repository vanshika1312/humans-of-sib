import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { submitJobRequisition } from "../actions";
import { canPickDepartmentOnRequisition, canSubmitJobRequisition } from "@/lib/hiring-requisition-access";
import { firstSearchParam } from "@/lib/search-param";

type Props = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function NewRequisitionPage(props: Props) {
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);

  const session = await auth();
  const me = await prisma.user.findUnique({
    where: { email: session!.user!.email! },
    include: {
      headedDept: { select: { id: true, name: true, emoji: true } },
      department: { select: { id: true, name: true, emoji: true } },
    },
  });
  if (!me || !canSubmitJobRequisition(me.role)) redirect("/home");

  const pickDept = canPickDepartmentOnRequisition(me.role);
  const departments = pickDept
    ? await prisma.department.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, emoji: true },
      })
    : [];

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
        {pickDept && (
          <div>
            <Label htmlFor="departmentId">Department</Label>
            <Select id="departmentId" name="departmentId" required className="mt-1.5">
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {(d.emoji ? `${d.emoji} ` : "") + d.name}
                </option>
              ))}
            </Select>
          </div>
        )}

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
          <Label htmlFor="description">Role summary</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            placeholder="What they'll own, seniority, must-have skills, reporting line."
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
