import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sessionUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.user.findUnique({ where: { email }, select: { id: true } });
}

export async function PATCH() {
  const me = await sessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: me.id, readAt: null },
    data: { readAt: new Date() },
  });

  const [unreadCount, unreadMessageCount] = await Promise.all([
    prisma.notification.count({ where: { userId: me.id, readAt: null } }),
    prisma.notification.count({
      where: { userId: me.id, readAt: null, kind: { in: ["TASK_COMMENT", "CEO_FEEDBACK_REPLY"] } },
    }),
  ]);

  return NextResponse.json({ ok: true, unreadCount, unreadMessageCount });
}

