import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { DepartmentNameField } from "@/components/workspace/department-name-field";
import { createMember } from "../../actions";
import { AdminNoticeBanner } from "@/components/admin/admin-notice-banner";

const ADMIN_ROLES = ["CEO", "ADMIN", "HR"];

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  return (
    <div className="max-w-2xl mx-auto">
      <AdminNoticeBanner code={notice} />
      <Suspense fallback={<RouteBodyFallback />}>
        <NewMemberPageBody />
      </Suspense>
    </div>
  );
}

async function NewMemberPageBody() {
  const me = await requireAppViewer();
  const canWriteTeam = !!me && (ADMIN_ROLES.includes(me.role) || (me.permissions ?? []).includes("ADMIN_TEAM_WRITE"));
  if (!canWriteTeam) redirect("/home");

  const [managersRaw] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, firstName: true, lastName: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const managers = managersRaw.sort((a, b) =>
    (a.name || `${a.firstName} ${a.lastName}` || a.email).localeCompare(
      b.name || `${b.firstName} ${b.lastName}` || b.email,
    ),
  );

  const isCeoOrAdmin = ["CEO", "ADMIN"].includes(me.role);

  return (
    <>
      <PageHeader
        title="Add Team Member"
        emoji="👤"
        subtitle="HR enters official details. We email a secure link so they can complete their own profile, then sign in with Google."
      />

      <Card>
        <CardContent className="pt-6">
          <form action={createMember} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First name *</Label>
                <Input id="firstName" name="firstName" required placeholder="Ananya" />
              </div>
              <div>
                <Label htmlFor="lastName">Last name *</Label>
                <Input id="lastName" name="lastName" required placeholder="Sharma" />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Official email (work) *</Label>
              <Input id="email" name="email" type="email" required placeholder="ananya@skillinabox.in" />
              <p className="text-xs text-ink-400 mt-1">They&apos;ll use this with Google to sign in after onboarding.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Job title</Label>
                <Input id="title" name="title" placeholder="e.g. Sales Manager" />
              </div>
              <div>
                <Label htmlFor="phone">Work phone</Label>
                <Input id="phone" name="phone" placeholder="+91 98765 43210" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Role / access *</Label>
                <Select id="role" name="role" defaultValue="EMPLOYEE" required>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="DEPT_HEAD">Department head</option>
                  <option value="HR">HR</option>
                  <option value="ADMIN">Admin</option>
                  <option value="CEO">CEO</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue="ACTIVE">
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On leave</option>
                  <option value="NOTICE_PERIOD">Notice period</option>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <DepartmentNameField placeholder="Sales, Marketing…" />
              <div>
                <Label htmlFor="managerId">Manager</Label>
                <Select id="managerId" name="managerId" defaultValue="">
                  <option value="">— No manager —</option>
                  {managers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="joinedAt">Date of joining *</Label>
                <Input
                  id="joinedAt"
                  name="joinedAt"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dateOfLeaving">Date of leaving</Label>
                <Input id="dateOfLeaving" name="dateOfLeaving" type="date" />
                <p className="text-xs text-ink-400 mt-1">If known (e.g. fixed-term or exit).</p>
              </div>
            </div>

            <p className="text-xs text-ink-500 bg-ink-50 border border-ink-100 rounded-lg px-3 py-2">
              Employee ID is assigned automatically. Personal details (DOB, PAN, Aadhaar, personal email, parents,
              emergency contact, home address, location) are filled in by the employee on first sign-in — we also email
              an optional link they can use beforehand.
            </p>

            {isCeoOrAdmin && (
              <div className="border-t border-ink-100 pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-ink-700">Compensation</span>
                  <span className="text-xs text-ink-400 bg-ink-100 px-2 py-0.5 rounded-full">
                    CEO / Admin only; HR can view later on People.
                  </span>
                </div>
                <div>
                  <Label htmlFor="salary">Monthly salary (₹)</Label>
                  <Input id="salary" name="salary" type="number" placeholder="e.g. 35000" min="0" />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Link href="/admin" className="text-sm text-ink-400 hover:text-ink-600">
                ← Cancel
              </Link>
              <Button type="submit" variant="accent">
                Create &amp; send invite →
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
