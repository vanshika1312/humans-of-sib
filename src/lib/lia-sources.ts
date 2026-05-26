import { z } from "zod";

export const liaSourceSchema = z.object({
  title: z.string().min(1).max(200),
  href: z.string().min(1).max(2048),
  external: z.boolean(),
});

export type LiaSource = z.infer<typeof liaSourceSchema>;

export const liaAssistantResponseSchema = z.object({
  answer: z.string().min(1),
  sources: z.array(liaSourceSchema).max(8),
  confidence: z.enum(["high", "low"]),
  suggestContactHr: z.boolean().optional(),
});

export type LiaAssistantResponse = z.infer<typeof liaAssistantResponseSchema>;

export function sourcesFromArticle(article: {
  title: string;
  detailHref: string | null;
  detailUrl: string | null;
}): LiaSource[] {
  const out: LiaSource[] = [];
  if (article.detailHref?.trim()) {
    out.push({ title: article.title, href: article.detailHref.trim(), external: false });
  }
  if (article.detailUrl?.trim()) {
    const href = article.detailUrl.trim();
    const label = article.detailHref?.trim()
      ? `${article.title} (full document)`
      : article.title;
    out.push({
      title: label,
      href,
      external: /^https?:\/\//i.test(href),
    });
  }
  return out;
}
