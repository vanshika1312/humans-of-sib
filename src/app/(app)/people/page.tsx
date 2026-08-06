import Link from "next/link";
import type { Prisma, Role } from "@/generated/prisma";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getPeopleProfileAccess,
  roleLabel,
  type PeopleProfileAccess,
} from "@/lib/people-profile-access";
import { formatDate, calendarDaysSincePastDate } from "@/lib/utils";
import { displayName } from "@/lib/user-display-name";
import { firstSearchParam } from "@/lib/search-param";
import { userDirectoryTextSearchWhere } from "@/lib/user-directory-search";

export default function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <PeoplePageBody searchParams={searchParams} />
    </Suspense>
  );
}

async function PeoplePageBody({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const viewer = await requireAppViewer();
  if (!viewer) return null;

  const sp = await searchParams;
  const q = (firstSearchParam(sp.q) ?? "").trim();

  const where: Prisma.UserWhereInput = {
    status: "ACTIVE",
    ...(q ? userDirectoryTextSearchWhere(q) : {}),
  };

  const [members, departments] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        image: true,
        title: true,
        role: true,
        employeeCode: true,
        joinedAt: true,
        managerId: true,
        departmentId: true,
        city: { select: { name: true } },
        department: { select: { name: true, emoji: true } },
        manager: { select: { id: true, name: true, firstName: true, lastName: true } },
      },
      orderBy: [{ department: { name: "asc" } }, { firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.department.findMany({
      select: { id: true, name: true, emoji: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const byDept = departments
    .map((d) => ({
      ...d,
      members: members.filter((m) => m.department?.name === d.name),
    }))
    .filter((d) => d.members.length > 0);

  const undeparted = members.filter((m) => !m.department);

  const viewerHeadDeptId = viewer?.headedDept?.id ?? null;

  return (
    <div>
      <PageHeader
        title="The Team"
        emoji="👥"
        subtitle={
          q
            ? `${members.length} result${members.length === 1 ? "" : "s"} for "${q}"`
            : `${members.length} people building Skillinabox`
        }
      />

      <form method="GET" className="flex flex-wrap gap-2 items-end mb-6">
        <div className="min-w-[220px] flex-1 max-w-sm">
          <label htmlFor="people-q" className="sr-only">
            Search people
          </label>
          <Input
            id="people-q"
            name="q"
            defaultValue={q}
            placeholder="Search name, phone, or email…"
            className="h-9"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="h-9 shrink-0">
          Search
        </Button>
        {q && (
          <Link href="/people">
            <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0">
              Clear
            </Button>
          </Link>
        )}
      </form>

      {members.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-200 bg-white px-4 py-10 text-center text-sm text-ink-500">
          No one matches &quot;{q}&quot;. Try a different name, phone number, or email.
        </div>
      )}

      <div className="space-y-8">
        {byDept.map((dept) => (
          <section key={dept.id}>
            <h2 className="text-sm font-semibold text-ink-500 mb-3 flex items-center gap-1.5">
              <span>{dept.emoji}</span>
              <span>{dept.name}</span>
              <span className="text-ink-300 font-normal">· {dept.members.length}</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dept.members.map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  access={
                    viewer
                      ? getPeopleProfileAccess({
                          viewerUserId: viewer.id,
                          viewerRole: viewer.role,
                          subjectUserId: m.id,
                          subjectManagerId: m.managerId,
                          subjectDepartmentId: m.departmentId,
                          viewerHeadedDepartmentId: viewerHeadDeptId,
                        })
                      : { level: "limited", canSeeSalary: false, showEngagementSections: false }
                  }
                />
              ))}
            </div>
          </section>
        ))}

        {undeparted.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-ink-500 mb-3">No department assigned</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {undeparted.map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  access={
                    viewer
                      ? getPeopleProfileAccess({
                          viewerUserId: viewer.id,
                          viewerRole: viewer.role,
                          subjectUserId: m.id,
                          subjectManagerId: m.managerId,
                          subjectDepartmentId: m.departmentId,
                          viewerHeadedDepartmentId: viewerHeadDeptId,
                        })
                      : { level: "limited", canSeeSalary: false, showEngagementSections: false }
                  }
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

type MemberCardProps = {
  member: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    image: string | null;
    title: string | null;
    role: Role;
    employeeCode: string | null;
    joinedAt: Date;
    managerId: string | null;
    city: { name: string } | null;
    department: { name: string; emoji: string | null } | null;
    manager: { id: string; name: string | null; firstName: string | null; lastName: string | null } | null;
  };
  access: PeopleProfileAccess;
};

function MemberCard({ member: m, access }: MemberCardProps) {
  const dn = displayName(m);
  const rich = access.level !== "limited";
  const tenureDays = calendarDaysSincePastDate(m.joinedAt);
  const tenureLabel =
    tenureDays < 30
      ? `${tenureDays}d`
      : tenureDays < 365
        ? `${Math.floor(tenureDays / 30)}mo`
        : `${(tenureDays / 365).toFixed(1)}y`;

  if (!rich) {
    return (
      <Link
        href={`/people/${m.id}`}
        className="flex items-center gap-3 p-4 rounded-xl border border-ink-100 bg-white hover:border-sky-200 hover:shadow-sm transition-all"
      >
        <Avatar src={m.image} name={dn} size="md" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-semibold text-ink-700 truncate">{dn}</div>
          <div className="text-[11px] text-ink-500 truncate">
            {m.department ? (
              <>
                {m.department.emoji} {m.department.name}
              </>
            ) : (
              "No department"
            )}
          </div>
          <div className="text-[10px] text-ink-400">{roleLabel(m.role)}</div>
          {m.employeeCode && (
            <div className="text-[10px] text-ink-500 font-mono">{m.employeeCode}</div>
          )}
          <div className="text-[10px] text-ink-400 truncate">
            Manager:{" "}
            {m.manager ? (
              <span className="text-ink-500">{displayName(m.manager)}</span>
            ) : (
              "—"
            )}
          </div>
          <div className="text-[10px] text-ink-400">Joined {formatDate(m.joinedAt)}</div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/people/${m.id}`}
      className="flex items-center gap-3 p-4 rounded-xl border border-ink-100 bg-white hover:border-sky-200 hover:shadow-sm transition-all"
    >
      <Avatar src={m.image} name={dn} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-ink-700 truncate">{dn}</div>
        {m.title && <div className="text-xs text-ink-500 truncate">{m.title}</div>}
        <div className="text-[10px] text-ink-500 mt-0.5">{roleLabel(m.role)}</div>
        {m.employeeCode && (
          <div className="text-[10px] text-ink-600 font-mono mt-0.5">{m.employeeCode}</div>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {m.city && <span className="text-[10px] text-ink-400">📍 {m.city.name}</span>}
          <span className="text-[10px] text-ink-400">🗓 {tenureLabel}</span>
        </div>
      </div>
    </Link>
  );
}
