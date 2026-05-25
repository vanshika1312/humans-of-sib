import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { WinWallTabNav } from "./WinWallTabNav";
import { parseWinWallTab, type WinWallTab } from "@/lib/win-wall-access";
import { Trophy } from "lucide-react";

export function WinWallChrome({
  tab,
  canAward,
  adminAction,
}: {
  tab?: string;
  canAward: boolean;
  adminAction?: string;
}) {
  const activeTab = parseWinWallTab(tab);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
        <div className="flex items-start gap-3">
          <div className="size-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-sm">
            <Trophy className="size-6 text-white" aria-hidden />
          </div>
          <PageHeader
            title="Win Wall"
            subtitle="House of Skillinabox"
            className="!mb-0 [&_h1]:text-2xl"
          />
        </div>
        {canAward && (
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href="/wins?tab=certificates&action=customize">Customize certificate</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/wins?tab=certificates&action=issue">Issue certificate</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/wins?tab=wall&action=celebrate">Celebrate a win</Link>
            </Button>
          </div>
        )}
      </div>

      <WinWallTabNav active={activeTab} adminAction={adminAction} />
    </>
  );
}
