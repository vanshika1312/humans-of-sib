import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { getCeoInboxRecipient } from "@/lib/ceo-feedback";

export async function DirectToCEO() {
  const ceo = await getCeoInboxRecipient();
  const displayName = ceo?.name?.trim() || "CEO";
  const subtitle = ceo?.role === "CEO" ? "CEO" : "Leadership";

  return (
    <Card className="overflow-hidden">
      <div className="p-5 md:p-6 bg-gradient-to-r from-orange-50 to-sun-50">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <Avatar src={ceo?.image} name={displayName} size="lg" className="shadow-md" />
            <span className="absolute -bottom-1 -right-1 text-base">📣</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-orange-500 mb-0.5">
              {displayName} · {subtitle}
            </div>
            <div className="font-semibold text-ink-700 leading-tight">Got something on your mind?</div>
            <p className="text-sm text-ink-500 mt-1">
              Send an idea, concern, or kudos straight to the CEO — anonymously if you want.
            </p>
          </div>
        </div>

        <div className="mt-4 flex sm:justify-end">
          <Link
            href="/feedback/ceo/new"
            className="inline-flex h-10 w-full sm:w-auto px-4 rounded-md bg-orange-500 text-white font-medium items-center justify-center hover:bg-orange-600"
          >
            Message the CEO
          </Link>
        </div>
      </div>
    </Card>
  );
}
