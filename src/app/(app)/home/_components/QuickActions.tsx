import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-sky-500" /> Quick actions
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <QuickAction href="/attendance" label="Check in" emoji="🟢" />
        <QuickAction href="/wins?tab=nominate" label="Nominate a win" emoji="🏆" />
        <QuickAction href="/pulse" label="Pulse check" emoji="💗" />
        <QuickAction href="/journey" label="My journey" emoji="🧭" />
      </CardContent>
    </Card>
  );
}

function QuickAction({ href, label, emoji }: { href: string; label: string; emoji: string }) {
  return (
    <Link
      href={href}
      className="p-3 rounded-lg bg-ink-50 hover:bg-ink-100 flex items-center gap-2 text-sm font-medium text-ink-600 transition-colors"
    >
      <span>{emoji}</span>
      {label}
    </Link>
  );
}
