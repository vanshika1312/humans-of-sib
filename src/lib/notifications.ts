import { prisma } from "@/lib/prisma";
import type { NotificationKind } from "@/generated/prisma";

function ns(v: unknown, max: number) {
  return (typeof v === "string" ? v.trim() : "").slice(0, max);
}

export async function createNotification(args: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  actorUserId?: string | null;
  meta?: unknown;
}) {
  const userId = ns(args.userId, 191);
  const title = ns(args.title, 200);
  if (!userId.length || !title.length) return null;

  const body = args.body ? ns(args.body, 32000) : null;
  const href = args.href ? ns(args.href, 2048) : null;
  const actorUserId = args.actorUserId ? ns(args.actorUserId, 191) : null;

  return prisma.notification.create({
    data: {
      userId,
      kind: args.kind,
      title,
      body: body && body.length ? body : null,
      href: href && href.length ? href : null,
      actorUserId: actorUserId && actorUserId.length ? actorUserId : null,
      meta: args.meta ?? undefined,
    },
    select: { id: true },
  });
}

export async function countUnreadNotifications(userId: string) {
  const id = ns(userId, 191);
  if (!id.length) return 0;
  return prisma.notification.count({ where: { userId: id, readAt: null } });
}

export async function countUnreadMessageNotifications(userId: string) {
  const id = ns(userId, 191);
  if (!id.length) return 0;
  return prisma.notification.count({
    where: {
      userId: id,
      readAt: null,
      kind: { in: ["TASK_COMMENT", "CEO_FEEDBACK_REPLY"] },
    },
  });
}

export async function fanoutAnnouncement(args: {
  title: string;
  body?: string | null;
  actorUserId?: string | null;
  meta?: unknown;
}) {
  const title = ns(args.title, 200);
  if (!title.length) return { created: 0 };
  const body = args.body ? ns(args.body, 32000) : null;
  const actorUserId = args.actorUserId ? ns(args.actorUserId, 191) : null;

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  if (users.length === 0) return { created: 0 };

  const res = await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      kind: "ANNOUNCEMENT",
      title,
      body: body && body.length ? body : null,
      href: null,
      actorUserId: actorUserId && actorUserId.length ? actorUserId : null,
      meta: args.meta ?? undefined,
    })),
  });

  return { created: res.count };
}

