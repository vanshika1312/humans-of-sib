import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone } from "lucide-react";

export async function CeoInbox() {
  const unreadCount = await prisma.cEOFeedback.count({ where: { status: "NEW" } });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-orange-500" /> CEO Inbox
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-ink-700">{unreadCount}</div>
        <div className="text-xs text-ink-400">new messages</div>
        <Link href="/feedback/ceo/inbox" className="mt-3 inline-block text-xs font-medium text-sky-600 hover:underline">
          Open inbox →
        </Link>
      </CardContent>
    </Card>
  );
}
