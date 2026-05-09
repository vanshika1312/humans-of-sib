import Link from "next/link";
import type { Role } from "@/generated/prisma";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import {
  getPeopleProfileAccess,
  roleLabel,
  type PeopleProfileAccess,
} from "@/lib/people-profile-access";
import { formatDate, calendarDaysSincePastDate } from "@/lib/utils";
import { displayName } from "@/lib/user-display-name";

export default async function PeoplePage() {
  const session = await auth();
  const viewer = session?.user?.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          role: true,
          headedDept: { select: { id: true } },
        },
      })
    : null;

  const [members, departments] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        image: true,
        title: true,
        role: true,
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
        subtitle={`${members.length} people building Skillinabox`}
      />

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
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {m.city && <span className="text-[10px] text-ink-400">📍 {m.city.name}</span>}
          <span className="text-[10px] text-ink-400">🗓 {tenureLabel}</span>
        </div>
      </div>
    </Link>
  );
}
