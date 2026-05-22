import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";
import { renderTextWithMentions } from "@/lib/mentions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { markAllNotificationsRead, markNotificationRead, postAnnouncement } from "./actions";

type SearchParams = Promise<{ tab?: string }>;

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireAppViewer();
  if (!me) return null;

  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "all";
  const unreadOnly = tab === "unread";

  const [unreadCount, notifications] = await Promise.all([
    prisma.notification.count({ where: { userId: me.id, readAt: null } }),
    prisma.notification.findMany({
      where: { userId: me.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
        actor: { select: { id: true, name: true, firstName: true, lastName: true, email: true, image: true } },
      },
    }),
  ]);

  const canPostAnnouncement = ["CEO", "ADMIN", "HR"].includes(me.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        emoji="🔔"
        subtitle="Everything new — tasks, replies, and announcements."
        action={
          <form action={markAllNotificationsRead}>
            <Button variant="outline" size="sm" disabled={unreadCount === 0}>
              Mark all read
            </Button>
          </form>
        }
      />

      {canPostAnnouncement && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Post announcement</CardTitle>
            <CardDescription>Sends a notification to all active team members.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <form action={postAnnouncement} className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="announcement-title">Title</Label>
                <Input id="announcement-title" name="title" placeholder="e.g. Office closed on Friday" maxLength={200} />
              </div>
              <div>
                <Label htmlFor="announcement-body">Body (optional)</Label>
                <Textarea id="announcement-body" name="body" placeholder="Add details…" maxLength={5000} rows={4} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="accent">
                  Send
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">Inbox</CardTitle>
            <Badge tone={unreadCount > 0 ? "orange" : "ink"}>{unreadCount} unread</Badge>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/notifications">
                <Button variant={unreadOnly ? "outline" : "primary"} size="sm">
                  All
                </Button>
              </Link>
              <Link href="/notifications?tab=unread">
                <Button variant={unreadOnly ? "primary" : "outline"} size="sm">
                  Unread
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-400">No notifications yet.</div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <div
                    key={n.id}
                    className={[
                      "rounded-xl border bg-white px-4 py-3 shadow-sm flex items-start gap-3",
                      isUnread ? "border-sky-200 bg-sky-50/30" : "border-ink-100",
                    ].join(" ")}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-ink-700">{n.title}</div>
                        {isUnread && <Badge tone="sky">New</Badge>}
                        <Badge tone="ink">{n.kind.replaceAll("_", " ")}</Badge>
                        <span className="text-xs text-ink-400 ml-auto">{relativeTime(n.createdAt)}</span>
                      </div>
                      {n.body && <p className="text-sm text-ink-500 mt-1 whitespace-pre-wrap">{renderTextWithMentions(n.body)}</p>}

                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {n.href && (
                          <Link href={n.href}>
                            <Button size="sm" variant="outline">
                              View
                            </Button>
                          </Link>
                        )}
                        {isUnread && (
                          <form action={markNotificationRead.bind(null, n.id)}>
                            <Button size="sm" variant="ghost">
                              Mark read
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

