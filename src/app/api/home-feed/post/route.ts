import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fanoutAnnouncement } from "@/lib/notifications";
import { persistTaskAttachmentFile } from "@/lib/task-attachment-upload";
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

const kindSchema = z.enum(["TEXT", "PHOTO", "VIDEO"]);
const photoTagSchema = z.object({
  userId: z.string().trim().min(1).max(191),
  name: z.string().trim().min(1).max(120),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
const photoTagsSchema = z.array(photoTagSchema).max(25);

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, firstName: true, lastName: true },
  });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const kindRaw = form.get("kind");
  const bodyRaw = form.get("body");
  const fileRaw = form.get("file");
  const photoTagsRaw = form.get("photoTags");

  const parsedKind = kindSchema.safeParse(kindRaw);
  if (!parsedKind.success) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  const kind = parsedKind.data;

  const body = ns(bodyRaw, 32000);
  const file = fileRaw instanceof File ? fileRaw : null;
  const photoTagsStr = typeof photoTagsRaw === "string" ? photoTagsRaw : "";

  if (!body.length && !file) {
    return NextResponse.json({ error: "Post cannot be empty" }, { status: 400 });
  }

  if (kind === "TEXT" && file) {
    return NextResponse.json({ error: "Text post cannot include a file" }, { status: 400 });
  }
  if (kind === "PHOTO" && (!file || !file.type.toLowerCase().startsWith("image/"))) {
    return NextResponse.json({ error: "Photo post requires an image file" }, { status: 400 });
  }
  if (kind === "VIDEO" && (!file || !file.type.toLowerCase().startsWith("video/"))) {
    return NextResponse.json({ error: "Video post requires a video file" }, { status: 400 });
  }

  let photoTags: Array<z.infer<typeof photoTagSchema>> = [];
  if (photoTagsStr) {
    if (kind !== "PHOTO") {
      return NextResponse.json({ error: "Only photo posts can include photo tags" }, { status: 400 });
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(photoTagsStr);
    } catch {
      return NextResponse.json({ error: "Invalid photo tags" }, { status: 400 });
    }
    const parsed = photoTagsSchema.safeParse(parsedJson);
    if (!parsed.success) return NextResponse.json({ error: "Invalid photo tags" }, { status: 400 });
    photoTags = parsed.data;
  }

  let media:
    | { url: string; fileName: string; mimeType: string; size: number }
    | null = null;

  if (file) {
    const res = await persistTaskAttachmentFile(file);
    if (!res.ok) {
      const msg =
        res.code === "TOO_LARGE"
          ? "File too large"
          : res.code === "UNSUPPORTED"
            ? "Unsupported file type"
            : "Storage not configured";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    media = { url: res.url, fileName: res.fileName, mimeType: res.mimeType, size: res.size };
  }

  const mentionUserIds = extractMentionUserIds(body);
  const photoTagUserIds = Array.from(new Set(photoTags.map((t) => ns(t.userId, 191)).filter(Boolean))).slice(0, 25);

  const title = ns(me.name ?? `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim(), 200) || "Company update";
  const homeFeedPostId = randomUUID();

  await fanoutAnnouncement({
    title,
    body: body.length ? body : null,
    actorUserId: me.id,
    meta: {
      subkind: "HOME_FEED_POST",
      homeFeedPostId,
      postKind: kind,
      media,
      mentionUserIds,
      photoTags: photoTags.length ? photoTags : undefined,
      photoTagUserIds: photoTagUserIds.length ? photoTagUserIds : undefined,
    },
  });

  return NextResponse.json({ ok: true, homeFeedPostId });
}

