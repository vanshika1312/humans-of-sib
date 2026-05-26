import { prisma } from "@/lib/prisma";
import { isLiaEnabled, LIA_RATE_LIMIT_MESSAGES_PER_HOUR } from "@/lib/lia-config";
import { searchLiaArticles } from "@/lib/lia-knowledge";
import { buildLiaMemberContext } from "@/lib/lia-member-context";
import { askLia, type LiaChatTurn } from "@/lib/lia-llm";
import { sourcesFromArticle, type LiaSource } from "@/lib/lia-sources";
import type { Prisma } from "@/generated/prisma";

export class LiaUnavailableError extends Error {
  constructor(message = "LIA is not available right now.") {
    super(message);
    this.name = "LiaUnavailableError";
  }
}

export class LiaRateLimitError extends Error {
  constructor() {
    super("You've sent too many messages. Please try again in a little while.");
    this.name = "LiaRateLimitError";
  }
}

/** OpenRouter / LLM provider returned HTTP 429 after retries. */
export class LiaProviderRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiaProviderRateLimitError";
  }
}

export async function assertLiaRateLimit(userId: string): Promise<void> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.liaMessage.count({
    where: {
      role: "USER",
      createdAt: { gte: since },
      conversation: { userId },
    },
  });
  if (count >= LIA_RATE_LIMIT_MESSAGES_PER_HOUR) {
    throw new LiaRateLimitError();
  }
}

function mergeSources(llmSources: LiaSource[], articleIds: string[], articles: Awaited<ReturnType<typeof searchLiaArticles>>): LiaSource[] {
  const seen = new Set<string>();
  const out: LiaSource[] = [];

  const add = (s: LiaSource) => {
    if (seen.has(s.href)) return;
    seen.add(s.href);
    out.push(s);
  };

  for (const s of llmSources) add(s);

  for (const id of articleIds) {
    const article = articles.find((a) => a.id === id);
    if (!article) continue;
    for (const s of sourcesFromArticle(article)) add(s);
  }

  return out.slice(0, 8);
}

export type LiaChatResult = {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  answer: string;
  sources: LiaSource[];
  confidence: "high" | "low";
  suggestContactHr?: boolean;
};

export async function runLiaChat(input: {
  userId: string;
  message: string;
  conversationId?: string | null;
}): Promise<LiaChatResult> {
  if (!isLiaEnabled()) throw new LiaUnavailableError();

  const message = input.message.trim().slice(0, 4000);
  if (!message) throw new Error("Message is required.");

  await assertLiaRateLimit(input.userId);

  let conversationId = input.conversationId?.trim() || null;
  if (conversationId) {
    const existing = await prisma.liaConversation.findFirst({
      where: { id: conversationId, userId: input.userId },
      select: { id: true },
    });
    if (!existing) conversationId = null;
  }

  if (!conversationId) {
    const title = message.slice(0, 80) || "New chat";
    const conv = await prisma.liaConversation.create({
      data: { userId: input.userId, title },
    });
    conversationId = conv.id;
  }

  const priorMessages = await prisma.liaMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 12,
    select: { role: true, content: true },
  });

  const priorTurns: LiaChatTurn[] = priorMessages
    .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
    .map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

  const [articles, memberContext] = await Promise.all([
    searchLiaArticles(message, 5),
    buildLiaMemberContext({ userId: input.userId }),
  ]);

  const llm = await askLia({
    userMessage: message,
    memberContext,
    articles,
    priorTurns,
  });

  if (!llm.ok) {
    if (llm.upstreamStatus === 429) throw new LiaProviderRateLimitError(llm.error);
    throw new LiaUnavailableError(llm.error);
  }

  const articleIds = articles.map((a) => a.id);
  const sources = mergeSources(llm.response.sources, articleIds, articles);

  const metaJson = {
    articleIds,
    model: llm.model,
    confidence: llm.response.confidence,
  } satisfies Prisma.InputJsonValue;

  const [userMsg, assistantMsg] = await prisma.$transaction([
    prisma.liaMessage.create({
      data: {
        conversationId,
        role: "USER",
        content: message,
      },
    }),
    prisma.liaMessage.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content: llm.response.answer,
        sourcesJson: sources,
        metaJson,
      },
    }),
  ]);

  await prisma.liaConversation.update({
    where: { id: conversationId },
    data: {
      updatedAt: new Date(),
      title:
        priorMessages.length === 0
          ? message.slice(0, 80) || "New chat"
          : undefined,
    },
  });

  return {
    conversationId,
    userMessageId: userMsg.id,
    assistantMessageId: assistantMsg.id,
    answer: llm.response.answer,
    sources,
    confidence: llm.response.confidence,
    suggestContactHr: llm.response.suggestContactHr,
  };
}
