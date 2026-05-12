import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";

export default async function CeoFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <div>
      <PageHeader
        title="Direct to CEO"
        emoji="📣"
        subtitle="Ideas, concerns, kudos — straight to the top. Anonymous option available."
        action={
          <Link href="/feedback/ceo/new">
            <Button variant="accent">✍️ New message</Button>
          </Link>
        }
      />

      <Suspense fallback={<RouteBodyFallback />}>
        <CeoFeedbackPageBody sent={sent} />
      </Suspense>
    </div>
  );
}

async function CeoFeedbackPageBody({ sent }: { sent: boolean }) {
  const me = await requireAppViewer();
  if (!me) return null;

  const mine = await prisma.cEOFeedback.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <>
      {sent && (
        <div className="mb-5 p-4 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
          ✅ Your message is on its way. You&apos;ll hear back here.
        </div>
      )}

      {me.role === "CEO" && (
        <Card className="mb-6 p-5 flex items-center justify-between bg-orange-50 border-orange-200">
          <div>
            <div className="font-semibold text-orange-700">CEO view</div>
            <div className="text-sm text-orange-700/80">See all messages from the team.</div>
          </div>
          <Link href="/feedback/ceo/inbox">
            <Button variant="accent">Open inbox →</Button>
          </Link>
        </Card>
      )}

      <h2 className="text-sm font-semibold text-ink-600 mb-3">Your messages</h2>

      {mine.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-2">📮</div>
          <div className="font-semibold text-ink-700">Nothing sent yet</div>
          <p className="text-sm text-ink-400 mt-1">Your voice matters. Start a conversation.</p>
          <div className="mt-4">
            <Link href="/feedback/ceo/new">
              <Button variant="accent">Write your first one</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {mine.map((f) => (
            <Card key={f.id}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2">
                  <Badge tone={f.status === "RESOLVED" ? "green" : f.status === "NEW" ? "orange" : "sky"}>
                    {f.status.replace("_", " ")}
                  </Badge>
                  <Badge tone="ink">{f.category}</Badge>
                  {f.anonymous && <Badge tone="ink">🕶️ anonymous</Badge>}
                  <span className="text-xs text-ink-400 ml-auto">{relativeTime(f.createdAt)}</span>
                </div>
                <div className="mt-2 font-semibold text-ink-700">{f.subject}</div>
                <p className="text-sm text-ink-500 mt-1 whitespace-pre-wrap">{f.message}</p>
                {f.response && (
                  <div className="mt-3 border-l-2 border-sky-500 pl-3 bg-sky-50/50 py-2 rounded-r">
                    <div className="text-xs font-medium text-sky-700">Reply from CEO</div>
                    <p className="text-sm text-ink-600 mt-1 whitespace-pre-wrap">{f.response}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
