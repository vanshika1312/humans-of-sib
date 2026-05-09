import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UsersRound } from "lucide-react";
import { displayName } from "@/lib/user-display-name";

export async function TeamSpotlight() {
  const members = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      image: true,
      title: true,
      department: { select: { name: true, emoji: true } },
    },
    orderBy: { joinedAt: "asc" },
    take: 6,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="size-4 text-sky-500" /> The Team
          </CardTitle>
          <CardDescription>Say hello to your colleagues</CardDescription>
        </div>
        <Link href="/people" className="text-xs font-medium text-sky-600 hover:underline">
          View all →
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.map((m) => {
          const dn = displayName(m);
          return (
            <Link
              key={m.id}
              href={`/people/${m.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-50 transition-colors"
            >
              <Avatar src={m.image} name={dn} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink-700 truncate">{dn}</div>
                {m.title && (
                  <div className="text-xs text-ink-400 truncate">{m.title}</div>
                )}
              </div>
              {m.department && (
                <Badge tone="sky" className="shrink-0 text-[10px]">
                  {m.department.emoji} {m.department.name}
                </Badge>
              )}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
