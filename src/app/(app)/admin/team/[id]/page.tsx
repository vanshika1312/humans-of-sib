import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { updateMember } from "../../actions";

const ADMIN_ROLES = ["CEO", "ADMIN", "HR"];

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/home");

  const [member, depts, cities] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { department: true, city: true, compensation: true },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.city.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!member) notFound();

  const isCeoOrAdmin = ["CEO", "ADMIN"].includes(me.role);
  const action = updateMember.bind(null, id);

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Edit Member" emoji="✏️" subtitle={`Editing details for ${member.name || member.email}`} />

      {/* Member header */}
      <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-ink-50 border border-ink-100">
        <Avatar src={member.image} name={member.name} size="lg" />
        <div>
          <div className="font-semibold text-ink-700">{member.name || "—"}</div>
          <div className="text-sm text-ink-400">{member.email}</div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={action} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" defaultValue={member.name || ""} required />
              </div>
              <div>
                <Label htmlFor="title">Job Title</Label>
                <Input id="title" name="title" defaultValue={member.title || ""} placeholder="e.g. Sales Manager" />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={member.phone || ""} placeholder="+91 98765 43210" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Role / Access Level</Label>
                <Select id="role" name="role" defaultValue={member.role}>
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
                <Select id="status" name="status" defaultValue={member.status}>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="NOTICE_PERIOD">Notice Period</option>
                  <option value="EXITED">Exited</option>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="departmentId">Department</Label>
                <Select id="departmentId" name="departmentId" defaultValue={member.departmentId || ""}>
                  <option value="">— No department —</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="cityId">City / Location</Label>
                <Select id="cityId" name="cityId" defaultValue={member.cityId || ""}>
                  <option value="">— No city —</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.isHQ ? " (HQ)" : ""}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="joinedAt">Joining Date</Label>
              <Input
                id="joinedAt"
                name="joinedAt"
                type="date"
                defaultValue={member.joinedAt ? new Date(member.joinedAt).toISOString().split("T")[0] : ""}
              />
            </div>

            {isCeoOrAdmin && (
              <div className="border-t border-ink-100 pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-ink-700">💰 Compensation</span>
                  <span className="text-xs text-ink-400 bg-ink-100 px-2 py-0.5 rounded-full">Only visible to you + the employee</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="salary">Monthly Salary (₹)</Label>
                    <Input
                      id="salary"
                      name="salary"
                      type="number"
                      min="0"
                      defaultValue={member.compensation?.monthlySalary || ""}
                      placeholder="e.g. 35000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="salaryNote">Note</Label>
                    <Input
                      id="salaryNote"
                      name="salaryNote"
                      defaultValue={member.compensation?.note || ""}
                      placeholder="e.g. Post-appraisal Apr 2026"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Link href="/admin" className="text-sm text-ink-400 hover:text-ink-600">← Back</Link>
              <Button type="submit" variant="accent">Save changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
