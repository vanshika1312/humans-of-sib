import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ns(v: unknown, max: number) {
  return (typeof v === "string" ? v.trim() : "").slice(0, max);
}

const toggleSchema = z.object({
  emoji: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .refine((v) => !/\s/.test(v), "Invalid reaction"),
});

async function getMe() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.user.findUnique({ where: { email }, select: { id: true } });
}

async function reactionSummary(postId: string, userId: string) {
  const [rows, mineRows] = await Promise.all([
    prisma.homeFeedPostReaction.groupBy({
      by: ["emoji"],
      where: { postId },
      _count: { _all: true },
    }),
    prisma.homeFeedPostReaction.findMany({
      where: { postId, userId },
      select: { emoji: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.emoji] = r._count._all;
  const mine = mineRows.map((r) => r.emoji);
  return { counts, mine };
}

export async function GET(_req: Request, ctx: { params: Promise<{ postId: string }> }) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId: raw } = await ctx.params;
  const postId = ns(raw, 191);
  if (!postId) return NextResponse.json({ error: "Invalid post id" }, { status: 400 });

  const { counts, mine } = await reactionSummary(postId, me.id);
  return NextResponse.json({ ok: true, postId, counts, mine });
}

export async function POST(req: Request, ctx: { params: Promise<{ postId: string }> }) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId: raw } = await ctx.params;
  const postId = ns(raw, 191);
  if (!postId) return NextResponse.json({ error: "Invalid post id" }, { status: 400 });

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = toggleSchema.safeParse(bodyJson);
  if (!parsed.success) return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
  const { emoji } = parsed.data;

  const existing = await prisma.homeFeedPostReaction.findUnique({
    where: { postId_userId_emoji: { postId, userId: me.id, emoji } },
    select: { id: true },
  });

  if (existing) {
    await prisma.homeFeedPostReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.homeFeedPostReaction.create({ data: { postId, userId: me.id, emoji } });
  }

  const { counts, mine } = await reactionSummary(postId, me.id);
  return NextResponse.json({ ok: true, postId, counts, mine });
}

