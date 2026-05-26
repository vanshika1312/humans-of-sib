import { prisma } from "@/lib/prisma";
import type { LiaKnowledgeCategory } from "@/generated/prisma";

export type LiaArticleHit = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: LiaKnowledgeCategory;
  detailHref: string | null;
  detailUrl: string | null;
  score: number;
};

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** Score article against query tokens (v1 keyword search, no vectors). */
export function scoreLiaArticle(
  article: {
    title: string;
    summary: string;
    body: string;
    category: string;
    keywords: string[];
  },
  tokens: string[],
): number {
  if (tokens.length === 0) return 0;
  const hay = [
    article.title,
    article.summary,
    article.body,
    article.category,
    ...article.keywords,
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const t of tokens) {
    if (article.title.toLowerCase().includes(t)) score += 8;
    if (article.keywords.some((k) => k.toLowerCase().includes(t))) score += 6;
    if (article.summary.toLowerCase().includes(t)) score += 4;
    if (hay.includes(t)) score += 2;
  }
  return score;
}

export async function searchLiaArticles(query: string, limit = 5): Promise<LiaArticleHit[]> {
  const tokens = tokenizeQuery(query);
  const rows = await prisma.liaKnowledgeArticle.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });

  type Scored = LiaArticleHit;
  const scored: Scored[] = rows
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      body: row.body,
      category: row.category,
      detailHref: row.detailHref,
      detailUrl: row.detailUrl,
      score: scoreLiaArticle(row, tokens),
    }))
    .filter((r) => (tokens.length === 0 ? true : r.score > 0))
    .sort((a, b) => b.score - a.score);

  if (tokens.length === 0) {
    return rows.slice(0, limit).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      body: row.body,
      category: row.category,
      detailHref: row.detailHref,
      detailUrl: row.detailUrl,
      score: 0,
    }));
  }

  return scored.slice(0, limit);
}

export function formatArticlesForPrompt(articles: LiaArticleHit[]): string {
  if (articles.length === 0) return "(No knowledge articles matched.)";
  return articles
    .map((a, i) => {
      const links: string[] = [];
      if (a.detailHref) links.push(`in-app: ${a.detailHref}`);
      if (a.detailUrl) links.push(`external: ${a.detailUrl}`);
      return [
        `[Article ${i + 1}] id=${a.id} slug=${a.slug} category=${a.category}`,
        `Title: ${a.title}`,
        `Summary: ${a.summary}`,
        `Body:\n${a.body.slice(0, 4000)}`,
        links.length ? `Links: ${links.join(" | ")}` : "Links: (none)",
      ].join("\n");
    })
    .join("\n\n---\n\n");
}
