import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Select, Label, Textarea } from "@/components/ui/input";
import { updateMember, resendOnboardingInvite } from "../../actions";
import { AdminNoticeBanner } from "@/components/admin/admin-notice-banner";
import { displayName } from "@/lib/user-display-name";
import { firstSearchParam } from "@/lib/search-param";

const ADMIN_ROLES = ["CEO", "ADMIN", "HR"];

function genderLabel(g: string | null | undefined) {
  if (!g) return "";
  const m: Record<string, string> = {
    MALE: "Male",
    FEMALE: "Female",
    NON_BINARY: "Non-binary",
    PREFER_NOT_TO_SAY: "Prefer not to say",
  };
  return m[g] ?? g;
}

export default async function EditMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string | string[]; mailError?: string | string[] }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const notice = firstSearchParam(sp.notice);
  const mailError = firstSearchParam(sp.mailError);
  const mailDetail =
    notice === "invite_failed" && mailError ? mailError : undefined;
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/home");

  const [member, depts, cities, managersRaw] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { department: true, city: true, compensation: true },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.city.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { status: "ACTIVE", id: { not: id } },
      select: { id: true, name: true, firstName: true, lastName: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!member) notFound();

  const managers = managersRaw.sort((a, b) =>
    (a.name || `${a.firstName} ${a.lastName}` || a.email).localeCompare(
      b.name || `${b.firstName} ${b.lastName}` || b.email,
    ),
  );

  const isCeoOrAdmin = ["CEO", "ADMIN"].includes(me.role);
  const action = updateMember.bind(null, id);
  const resend = resendOnboardingInvite.bind(null, id);
  const dn = displayName(member);

  return (
    <div className="max-w-2xl mx-auto">
      <AdminNoticeBanner code={notice} detail={mailDetail} />

      <PageHeader title="Edit Member" emoji="✏️" subtitle={`Editing ${dn}`} />

      <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-ink-50 border border-ink-100">
        <Avatar src={member.image} name={dn} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink-700">{dn}</div>
          <div className="text-sm text-ink-400 truncate">{member.email}</div>
          {member.employeeCode && (
            <div className="text-xs text-ink-500 mt-1">ID {member.employeeCode}</div>
          )}
          {member.invitationPending && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                Awaiting employee onboarding
              </span>
              <form action={resend}>
                <Button type="submit" variant="outline" className="text-xs h-8">
                  Resend invite email
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={action} className="space-y-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-400">HR-maintained</div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" defaultValue={member.firstName || ""} required />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" defaultValue={member.lastName || ""} required />
              </div>
            </div>

            <div>
              <Label>Official email</Label>
              <Input value={member.email} readOnly className="bg-ink-50 text-ink-500 cursor-not-allowed" />
              <p className="text-xs text-ink-400 mt-1">Sign-in identifier — change only via support / DB if needed.</p>
            </div>

            {member.employeeCode && (
              <div>
                <Label>Employee ID</Label>
                <Input value={member.employeeCode} readOnly className="bg-ink-50 text-ink-500 cursor-not-allowed" />
              </div>
            )}

            <div>
              <Label htmlFor="title">Job title</Label>
              <Input id="title" name="title" defaultValue={member.title || ""} placeholder="e.g. Sales Manager" />
            </div>

            <div>
              <Label htmlFor="phone">Work phone</Label>
              <Input id="phone" name="phone" defaultValue={member.phone || ""} placeholder="+91 98765 43210" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Role / access</Label>
                <Select id="role" name="role" defaultValue={member.role}>
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
                <Select id="status" name="status" defaultValue={member.status}>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On leave</option>
                  <option value="NOTICE_PERIOD">Notice period</option>
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
                    <option key={d.id} value={d.id}>
                      {d.emoji} {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="managerId">Manager</Label>
                <Select id="managerId" name="managerId" defaultValue={member.managerId || ""}>
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
                <Label htmlFor="joinedAt">Date of joining</Label>
                <Input
                  id="joinedAt"
                  name="joinedAt"
                  type="date"
                  defaultValue={member.joinedAt ? new Date(member.joinedAt).toISOString().split("T")[0] : ""}
                />
              </div>
              <div>
                <Label htmlFor="dateOfLeaving">Date of leaving</Label>
                <Input
                  id="dateOfLeaving"
                  name="dateOfLeaving"
                  type="date"
                  defaultValue={
                    member.dateOfLeaving
                      ? new Date(member.dateOfLeaving).toISOString().split("T")[0]
                      : ""
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="probationEndsAt">Probation ends (last day, inclusive)</Label>
              <Input
                id="probationEndsAt"
                name="probationEndsAt"
                type="date"
                defaultValue={
                  member.probationEndsAt ? new Date(member.probationEndsAt).toISOString().split("T")[0] : ""
                }
              />
              <p className="text-xs text-ink-400 mt-1">
                Leave blank once probation is cleared — paid casual/sick only apply after this date.
              </p>
            </div>

            {isCeoOrAdmin && (
              <div className="border-t border-ink-100 pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-ink-700">Compensation</span>
                  <span className="text-xs text-ink-400 bg-ink-100 px-2 py-0.5 rounded-full">
                    CEO / Admin only; HR can view on People.
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="salary">Monthly salary (₹)</Label>
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

            <div className="border-t border-ink-100 pt-5 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                Employee / onboarding (HR can correct)
              </div>
              <p className="text-xs text-ink-400 -mt-1">
                Normally completed by the employee via their invite link. Visibility on People follows role rules.
              </p>

              <div>
                <Label htmlFor="personalEmail">Personal email</Label>
                <Input
                  id="personalEmail"
                  name="personalEmail"
                  type="email"
                  defaultValue={member.personalEmail || ""}
                  placeholder="personal email"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="birthday">Date of birth</Label>
                  <Input
                    id="birthday"
                    name="birthday"
                    type="date"
                    defaultValue={
                      member.birthday ? new Date(member.birthday).toISOString().split("T")[0] : ""
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select id="gender" name="gender" defaultValue={member.gender ?? ""}>
                    <option value="">—</option>
                    <option value="MALE">{genderLabel("MALE")}</option>
                    <option value="FEMALE">{genderLabel("FEMALE")}</option>
                    <option value="NON_BINARY">{genderLabel("NON_BINARY")}</option>
                    <option value="PREFER_NOT_TO_SAY">{genderLabel("PREFER_NOT_TO_SAY")}</option>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="cityId">City / location</Label>
                <Select id="cityId" name="cityId" defaultValue={member.cityId || ""}>
                  <option value="">— No city —</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.isHQ ? " (HQ)" : ""}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pan">PAN</Label>
                  <Input id="pan" name="pan" defaultValue={member.pan || ""} maxLength={10} />
                </div>
                <div>
                  <Label htmlFor="aadhar">Aadhaar</Label>
                  <Input id="aadhar" name="aadhar" defaultValue={member.aadhar || ""} maxLength={12} />
                </div>
              </div>

              <div>
                <Label htmlFor="residentialAddress">Residential address</Label>
                <Textarea
                  id="residentialAddress"
                  name="residentialAddress"
                  defaultValue={member.residentialAddress || ""}
                  placeholder="Full postal address"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergencyContactName">Emergency contact name</Label>
                  <Input
                    id="emergencyContactName"
                    name="emergencyContactName"
                    defaultValue={member.emergencyContactName || ""}
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyContactPhone">Emergency contact phone</Label>
                  <Input
                    id="emergencyContactPhone"
                    name="emergencyContactPhone"
                    defaultValue={member.emergencyContactPhone || ""}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="emergencyContactRelation">Relationship</Label>
                <Input
                  id="emergencyContactRelation"
                  name="emergencyContactRelation"
                  defaultValue={member.emergencyContactRelation || ""}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fatherName">Father&apos;s name</Label>
                  <Input id="fatherName" name="fatherName" defaultValue={member.fatherName || ""} />
                </div>
                <div>
                  <Label htmlFor="motherName">Mother&apos;s name</Label>
                  <Input id="motherName" name="motherName" defaultValue={member.motherName || ""} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link href="/admin" className="text-sm text-ink-400 hover:text-ink-600">
                ← Back
              </Link>
              <Button type="submit" variant="accent">
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
