import type { ReactNode } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn, relativeTime, weekStartDate } from "@/lib/utils";
import { WEEKLY_QUESTION } from "@/app/(app)/pulse/constants";
import { Megaphone, Sparkles, Trophy, Vote } from "lucide-react";
import { AnnouncementComposer } from "./AnnouncementComposer";
import { HomeFeedPostActions } from "./HomeFeedPostActions";

type Props = {
  viewer: { id: string; name: string | null; image: string | null; role: string };
};

type FeedItem =
  | {
      id: string;
      kind: "ANNOUNCEMENT";
      title: string;
      body: string | null;
      createdAt: Date;
      actorUserId: string | null;
      actor: { name: string | null; image: string | null } | null;
      href: string | null;
      meta: unknown;
    }
  | {
      id: string;
      kind: "POLL";
      title: string;
      body: string | null;
      createdAt: Date;
      href: string;
    }
  | {
      id: string;
      kind: "SHOUTOUT";
      title: string;
      body: string | null;
      createdAt: Date;
      actor: { name: string | null; image: string | null } | null;
      href: string;
    }
  | {
      id: string;
      kind: "CONGRATS";
      title: string;
      body: string | null;
      createdAt: Date;
      actor: { name: string | null; image: string | null } | null;
      href: string | null;
    };

type HomeFeedPostMeta = {
  subkind?: "HOME_FEED_POST";
  homeFeedPostId?: string;
  postKind?: "TEXT" | "PHOTO" | "VIDEO";
  media?: { url: string; mimeType?: string; fileName?: string } | null;
  mentionUserIds?: string[];
  photoTagUserIds?: string[];
  photoTags?: Array<{ userId: string; name: string; x: number; y: number }>;
};

function parseHomeFeedPostMeta(meta: unknown): HomeFeedPostMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  if (m.subkind !== "HOME_FEED_POST") return null;
  const out: HomeFeedPostMeta = { subkind: "HOME_FEED_POST" };
  if (typeof m.homeFeedPostId === "string") out.homeFeedPostId = m.homeFeedPostId;
  if (typeof m.postKind === "string") out.postKind = m.postKind as HomeFeedPostMeta["postKind"];
  if (m.media && typeof m.media === "object") {
    const mm = m.media as Record<string, unknown>;
    if (typeof mm.url === "string") {
      out.media = {
        url: mm.url,
        mimeType: typeof mm.mimeType === "string" ? mm.mimeType : undefined,
        fileName: typeof mm.fileName === "string" ? mm.fileName : undefined,
      };
    }
  } else if (m.media === null) {
    out.media = null;
  }
  if (Array.isArray(m.mentionUserIds)) {
    out.mentionUserIds = m.mentionUserIds.filter((x) => typeof x === "string") as string[];
  }
  if (Array.isArray(m.photoTagUserIds)) {
    out.photoTagUserIds = m.photoTagUserIds.filter((x) => typeof x === "string") as string[];
  }
  if (Array.isArray(m.photoTags)) {
    const tags = m.photoTags
      .filter((t) => !!t && typeof t === "object")
      .map((t) => t as Record<string, unknown>)
      .map((t) => ({
        userId: typeof t.userId === "string" ? t.userId : "",
        name: typeof t.name === "string" ? t.name : "",
        x: typeof t.x === "number" ? t.x : Number.NaN,
        y: typeof t.y === "number" ? t.y : Number.NaN,
      }))
      .filter((t) => t.userId && t.name && Number.isFinite(t.x) && Number.isFinite(t.y) && t.x >= 0 && t.x <= 1 && t.y >= 0 && t.y <= 1)
      .slice(0, 25);
    if (tags.length) out.photoTags = tags;
  }
  return out;
}

function renderBodyWithMentions(body: string) {
  const out: Array<ReactNode> = [];
  const re = /@\[[^\]]+\]\(([^)]+)\)/g;
  const nameRe = /@\[(?<name>[^\]]+)\]\((?<id>[^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = nameRe.exec(body))) {
    const start = m.index;
    const end = nameRe.lastIndex;
    if (start > last) out.push(body.slice(last, start));
    const id = m.groups?.id ?? m[2];
    const name = m.groups?.name ?? m[1];
    out.push(
      <Link key={`${id}-${start}`} href={`/people/${id}`} className="text-sky-700 font-medium hover:underline">
        @{name}
      </Link>,
    );
    last = end;
  }
  if (last < body.length) out.push(body.slice(last));

  // If regex didn't match (older Node without named groups), fall back to id-only pattern.
  if (out.length === 1 && typeof out[0] === "string" && re.test(body)) {
    const fallback: Array<React.ReactNode> = [];
    re.lastIndex = 0;
    let last2 = 0;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(body))) {
      const start = mm.index;
      const end = re.lastIndex;
      if (start > last2) fallback.push(body.slice(last2, start));
      const id = mm[1];
      fallback.push(
        <Link key={`${id}-${start}`} href={`/people/${id}`} className="text-sky-700 font-medium hover:underline">
          @someone
        </Link>,
      );
      last2 = end;
    }
    if (last2 < body.length) fallback.push(body.slice(last2));
    return fallback;
  }

  return out;
}

export async function AnnouncementFeed({ viewer }: Props) {
  const [announcements, wins, newJoiners] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: viewer.id, kind: "ANNOUNCEMENT" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        body: true,
        href: true,
        createdAt: true,
        meta: true,
        actorUserId: true,
        actor: { select: { name: true, image: true } },
      },
    }),
    prisma.win.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        user: { select: { name: true, image: true } },
      },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { joinedAt: "desc" },
      take: 3,
      select: { id: true, name: true, image: true, joinedAt: true },
    }),
  ]);

  const pollItem: FeedItem = {
    id: "weekly-pulse",
    kind: "POLL",
    title: "Weekly Pulse",
    body: WEEKLY_QUESTION,
    createdAt: weekStartDate(),
    href: "/pulse",
  };

  const items: FeedItem[] = [
    pollItem,
    ...announcements.map(
      (a): FeedItem => ({
        id: a.id,
        kind: "ANNOUNCEMENT",
        title: a.title,
        body: a.body,
        createdAt: a.createdAt,
        actorUserId: a.actorUserId,
        actor: a.actor,
        href: a.href,
        meta: a.meta,
      }),
    ),
    ...wins.map(
      (w): FeedItem => ({
        id: w.id,
        kind: "SHOUTOUT",
        title: w.title,
        body: w.description,
        createdAt: w.createdAt,
        actor: w.user,
        href: "/wins",
      }),
    ),
    ...newJoiners.map(
      (u): FeedItem => ({
        id: u.id,
        kind: "CONGRATS",
        title: `Welcome ${u.name ?? "to the team"}!`,
        body: "Drop a warm hello and help them feel at home at SIB.",
        createdAt: u.joinedAt,
        actor: { name: u.name, image: u.image },
        href: "/people",
      }),
    ),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const visibleItems = items.slice(0, 20);

  return (
    <Card>
      <CardHeader className="flex items-start justify-between flex-row">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-4 text-sky-600" /> Home feed
          </CardTitle>
          <div className="mt-1 text-xs text-ink-400">
            Post updates (text/photo/video), plus polls/surveys, badges/shoutouts, and congrats.
          </div>
        </div>
        <Link href="/notifications" className="text-xs font-medium text-sky-600 hover:underline">
          Open inbox →
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 max-h-[70vh] overflow-hidden">
        <AnnouncementComposer viewer={viewer} />
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          {visibleItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-500">
              Nothing to show yet.
            </div>
          ) : (
            visibleItems.map((it) => <FeedRow key={`${it.kind}-${it.id}`} item={it} viewer={viewer} />)
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FeedRow({ item, viewer }: { item: FeedItem; viewer: Props["viewer"] }) {
  const meta = (() => {
    if (item.kind === "ANNOUNCEMENT") return { tone: "sky" as const, label: "Announcement", icon: Megaphone };
    if (item.kind === "POLL") return { tone: "orange" as const, label: "Poll / Survey", icon: Vote };
    if (item.kind === "SHOUTOUT") return { tone: "sun" as const, label: "Badge / Shoutout", icon: Trophy };
    return { tone: "green" as const, label: "Congrats", icon: Sparkles };
  })();

  const Icon = meta.icon;
  const homePost = item.kind === "ANNOUNCEMENT" ? parseHomeFeedPostMeta(item.meta) : null;
  const canManageHomePost =
    item.kind === "ANNOUNCEMENT" &&
    homePost?.subkind === "HOME_FEED_POST" &&
    ((item.actorUserId && item.actorUserId === viewer.id) || ["ADMIN", "CEO"].includes(viewer.role));
  const manageId =
    item.kind === "ANNOUNCEMENT" ? (homePost?.homeFeedPostId ?? item.id) : "";

  return (
    <div className="rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-sm flex items-start gap-3">
      <div className="pt-0.5">
        {"actor" in item && item.actor ? (
          <Avatar src={item.actor.image} name={item.actor.name} size="sm" />
        ) : (
          <div className="size-9 rounded-full bg-ink-50 border border-ink-100 flex items-center justify-center text-ink-500">
            <Icon className="size-4" aria-hidden />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-semibold text-ink-700 truncate">
            {homePost?.subkind === "HOME_FEED_POST"
              ? item.actor?.name ?? item.title
              : item.title}
          </div>
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="text-xs text-ink-400 ml-auto">{relativeTime(item.createdAt)}</span>
        </div>
        {item.body && (
          <p className="text-sm text-ink-500 mt-1 whitespace-pre-wrap line-clamp-3">
            {renderBodyWithMentions(item.body)}
          </p>
        )}
        {canManageHomePost ? (
          <div className="mt-2">
            <HomeFeedPostActions
              postId={manageId}
              initialBody={item.body}
              initialPostKind={homePost?.postKind}
              initialMedia={homePost?.media ?? null}
              initialPhotoTags={homePost?.photoTags}
            />
          </div>
        ) : null}

        {homePost?.media?.url ? (
          <div className="mt-2">
            {homePost.media.mimeType?.toLowerCase().startsWith("video/") ? (
              <video
                src={homePost.media.url}
                controls
                className="w-full max-h-80 rounded-xl border border-ink-100 bg-black"
              />
            ) : (
              <div className="relative rounded-xl border border-ink-100 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={homePost.media.url}
                  alt={homePost.media.fileName ?? "Post media"}
                  className="w-full max-h-96 object-cover"
                  loading="lazy"
                />
                {homePost.photoTags && homePost.photoTags.length > 0 ? (
                  <div className="absolute inset-0">
                    {homePost.photoTags.map((t) => (
                      <div
                        key={`${t.userId}-${t.x}-${t.y}`}
                        className="absolute pointer-events-auto"
                        style={{
                          left: `${t.x * 100}%`,
                          top: `${t.y * 100}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <button
                          type="button"
                          className="group relative"
                          aria-label={`Tagged: ${t.name}`}
                        >
                          <span className="block size-2.5 rounded-full bg-white ring-2 ring-sky-600 shadow-sm" />
                          <span
                            className={cn(
                              "absolute left-1/2 bottom-full mb-2 -translate-x-1/2",
                              "max-w-[14rem] truncate rounded-md border border-ink-100 bg-white px-2 py-1 text-[11px] text-ink-700 shadow-lg shadow-ink-900/10",
                              "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                            )}
                          >
                            {t.name}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {"href" in item && item.href ? (
          <div className="mt-2">
            <Link href={item.href} className="text-xs font-medium text-sky-600 hover:underline">
              View →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

