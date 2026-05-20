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

export async function PATCH(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const me = await sessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = "then" in (ctx.params as any) ? await (ctx.params as Promise<{ id: string }>) : (ctx.params as { id: string });
  const id = typeof params?.id === "string" ? params.id.trim().slice(0, 191) : "";
  if (!id.length) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await prisma.notification.updateMany({
    where: { id, userId: me.id, readAt: null },
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

