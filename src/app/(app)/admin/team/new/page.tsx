import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { createMember } from "../../actions";
import { AdminNoticeBanner } from "@/components/admin/admin-notice-banner";

const ADMIN_ROLES = ["CEO", "ADMIN", "HR"];

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/home");

  const [depts, cities] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.city.findMany({ orderBy: { name: "asc" } }),
  ]);

  const isCeoOrAdmin = ["CEO", "ADMIN"].includes(me.role);

  return (
    <div className="max-w-2xl mx-auto">
      <AdminNoticeBanner code={notice} />

      <PageHeader title="Add Team Member" emoji="👤" subtitle="Add a new person to Humans of SIB. They can sign in once added." />

      <Card>
        <CardContent className="pt-6">
          <form action={createMember} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" name="name" required placeholder="e.g. Ananya Sharma" />
              </div>
              <div>
                <Label htmlFor="email">Work Email *</Label>
                <Input id="email" name="email" type="email" required placeholder="ananya@skillinabox.in" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Job Title</Label>
                <Input id="title" name="title" placeholder="e.g. Sales Manager" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" placeholder="+91 98765 43210" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Role / Access Level *</Label>
                <Select id="role" name="role" defaultValue="EMPLOYEE" required>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="DEPT_HEAD">Department Head</option>
                  <option value="HR">HR</option>
                  <option value="ADMIN">Admin</option>
                  <option value="CEO">CEO</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue="ACTIVE">
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="NOTICE_PERIOD">Notice Period</option>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="departmentId">Department</Label>
                <Select id="departmentId" name="departmentId">
                  <option value="">— No department —</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="cityId">City / Location</Label>
                <Select id="cityId" name="cityId">
                  <option value="">— No city —</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.isHQ ? " (HQ)" : ""}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="joinedAt">Joining Date</Label>
              <Input id="joinedAt" name="joinedAt" type="date" defaultValue={new Date().toISOString().split("T")[0]} />
            </div>

            {isCeoOrAdmin && (
              <div className="border-t border-ink-100 pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-ink-700">💰 Compensation</span>
                  <span className="text-xs text-ink-400 bg-ink-100 px-2 py-0.5 rounded-full">Only visible to you + the employee</span>
                </div>
                <div>
                  <Label htmlFor="salary">Monthly Salary (₹)</Label>
                  <Input id="salary" name="salary" type="number" placeholder="e.g. 35000" min="0" />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Link href="/admin" className="text-sm text-ink-400 hover:text-ink-600">← Cancel</Link>
              <Button type="submit" variant="accent">Add to team →</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
