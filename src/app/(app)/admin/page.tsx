import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Users, Building2, MapPin, IndianRupee, UserPlus } from "lucide-react";
import { AdminNoticeBanner } from "@/components/admin/admin-notice-banner";

const ADMIN_ROLES = ["CEO", "ADMIN", "HR"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/home");

  const [users, depts, cities] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        department: true,
        city: true,
        compensation: true,
      },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.city.findMany({ orderBy: { name: "asc" } }),
  ]);

  const active = users.filter((u) => u.status === "ACTIVE");
  const isCeoOrAdmin = ["CEO", "ADMIN"].includes(me.role);

  return (
    <div>
      <AdminNoticeBanner code={notice} />

      <PageHeader
        title="Admin Panel"
        emoji="🔐"
        subtitle="Manage team members, departments, and compensation."
        action={
          <Link href="/admin/team/new">
            <Button variant="accent"><UserPlus className="size-4" /> Add member</Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<Users className="size-5" />} label="Total team" value={`${active.length}`} tone="sky" />
        <StatCard icon={<Building2 className="size-5" />} label="Departments" value={`${depts.length}`} tone="orange" />
        <StatCard icon={<MapPin className="size-5" />} label="Cities" value={`${cities.length}`} tone="sun" />
        <StatCard
          icon={<IndianRupee className="size-5" />}
          label="On payroll"
          value={`${users.filter((u) => u.compensation).length}`}
          tone="ink"
        />
      </div>

      <Card className="mb-6">
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-ink-700">Attendance for payroll</div>
            <p className="text-sm text-ink-500 mt-0.5">
              Export everyone&apos;s monthly punches and approved leave weekdays as CSV.
            </p>
          </div>
          <Link href="/admin/attendance-report">
            <Button variant="outline">Open report</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Team table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>{active.length} active · {users.length - active.length} others</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Member</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Department</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">City</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Joined</th>
                  {isCeoOrAdmin && (
                    <th className="text-left px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Salary</th>
                  )}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-ink-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.image} name={u.name} size="sm" />
                        <div>
                          <div className="font-medium text-ink-700">{u.name || "—"}</div>
                          <div className="text-xs text-ink-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {u.department ? `${u.department.emoji} ${u.department.name}` : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-ink-600">{u.city?.name || <span className="text-ink-300">—</span>}</td>
                    <td className="px-5 py-3">
                      <Badge tone={u.role === "CEO" ? "orange" : u.role === "ADMIN" || u.role === "HR" ? "sky" : "ink"}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-ink-500 text-xs">{formatDate(u.joinedAt)}</td>
                    {isCeoOrAdmin && (
                      <td className="px-5 py-3 text-ink-600 font-medium">
                        {u.compensation
                          ? `₹${u.compensation.monthlySalary.toLocaleString("en-IN")}`
                          : <span className="text-ink-300 text-xs">Not set</span>}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <Badge tone={u.status === "ACTIVE" ? "green" : u.status === "EXITED" ? "orange" : "ink"}>
                        {u.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/admin/team/${u.id}`}>
                        <Button size="sm" variant="outline">Edit</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "sky" | "orange" | "sun" | "ink" }) {
  const toneClass = {
    sky: "text-sky-600 bg-sky-50",
    orange: "text-orange-600 bg-orange-50",
    sun: "text-sun-600 bg-sun-50",
    ink: "text-ink-600 bg-ink-100",
  }[tone];
  return (
    <div className="p-4 rounded-xl border border-ink-100 bg-white">
      <div className={`size-8 rounded-md inline-flex items-center justify-center ${toneClass}`}>{icon}</div>
      <div className="mt-2 text-xs text-ink-400">{label}</div>
      <div className="text-xl font-bold text-ink-700">{value}</div>
    </div>
  );
}
