import type { ReactNode } from "react";
import Link from "next/link";

export function renderTextWithMentions(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const mentionRe = /@\[(.*?)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = mentionRe.exec(text))) {
    const start = m.index;
    const end = mentionRe.lastIndex;
    if (start > last) out.push(text.slice(last, start));

    const name = (m[1] ?? "").trim();
    const id = (m[2] ?? "").trim();

    if (name && id) {
      out.push(
        <Link key={`${id}-${start}`} href={`/people/${id}`} className="text-sky-700 font-medium hover:underline">
          @{name}
        </Link>,
      );
    } else {
      out.push(text.slice(start, end));
    }

    last = end;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

