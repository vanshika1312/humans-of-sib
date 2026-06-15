import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { displayName } from "@/lib/user-display-name";
import { Users, Building2, MapPin, IndianRupee, UserPlus, Clock } from "lucide-react";
import { AdminNoticeBanner } from "@/components/admin/admin-notice-banner";
import { firstSearchParam } from "@/lib/search-param";
import { isOnProbation, stripTime } from "@/lib/leave-policy";
import {
  AdminTeamProbationTabs,
  parseAdminTeamProbationFilter,
  type AdminTeamProbationFilter,
} from "./_components/admin-team-probation-tabs";

const ADMIN_ROLES = ["CEO", "ADMIN", "HR"];

type AdminSearchParams = Promise<{
  notice?: string | string[];
  mailError?: string | string[];
  probation?: string;
}>;

export default async function AdminPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const sp = await searchParams;
  const notice = firstSearchParam(sp.notice);
  const mailError = firstSearchParam(sp.mailError);
  const mailDetail =
    notice === "invite_failed" && mailError ? mailError : undefined;
  const probationFilter = parseAdminTeamProbationFilter(sp.probation);
  return (
    <div>
      <AdminNoticeBanner code={notice} detail={mailDetail} />
      <Suspense fallback={<RouteBodyFallback />}>
        <AdminPageBody probationFilter={probationFilter} />
      </Suspense>
    </div>
  );
}

function probationEndsWithinDays(probationEndsAt: Date, ref: Date, days: number): boolean {
  const end = stripTime(probationEndsAt).getTime();
  const now = stripTime(ref).getTime();
  const limit = now + days * 24 * 60 * 60 * 1000;
  return end >= now && end <= limit;
}

function matchesProbationFilter(
  probationEndsAt: Date | null,
  filter: AdminTeamProbationFilter,
  ref: Date,
): boolean {
  if (filter === "all") return true;
  const onProbation = isOnProbation(probationEndsAt, ref);
  return filter === "on" ? onProbation : !onProbation;
}

async function AdminPageBody({ probationFilter }: { probationFilter: AdminTeamProbationFilter }) {
  const me = await requireAppViewer();
  const canAccess = !!me && (ADMIN_ROLES.includes(me.role) || (me.permissions ?? []).includes("ADMIN_PANEL"));
  if (!canAccess) redirect("/home");

  const [users, depts, cities] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ status: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
      include: {
        department: true,
        city: true,
        compensation: true,
      },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.city.findMany({ orderBy: { name: "asc" } }),
  ]);

  const today = new Date();
  const active = users.filter((u) => u.status === "ACTIVE");
  const onProbationActive = active.filter((u) => isOnProbation(u.probationEndsAt, today));
  const probationCounts: Record<AdminTeamProbationFilter, number> = {
    all: users.length,
    on: users.filter((u) => isOnProbation(u.probationEndsAt, today)).length,
    confirmed: users.filter((u) => !isOnProbation(u.probationEndsAt, today)).length,
  };
  const filteredUsers = users.filter((u) => matchesProbationFilter(u.probationEndsAt, probationFilter, today));
  const isCeoOrAdmin = ["CEO", "ADMIN"].includes(me.role);
  const canWriteTeam = ADMIN_ROLES.includes(me.role) || (me.permissions ?? []).includes("ADMIN_TEAM_WRITE");

  return (
    <div>
      <PageHeader
        title="Admin Panel"
        emoji="🔐"
        subtitle="Manage team members, departments, and compensation."
        action={
          canWriteTeam ? (
            <Link href="/admin/team/new">
              <Button variant="accent">
                <UserPlus className="size-4" /> Add member
              </Button>
            </Link>
          ) : null
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon={<Users className="size-5" />} label="Total team" value={`${active.length}`} tone="sky" />
        <StatCard
          icon={<Clock className="size-5" />}
          label="On probation"
          value={`${onProbationActive.length}`}
          tone="orange"
          href={onProbationActive.length > 0 ? "/admin?probation=on" : undefined}
        />
        <StatCard icon={<Building2 className="size-5" />} label="Departments" value={`${depts.length}`} tone="orange" />
        <StatCard icon={<MapPin className="size-5" />} label="Cities" value={`${cities.length}`} tone="sun" />
        <StatCard
          icon={<IndianRupee className="size-5" />}
          label="On payroll"
          value={`${users.filter((u) => u.compensation).length}`}
          tone="ink"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3 h-full">
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
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3 h-full">
            <div>
              <div className="font-semibold text-ink-700">Weekly Pulse</div>
              <p className="text-sm text-ink-500 mt-0.5">
                Team participation, scores, and this week&apos;s question — no private comments.
              </p>
            </div>
            <Link href="/admin/pulse">
              <Button variant="outline">Open pulse</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3 h-full">
            <div>
              <div className="font-semibold text-ink-700">Work tracking</div>
              <p className="text-sm text-ink-500 mt-0.5">
                Cross-department efficiency, EOD compliance, and PIP thresholds.
              </p>
            </div>
            <Link href="/admin/work">
              <Button variant="outline">Open dashboard</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3 h-full">
            <div>
              <div className="font-semibold text-ink-700">Training library</div>
              <p className="text-sm text-ink-500 mt-0.5">
                Books, external courses, quizzes, and completion points.
              </p>
            </div>
            <Link href="/admin/trainings">
              <Button variant="outline">Manage trainings</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3 h-full">
            <div>
              <div className="font-semibold text-ink-700">LIA knowledge base</div>
              <p className="text-sm text-ink-500 mt-0.5">
                Edit core policy documents and articles LIA uses to answer members.
              </p>
            </div>
            <Link href="/admin/lia">
              <Button variant="outline">Manage LIA</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Team table */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {probationFilter === "all"
                ? `${active.length} active · ${users.length - active.length} others`
                : `${filteredUsers.length} shown · ${active.length} active total`}
            </CardDescription>
          </div>
          <AdminTeamProbationTabs active={probationFilter} counts={probationCounts} />
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
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Probation</th>
                  {isCeoOrAdmin && (
                    <th className="text-left px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Salary</th>
                  )}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={isCeoOrAdmin ? 9 : 8} className="px-5 py-10 text-center text-sm text-ink-400">
                      No team members match this probation filter.
                    </td>
                  </tr>
                ) : null}
                {filteredUsers.map((u) => {
                  const ud = displayName(u);
                  const onProbation = isOnProbation(u.probationEndsAt, today);
                  const endingSoon =
                    onProbation && u.probationEndsAt
                      ? probationEndsWithinDays(u.probationEndsAt, today, 30)
                      : false;
                  return (
                  <tr key={u.id} className="hover:bg-ink-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.image} name={ud} size="sm" />
                        <div>
                          <div className="font-medium text-ink-700">{ud}</div>
                          <div className="text-xs text-ink-400">{u.email}</div>
                          {u.invitationPending && (
                            <div className="text-[10px] font-medium text-amber-700">Awaiting onboarding</div>
                          )}
                          {u.employeeCode && (
                            <div className="text-[10px] text-ink-400">{u.employeeCode}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {u.department ? `${u.department.emoji ?? ""} ${u.department.name}`.trim() : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-ink-600">{u.city?.name || <span className="text-ink-300">—</span>}</td>
                    <td className="px-5 py-3">
                      <Badge tone={u.role === "CEO" ? "orange" : u.role === "ADMIN" || u.role === "HR" ? "sky" : "ink"}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-ink-500 text-xs">{formatDate(u.joinedAt)}</td>
                    <td className="px-5 py-3">
                      {onProbation ? (
                        <div>
                          <Badge tone="orange">On probation</Badge>
                          {u.probationEndsAt ? (
                            <div className="text-xs text-ink-500 mt-1">
                              Until {formatDate(u.probationEndsAt)}
                              {endingSoon ? (
                                <span className="block text-[10px] font-medium text-amber-700 mt-0.5">
                                  Ends within 30 days
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <Badge tone="green">Confirmed</Badge>
                      )}
                    </td>
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
                      {canWriteTeam ? (
                        <Link href={`/admin/team/${u.id}`}>
                          <Button size="sm" variant="outline">Edit</Button>
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "sky" | "orange" | "sun" | "ink";
  href?: string;
}) {
  const toneClass = {
    sky: "text-sky-600 bg-sky-50",
    orange: "text-orange-600 bg-orange-50",
    sun: "text-sun-600 bg-sun-50",
    ink: "text-ink-600 bg-ink-100",
  }[tone];
  const inner = (
    <>
      <div className={`size-8 rounded-md inline-flex items-center justify-center ${toneClass}`}>{icon}</div>
      <div className="mt-2 text-xs text-ink-400">{label}</div>
      <div className="text-xl font-bold text-ink-700">{value}</div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block p-4 rounded-xl border border-ink-100 bg-white hover:border-orange-200 hover:bg-orange-50/30 transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return <div className="p-4 rounded-xl border border-ink-100 bg-white">{inner}</div>;
}
