import type { ReactNode } from "react";
import Link from "next/link";

/** Stored mention token for rich @-links (matches home feed composer). */
export function formatUserMention(name: string, userId: string) {
  const safeName = name.replace(/[\[\]]/g, "").trim() || "Team member";
  const safeId = userId.trim();
  return `@[${safeName}](${safeId})`;
}

/** Prepends a recipient @-mention when celebrating or nominating a win. */
export function descriptionWithRecipientMention(
  description: string | undefined | null,
  userId: string,
  name: string,
) {
  const token = formatUserMention(name, userId);
  const desc = description?.trim();
  if (desc?.includes(`](${userId})`)) return desc;
  return desc ? `${token}\n\n${desc}` : token;
}

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

