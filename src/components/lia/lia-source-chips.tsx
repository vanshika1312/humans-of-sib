import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { LiaSource } from "@/lib/lia-sources";

export function LiaSourceChips({ sources }: { sources: LiaSource[] }) {
  if (!sources.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {sources.map((s) =>
        s.external ? (
          <a
            key={s.href}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-100"
          >
            {s.title}
            <ExternalLink className="size-3 opacity-70" aria-hidden />
          </a>
        ) : (
          <Link
            key={s.href}
            href={s.href}
            className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-100"
          >
            {s.title}
          </Link>
        ),
      )}
    </div>
  );
}
