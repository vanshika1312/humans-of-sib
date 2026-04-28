import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export function DirectToCEO() {
  return (
    <Card className="overflow-hidden">
      <div className="p-5 md:p-6 flex items-center gap-4 bg-gradient-to-r from-orange-50 to-sun-50">
        <div className="relative shrink-0">
          <div className="size-14 rounded-full overflow-hidden ring-2 ring-white shadow-md">
            <Image
              src="/ritvik.jpeg"
              alt="Ritvik"
              width={56}
              height={56}
              className="object-cover object-top size-full"
            />
          </div>
          <span className="absolute -bottom-1 -right-1 text-base">📣</span>
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-orange-500 mb-0.5">Ritvik · CPO</div>
          <div className="font-semibold text-ink-700">Got something on your mind?</div>
          <p className="text-sm text-ink-500 mt-0.5">
            Send an idea, concern, or kudos straight to the CEO — anonymously if you want.
          </p>
        </div>
        <Link
          href="/feedback/ceo/new"
          className="hidden sm:inline-flex h-10 px-4 rounded-md bg-orange-500 text-white font-medium items-center hover:bg-orange-600"
        >
          Message the CEO
        </Link>
      </div>
    </Card>
  );
}
