import { z } from "zod";
import { resolveLiaLlmConfig } from "@/lib/lia-config";
import {
  liaAssistantResponseSchema,
  type LiaAssistantResponse,
  type LiaSource,
} from "@/lib/lia-sources";
import type { LiaArticleHit } from "@/lib/lia-knowledge";
import { formatArticlesForPrompt } from "@/lib/lia-knowledge";

const LLM_CHAT_COMPLETION_TIMEOUT_MS = 90_000;
/** Max waits after HTTP 429 (3 total attempts). Free-tier models throttle aggressively. */
const LLM_HTTP_429_RETRY_WAITS = 2;

function parseRetryAfterSeconds(header: string | null): number | null {
  if (header === null || header === undefined) return null;
  const t = header.trim();
  if (!/^\d+$/.test(t)) return null;
  const sec = Number.parseInt(t, 10);
  if (!Number.isFinite(sec) || sec < 0 || sec > 3600) return null;
  return sec;
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upstreamErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };
    const msg = body.error?.message ?? body.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch {
    /* ignore */
  }
  return "";
}

function liaHttpErrorMessage(status: number, upstream: string): string {
  const suffix = upstream ? ` ${upstream}` : "";
  if (status === 401) {
    return `LIA request failed (HTTP 401).${suffix} Check LIA_OPENROUTER_API_KEY or OPENROUTER_API_KEY.`;
  }
  if (status === 429) {
    return `LIA is rate-limited by the AI provider.${suffix} Wait a minute, try again later, add OpenRouter credits, or set LIA_MODEL to a paid model.`;
  }
  return `LIA request failed (HTTP ${status}).${suffix}`;
}

function truncate(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[…truncated…]`;
}

function resolveChatCompletionsUrl(baseNormalized: string): { ok: true; url: string } | { ok: false } {
  const base = baseNormalized.replace(/\/$/, "");
  try {
    const url = new URL("chat/completions", `${base}/`).toString();
    return { ok: true, url };
  } catch {
    return { ok: false };
  }
}

function latin1ByteStringHeaderValue(raw: string, maxLen: number): string {
  let out = "";
  for (let i = 0; i < raw.length && out.length < maxLen; ) {
    const cp = raw.codePointAt(i)!;
    i += cp > 0xffff ? 2 : 1;
    if (cp <= 0xff) out += String.fromCodePoint(cp);
    else if (cp === 0x2014 || cp === 0x2013) out += "-";
    else if (cp === 0x2026) out += "...";
    else out += "";
  }
  return out.slice(0, maxLen);
}

function normalizeEnvSecret(raw: string | undefined): string {
  let s = (raw ?? "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export type LiaChatTurn = { role: "user" | "assistant"; content: string };

export type AskLiaInput = {
  userMessage: string;
  memberContext: string;
  articles: LiaArticleHit[];
  priorTurns?: LiaChatTurn[];
};

export type AskLiaOutcome =
  | { ok: true; response: LiaAssistantResponse; model: string }
  | { ok: false; error: string; upstreamStatus?: number };

export async function askLia(input: AskLiaInput): Promise<AskLiaOutcome> {
  const cfg = resolveLiaLlmConfig();
  if (!cfg) {
    return {
      ok: false,
      error: "LIA is not configured. Set LIA_OPENROUTER_API_KEY or OPENROUTER_API_KEY.",
    };
  }

  const { apiKey, baseNormalized, model, isOpenRouter } = cfg;
  const chatUrlResult = resolveChatCompletionsUrl(baseNormalized);
  if (!chatUrlResult.ok) {
    return { ok: false, error: "Invalid LIA API base URL." };
  }

  const system = `You are LIA, the friendly internal assistant for Humans of SIB (Skillinabox HRMS).
Answer the member's question using ONLY:
1) The KNOWLEDGE ARTICLES below
2) The MEMBER CONTEXT below (their own leave balances, probation, etc.)

Rules:
- Be concise (2–6 short paragraphs or bullets). Use markdown sparingly.
- Include personal leave numbers only when the question is about leave or balances.
- In "sources", list 1–4 links the member should open. Use exact href values from articles (detailHref = in-app path, detailUrl = external). Set external=true only for http(s) URLs; in-app paths like /attendance have external=false.
- Never invent policies, numbers, or URLs not present in the context.
- If context is insufficient, set confidence to "low", explain what is missing, set suggestContactHr=true, and suggest hr@skillinabox.in.
- Do not discuss compensation, tax IDs, or other employees' private data.

Return ONLY valid JSON:
{"answer":"string","sources":[{"title":"string","href":"string","external":boolean}],"confidence":"high"|"low","suggestContactHr":boolean optional}`;

  const knowledgeBlock = formatArticlesForPrompt(input.articles);
  const contextUser = [
    "KNOWLEDGE ARTICLES:",
    truncate(knowledgeBlock, 12_000),
    "",
    "MEMBER CONTEXT:",
    truncate(input.memberContext, 4_000),
    "",
    `MEMBER QUESTION:\n${truncate(input.userMessage, 4_000)}`,
  ].join("\n");

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
  ];

  const prior = (input.priorTurns ?? []).slice(-6);
  for (const t of prior) {
    messages.push({ role: t.role, content: truncate(t.content, 2_000) });
  }
  messages.push({ role: "user", content: contextUser });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (isOpenRouter) {
    const referer = normalizeEnvSecret(process.env.OPENROUTER_HTTP_REFERER);
    if (referer) headers["HTTP-Referer"] = latin1ByteStringHeaderValue(referer, 2048);
    headers["X-Title"] = latin1ByteStringHeaderValue(
      normalizeEnvSecret(process.env.OPENROUTER_APP_TITLE) || "Humans of SIB - LIA",
      256,
    );
  }

  const chatBody = JSON.stringify({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages,
  });

  let response: Response | undefined;
  try {
    for (let waitRound = 0; waitRound <= LLM_HTTP_429_RETRY_WAITS; waitRound++) {
      response = await fetch(chatUrlResult.url, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(LLM_CHAT_COMPLETION_TIMEOUT_MS),
        body: chatBody,
      });

      const is429 = response.status === 429;
      if (!is429 || waitRound >= LLM_HTTP_429_RETRY_WAITS) break;

      let waitSec =
        parseRetryAfterSeconds(response.headers.get("Retry-After")) ??
        Math.min(12, 2 ** (waitRound + 1));
      waitSec = Math.min(waitSec, 45);
      console.warn("[lia-llm] HTTP 429 from provider; retrying after delay", {
        waitSec,
        waitRound,
        model,
      });
      try {
        await response.arrayBuffer();
      } catch {
        /* ignore drain errors */
      }
      await delayMs(waitSec * 1000);
    }
  } catch {
    return { ok: false, error: "Could not reach LIA. Try again in a moment." };
  }

  if (!response!.ok) {
    const upstream = await upstreamErrorMessage(response!);
    const status = response!.status;
    return {
      ok: false,
      error: liaHttpErrorMessage(status, upstream),
      upstreamStatus: status,
    };
  }

  let json: unknown;
  try {
    json = await response!.json();
  } catch {
    return { ok: false, error: "Invalid response from LIA." };
  }

  const content =
    typeof json === "object" &&
    json !== null &&
    "choices" in json &&
    Array.isArray((json as { choices: unknown }).choices)
      ? (json as { choices: { message?: { content?: string } }[] }).choices[0]?.message?.content
      : null;

  if (!content || typeof content !== "string") {
    return { ok: false, error: "Empty response from LIA." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    return { ok: false, error: "LIA returned non-JSON." };
  }

  const parsed = liaAssistantResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, error: "LIA returned unexpected JSON." };
  }

  const sanitized: LiaAssistantResponse = {
    ...parsed.data,
    answer: parsed.data.answer.trim().slice(0, 8000),
    sources: sanitizeSources(parsed.data.sources),
  };

  return { ok: true, response: sanitized, model };
}

function sanitizeSources(sources: LiaSource[]): LiaSource[] {
  const seen = new Set<string>();
  const out: LiaSource[] = [];
  for (const s of sources) {
    const href = s.href.trim().slice(0, 2048);
    if (!href || seen.has(href)) continue;
    const external = s.external || /^https?:\/\//i.test(href);
    out.push({ title: s.title.trim().slice(0, 200), href, external });
    seen.add(href);
    if (out.length >= 8) break;
  }
  return out;
}
