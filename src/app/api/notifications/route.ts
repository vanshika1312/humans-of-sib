import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

export async function GET(req: NextRequest) {
  const me = await sessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tab = req.nextUrl.searchParams.get("tab") ?? "all";
  const unreadOnly = tab === "unread";

  const [unreadCount, unreadMessageCount, notifications] = await Promise.all([
    prisma.notification.count({ where: { userId: me.id, readAt: null } }),
    prisma.notification.count({
      where: { userId: me.id, readAt: null, kind: { in: ["TASK_COMMENT", "CEO_FEEDBACK_REPLY"] } },
    }),
    prisma.notification.findMany({
      where: { userId: me.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ unreadCount, unreadMessageCount, notifications });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_read"), id: z.string().min(1).max(191) }),
  z.object({ action: z.literal("mark_all_read") }),
]);

export async function POST(req: NextRequest) {
  const me = await sessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (parsed.data.action === "mark_read") {
    await prisma.notification.updateMany({
      where: { id: parsed.data.id, userId: me.id, readAt: null },
      data: { readAt: new Date() },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId: me.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  const [unreadCount, unreadMessageCount] = await Promise.all([
    prisma.notification.count({ where: { userId: me.id, readAt: null } }),
    prisma.notification.count({
      where: { userId: me.id, readAt: null, kind: { in: ["TASK_COMMENT", "CEO_FEEDBACK_REPLY"] } },
    }),
  ]);
  return NextResponse.json({ ok: true, unreadCount, unreadMessageCount });
}

