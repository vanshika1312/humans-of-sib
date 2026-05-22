import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { relativeTime, weekStartDate } from "@/lib/utils";
import { renderTextWithMentions } from "@/lib/mentions";
import { WEEKLY_QUESTION } from "@/app/(app)/pulse/constants";
import { Megaphone, Sparkles, Trophy, Vote } from "lucide-react";
import { AnnouncementComposer } from "./AnnouncementComposer";
import { HomeFeedPostActions } from "./HomeFeedPostActions";
import { HomeFeedReactions } from "./HomeFeedReactions";
import { HomeFeedPostMedia } from "./HomeFeedPostMedia";

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

function normalizeMediaUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return u;
  return `/${u}`;
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

  const reactionPostIds = visibleItems
    .flatMap((it) => {
      if (it.kind !== "ANNOUNCEMENT") return [];
      const meta = parseHomeFeedPostMeta(it.meta);
      return [meta?.homeFeedPostId ?? it.id];
    })
    .filter((x) => typeof x === "string" && x.length > 0);

  const [reactionCountsByPostId, viewerReactionsByPostId] = await (async () => {
    if (reactionPostIds.length === 0) return [{}, {}] as const;

    const [countsRows, mineRows] = await Promise.all([
      prisma.homeFeedPostReaction.groupBy({
        by: ["postId", "emoji"],
        where: { postId: { in: reactionPostIds } },
        _count: { _all: true },
      }),
      prisma.homeFeedPostReaction.findMany({
        where: { userId: viewer.id, postId: { in: reactionPostIds } },
        select: { postId: true, emoji: true },
      }),
    ]);

    const counts: Record<string, Record<string, number>> = {};
    for (const r of countsRows) {
      if (!counts[r.postId]) counts[r.postId] = {};
      counts[r.postId]![r.emoji] = r._count._all;
    }

    const mine: Record<string, string[]> = {};
    for (const r of mineRows) {
      if (!mine[r.postId]) mine[r.postId] = [];
      mine[r.postId]!.push(r.emoji);
    }

    return [counts, mine] as const;
  })();

  return (
    <Card className="flex flex-col h-full min-h-0">
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
      <CardContent className="flex flex-col gap-3 flex-1 min-h-0">
        <AnnouncementComposer viewer={viewer} />
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          {visibleItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-500">
              Nothing to show yet.
            </div>
          ) : (
            visibleItems.map((it) => (
              <FeedRow
                key={`${it.kind}-${it.id}`}
                item={it}
                viewer={viewer}
                reactionCountsByPostId={reactionCountsByPostId}
                viewerReactionsByPostId={viewerReactionsByPostId}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FeedRow({
  item,
  viewer,
  reactionCountsByPostId,
  viewerReactionsByPostId,
}: {
  item: FeedItem;
  viewer: Props["viewer"];
  reactionCountsByPostId: Record<string, Record<string, number>>;
  viewerReactionsByPostId: Record<string, string[]>;
}) {
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

  const canReact =
    item.kind === "ANNOUNCEMENT" && manageId.length > 0;

  const headerTitle = (() => {
    if (item.kind !== "ANNOUNCEMENT") return item.title;
    if (homePost?.subkind === "HOME_FEED_POST") return item.actor?.name ?? item.title;
    return item.title;
  })();

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
          <div className="font-semibold text-ink-700 truncate">{headerTitle}</div>
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="text-xs text-ink-400 ml-auto">{relativeTime(item.createdAt)}</span>
        </div>
        {item.body && (
          <p className="text-sm text-ink-500 mt-1 whitespace-pre-wrap line-clamp-3">
            {renderTextWithMentions(item.body)}
          </p>
        )}

        {canReact ? (
          <HomeFeedReactions
            postId={manageId}
            initialCounts={reactionCountsByPostId[manageId] ?? {}}
            initialMine={viewerReactionsByPostId[manageId] ?? []}
            className="mt-2"
          />
        ) : null}

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
            <HomeFeedPostMedia
              url={normalizeMediaUrl(homePost.media.url)}
              mimeType={homePost.media.mimeType}
              fileName={homePost.media.fileName}
            />
          </div>
        ) : null}

        {homePost?.photoTags && homePost.photoTags.length > 0 ? (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-ink-400">Tagged:</span>
            {Array.from(
              new Map(homePost.photoTags.map((t) => [t.userId, t])).values(),
            ).map((t) => (
              <Link
                key={`tagged-${t.userId}`}
                href={`/people/${t.userId}`}
                className="inline-flex items-center rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-700 hover:bg-ink-50"
              >
                {t.name}
              </Link>
            ))}
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

