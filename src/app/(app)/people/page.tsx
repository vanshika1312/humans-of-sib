import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function PeoplePage() {
  const [members, departments] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        image: true,
        title: true,
        joinedAt: true,
        city: { select: { name: true } },
        department: { select: { name: true, emoji: true } },
      },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.department.findMany({
      select: { id: true, name: true, emoji: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const byDept = departments.map((d) => ({
    ...d,
    members: members.filter((m) => m.department?.name === d.name),
  })).filter((d) => d.members.length > 0);

  const undeparted = members.filter((m) => !m.department);

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
                <MemberCard key={m.id} member={m} />
              ))}
            </div>
          </section>
        ))}

        {undeparted.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-ink-500 mb-3">No department assigned</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {undeparted.map((m) => (
                <MemberCard key={m.id} member={m} />
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
    image: string | null;
    title: string | null;
    joinedAt: Date;
    city: { name: string } | null;
    department: { name: string; emoji: string | null } | null;
  };
};

function MemberCard({ member: m }: MemberCardProps) {
  const tenureDays = Math.floor((Date.now() - m.joinedAt.getTime()) / (1000 * 60 * 60 * 24));
  const tenureLabel =
    tenureDays < 30
      ? `${tenureDays}d`
      : tenureDays < 365
      ? `${Math.floor(tenureDays / 30)}mo`
      : `${(tenureDays / 365).toFixed(1)}y`;

  return (
    <Link
      href={`/people/${m.id}`}
      className="flex items-center gap-3 p-4 rounded-xl border border-ink-100 bg-white hover:border-sky-200 hover:shadow-sm transition-all"
    >
      <Avatar src={m.image} name={m.name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-ink-700 truncate">{m.name}</div>
        {m.title && <div className="text-xs text-ink-500 truncate">{m.title}</div>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {m.city && (
            <span className="text-[10px] text-ink-400">📍 {m.city.name}</span>
          )}
          <span className="text-[10px] text-ink-400">🗓 {tenureLabel}</span>
        </div>
      </div>
    </Link>
  );
}
