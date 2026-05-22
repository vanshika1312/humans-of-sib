import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ns(v: unknown, max: number) {
  return (typeof v === "string" ? v.trim() : "").slice(0, max);
}

function extractMentionUserIds(text: string): string[] {
  const out: string[] = [];
  const re = /@\[[^\]]+\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const id = ns(m[1], 191);
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= 25) break;
  }
  return out;
}

type HomeFeedPostMeta = {
  subkind?: "HOME_FEED_POST";
  homeFeedPostId?: string;
  postKind?: "TEXT" | "PHOTO" | "VIDEO";
  media?: { url: string; mimeType?: string; fileName?: string } | null;
  mentionUserIds?: string[];
  photoTagUserIds?: string[];
  photoTags?: Array<{ userId: string; name: string; x: number; y: number }>;
};

function parseMeta(meta: unknown): HomeFeedPostMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  if (m.subkind !== "HOME_FEED_POST") return null;
  const out: HomeFeedPostMeta = { subkind: "HOME_FEED_POST" };
  if (typeof m.homeFeedPostId === "string") out.homeFeedPostId = ns(m.homeFeedPostId, 191);
  if (typeof m.postKind === "string") out.postKind = m.postKind as HomeFeedPostMeta["postKind"];
  if (m.media && typeof m.media === "object") out.media = m.media as HomeFeedPostMeta["media"];
  if (m.media === null) out.media = null;
  if (Array.isArray(m.mentionUserIds)) out.mentionUserIds = m.mentionUserIds.filter((x) => typeof x === "string") as string[];
  if (Array.isArray(m.photoTagUserIds)) out.photoTagUserIds = m.photoTagUserIds.filter((x) => typeof x === "string") as string[];
  if (Array.isArray(m.photoTags)) out.photoTags = m.photoTags.filter((x) => !!x && typeof x === "object") as HomeFeedPostMeta["photoTags"];
  return out;
}

const photoTagSchema = z.object({
  userId: z.string().trim().min(1).max(191),
  name: z.string().trim().min(1).max(120),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
const photoTagsSchema = z.array(photoTagSchema).max(25);

const patchSchema = z.object({
  body: z.string().optional(),
  photoTags: photoTagsSchema.optional(),
});

function whereForHomeFeedPost(postIdRaw: string) {
  const postId = ns(postIdRaw, 191);
  return {
    kind: "ANNOUNCEMENT" as const,
    AND: [
      { meta: { path: ["subkind"], equals: "HOME_FEED_POST" as const } },
      { meta: { path: ["homeFeedPostId"], equals: postId } },
    ],
  };
}

async function resolveHomeFeedPostGroup(postIdRaw: string) {
  const postId = ns(postIdRaw, 191);
  if (!postId.length) return null;

  // Prefer stable `homeFeedPostId` when supported by JSON-path filters, but don't hard-require it.
  try {
    const whereByMeta = whereForHomeFeedPost(postId);
    const byMeta = await prisma.notification.findFirst({
      where: whereByMeta,
      select: { actorUserId: true, meta: true, title: true, body: true, createdAt: true },
    });
    if (byMeta) return { where: whereByMeta, sample: byMeta };
  } catch {
    // Ignore and fall back to notification-id based grouping.
  }

  const byId = await prisma.notification.findUnique({
    where: { id: postId },
    select: { actorUserId: true, meta: true, title: true, body: true, createdAt: true, kind: true },
  });
  if (!byId) return null;

  const meta = parseMeta(byId.meta);
  if (!meta || meta.subkind !== "HOME_FEED_POST") return null;
  if (!byId.actorUserId) return null;

  // Best-effort legacy grouping (older posts didn't have `homeFeedPostId`).
  const whereLegacy = {
    kind: "ANNOUNCEMENT" as const,
    actorUserId: byId.actorUserId,
    createdAt: byId.createdAt,
    title: byId.title,
    body: byId.body,
    AND: [
      { meta: { path: ["subkind"], equals: "HOME_FEED_POST" as const } },
      ...(byId.meta ? [{ meta: { equals: byId.meta as Prisma.InputJsonValue } }] : []),
    ],
  };
  return { where: whereLegacy, sample: byId };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ postId: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await ctx.params;

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(bodyJson);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const resolved = await resolveHomeFeedPostGroup(postId);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { where, sample } = resolved;

  const isAdmin = me.role === "ADMIN" || me.role === "CEO";
  const isPoster = !!sample.actorUserId && sample.actorUserId === me.id;
  if (!isAdmin && !isPoster) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const meta = parseMeta(sample.meta);
  if (!meta) return NextResponse.json({ error: "Not editable" }, { status: 400 });
  const homeFeedPostId = meta.homeFeedPostId || randomUUID();

  const hasBody = typeof parsed.data.body === "string";
  const nextBody = ns(hasBody ? parsed.data.body : (sample.body ?? ""), 32000);

  const hasMedia = !!meta.media?.url;
  const postKind = meta.postKind ?? "TEXT";
  const empty = nextBody.trim().length === 0;
  if (empty && postKind === "TEXT" && !hasMedia) {
    return NextResponse.json({ error: "Post cannot be empty" }, { status: 400 });
  }

  const mentionUserIds = extractMentionUserIds(nextBody);

  const existingTags = (() => {
    const parsedExisting = photoTagsSchema.safeParse(meta.photoTags ?? []);
    return parsedExisting.success ? parsedExisting.data : [];
  })();

  if (parsed.data.photoTags !== undefined && postKind !== "PHOTO") {
    return NextResponse.json({ error: "Only photo posts can include photo tags" }, { status: 400 });
  }

  const nextPhotoTags = postKind === "PHOTO"
    ? (parsed.data.photoTags !== undefined ? parsed.data.photoTags : existingTags)
    : existingTags;
  const nextPhotoTagUserIds = Array.from(new Set(nextPhotoTags.map((t) => ns(t.userId, 191)).filter(Boolean))).slice(0, 25);

  const nextMeta = {
    ...(sample.meta && typeof sample.meta === "object" ? (sample.meta as Record<string, unknown>) : {}),
    subkind: "HOME_FEED_POST",
    homeFeedPostId,
    postKind: meta.postKind,
    media: meta.media ?? null,
    photoTags: nextPhotoTags.length ? nextPhotoTags : undefined,
    photoTagUserIds: nextPhotoTagUserIds.length ? nextPhotoTagUserIds : undefined,
    mentionUserIds,
    editedAt: new Date().toISOString(),
  };

  await prisma.notification.updateMany({
    where,
    data: {
      body: nextBody.length ? nextBody : null,
      meta: nextMeta as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true, homeFeedPostId });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ postId: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await ctx.params;

  const resolved = await resolveHomeFeedPostGroup(postId);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { where, sample } = resolved;

  const isAdmin = me.role === "ADMIN" || me.role === "CEO";
  const isPoster = !!sample.actorUserId && sample.actorUserId === me.id;
  if (!isAdmin && !isPoster) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const meta = parseMeta(sample.meta);
  if (!meta) return NextResponse.json({ error: "Not deletable" }, { status: 400 });

  const res = await prisma.notification.deleteMany({ where });
  return NextResponse.json({ ok: true, deleted: res.count });
}

