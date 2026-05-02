import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { grantRecruitmentAccess, updateWorkspaceAdminRole } from "../actions";

const RECRUITER_ROLES = ["CEO", "ADMIN", "HR"];

type SearchProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function RecruitmentAccessPage(props: SearchProps) {
  const searchParams = await props.searchParams;
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !RECRUITER_ROLES.includes(me.role)) redirect("/home");

  const canPromoteAdmin = me.role === "CEO" || me.role === "ADMIN";

  const [workspaceAdmins, grantCandidates] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["CEO", "ADMIN", "HR"] } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: { notIn: ["CEO", "ADMIN", "HR"] },
        status: { not: "EXITED" },
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  const flashError = searchParams.error ? decodeURIComponent(searchParams.error) : null;
  const flashSaved = searchParams.saved === "1";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <PageHeader
        title="Dashboard access"
        emoji="🔑"
        subtitle="Choose who can open the recruitment workspace. Admin and HR are global roles—they also inherit admin panel permissions like the rest of the app."
        action={
          <Link href="/recruitment">
            <Button variant="outline" size="md">
              ← Overview
            </Button>
          </Link>
        }
      />

      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flashError}</div>
      )}
      {flashSaved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved. Their next sign-in will use the updated access.
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-ink-100 bg-ink-50/60">
          <CardTitle className="text-ink-700">Grant access</CardTitle>
          <CardDescription className="text-ink-500">
            Pick someone already on the roster.
            {canPromoteAdmin ? (
              <>
                {" "}
                Assign <strong>Admin</strong> for full team management (including payouts for CEO/Admin) or{" "}
                <strong>HR</strong> for HRMS and recruiter tools without salary fields.
              </>
            ) : (
              <>
                {" "}
                You can grant <strong>HR</strong> only — ask CEO or an Admin if someone needs workspace Admin.
              </>
            )}
            {" "}
            Brand-new hire?{' '}
            <Link href="/admin/team/new" className="font-medium text-sky-700 underline-offset-4 hover:underline">
              Create their profile first
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {grantCandidates.length === 0 ? (
            <p className="text-sm text-ink-500">Everyone on the roster already has recruiter-level access—or there are no active members.</p>
          ) : (
            <form action={grantRecruitmentAccess} className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-4">
              <div className="flex-1 min-w-[220px]">
                <Label htmlFor="grant-user">Team member</Label>
                <Select id="grant-user" name="userId" required className="w-full mt-1.5">
                  <option value="">Select person…</option>
                  {grantCandidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.name || u.email) + ` · ${u.role.replace("_", " ")}`}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-full sm:w-44">
                <Label htmlFor="grant-role">Access role</Label>
                <Select id="grant-role" name="role" required className="w-full mt-1.5" defaultValue="HR">
                  <option value="HR">HR</option>
                  {canPromoteAdmin && <option value="ADMIN">Admin</option>}
                </Select>
              </div>
              <Button type="submit" variant="accent" className="w-full sm:w-auto shrink-0">
                Grant access
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-ink-100">
          <CardTitle className="text-ink-700">People with access</CardTitle>
          <CardDescription className="text-ink-500">
            Admin and HR see this recruitment area and the Manage Team admin tools. CEO is always included.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3">Person</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3 w-[280px]">Change role</th>
                  <th className="px-5 py-3 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {workspaceAdmins.map((row) => {
                  const readonlyCeo = row.role === "CEO";
                  const meRow = row.id === me.id;
                  const hrCannotEditAdmin = me.role === "HR" && row.role === "ADMIN";
                  const readOnlyRow = readonlyCeo || hrCannotEditAdmin;

                  const update = updateWorkspaceAdminRole.bind(null, row.id);

                  return (
                    <tr key={row.id} className="hover:bg-ink-50/40 transition-colors align-middle">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={row.image} name={row.name} size="sm" />
                          <div>
                            <div className="font-medium text-ink-700">{row.name || "—"}</div>
                            <div className="text-xs text-ink-400">{row.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={roleBadgeTone(row.role)}>{row.role.replace("_", " ")}</Badge>
                        {meRow && <span className="ml-2 text-[11px] text-ink-400">you</span>}
                      </td>
                      <td className="px-5 py-3">
                        {readOnlyRow ? (
                          <span className="text-ink-400 text-xs">
                            {readonlyCeo ? "Locked (CEO)" : "Ask CEO / Admin"}
                          </span>
                        ) : (
                          <form action={update} className="flex flex-wrap items-center gap-2">
                            <Select name="role" defaultValue={row.role === "ADMIN" ? "ADMIN" : "HR"} className="min-w-[160px]">
                              <option value="HR">HR</option>
                              {canPromoteAdmin && <option value="ADMIN">Admin</option>}
                              <option value="EMPLOYEE">Employee — remove recruiter access</option>
                            </Select>
                            <Button type="submit" size="sm" variant="outline">
                              Save
                            </Button>
                          </form>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/admin/team/${row.id}`} className="text-xs font-medium text-sky-700 hover:underline">
                          Profile
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!canPromoteAdmin && (
            <p className="px-5 py-4 border-t border-ink-100 text-xs text-ink-400 bg-ink-50/30">
              Need a new Admin? Ask your CEO or an existing workspace Admin—they can escalate someone here or from Manage Team.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed border-ink-200 bg-ink-50/40">
        <CardContent className="pt-6 flex flex-wrap items-center gap-4 justify-between">
          <p className="text-sm text-ink-500">
            Hiring someone brand-new? Duplicate profiles are messy—jump straight to onboarding with a blank slate.
          </p>
          <Link href="/admin/team/new">
            <Button variant="primary">Add team member</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function roleBadgeTone(r: string): "sky" | "orange" | "ink" | "green" {
  if (r === "CEO") return "orange";
  if (r === "ADMIN") return "sky";
  if (r === "HR") return "green";
  return "ink";
}
