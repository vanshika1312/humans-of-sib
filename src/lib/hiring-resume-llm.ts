import { z } from "zod";

const fieldConfidenceSchema = z
  .object({
    fullName: z.number().min(0).max(1).optional(),
    email: z.number().min(0).max(1).optional(),
    phone: z.number().min(0).max(1).optional(),
    candidateLocation: z.number().min(0).max(1).optional(),
  })
  .optional();

export const parsedResumeFieldsSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  candidateLocation: z.string().nullable(),
  fieldConfidence: fieldConfidenceSchema,
});

export type ParsedResumeFields = z.infer<typeof parsedResumeFieldsSchema>;

function truncateForModel(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[…truncated…]`;
}

function sanitizeParsed(raw: ParsedResumeFields): ParsedResumeFields {
  const trimOrNull = (s: string | null, max: number) => {
    if (s === null || s === undefined) return null;
    const v = String(s).trim();
    if (!v) return null;
    return v.slice(0, max);
  };
  const email = trimOrNull(raw.email, 320)?.toLowerCase() ?? null;
  return {
    fullName: trimOrNull(raw.fullName, 200),
    email,
    phone: trimOrNull(raw.phone, 64),
    candidateLocation: trimOrNull(raw.candidateLocation, 200),
    fieldConfidence: raw.fieldConfidence,
  };
}

export type LlmParseOutcome =
  | { ok: true; parsed: ParsedResumeFields; model: string }
  | { ok: false; error: string; parsed?: ParsedResumeFields };

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

async function parsingErrorMessage(response: Response): Promise<string> {
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

/** Timeout for POST /chat/completions (large résumé + model latency). */
const LLM_CHAT_COMPLETION_TIMEOUT_MS = 120_000;

function collectErrorChain(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 6 && cur != null; i++) {
    if (cur instanceof Error) {
      const m = cur.message.trim();
      if (m) parts.push(m);
      cur = cur.cause;
    } else {
      parts.push(String(cur).trim());
      break;
    }
  }
  return parts.filter(Boolean).join(" — ");
}

/** Redact URLs and key-like strings before showing in import row NOTES. */
function sanitizeTransportErrorForUser(text: string, maxLen = 220): string {
  let s = text.replace(/\s+/g, " ").trim();
  s = s.replace(/https?:\/\/[^\s)]+/gi, "[url]");
  s = s.replace(/\bsk-(?:or-v1-)?[a-z0-9_-]{16,}/gi, "[key]");
  s = s.replace(/\baff_[a-z0-9_-]+\b/gi, "[key]");
  s = s.replace(/\bBearer\s+\S+/gi, "Bearer [key]");
  s = s.replace(/\b[a-f0-9]{32,}\b/gi, "[hex]");
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 1)}…`;
  return s;
}

function isFetchTimeoutError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "TimeoutError") return true;
  if (err instanceof Error && err.name === "TimeoutError") return true;
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  if (code === "ETIMEDOUT") return true;
  if (err instanceof Error && /timed out|timeout|aborted/i.test(err.message)) return true;
  return false;
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

/**
 * `fetch()` header values must be ByteString / ISO-8859-1 (code points ≤ 0xFF). Unicode-only
 * characters such as em dash (U+2014) cause "Cannot convert argument to a ByteString" before send.
 */
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

export type ResolvedLlmResumeParse = {
  apiKey: string;
  baseNormalized: string;
  model: string;
  isOpenRouter: boolean;
};

/** Affinda keys (`aff_…`) must not be used with OpenAI-compatible chat endpoints. */
function isLikelyAffindaApiKey(k: string): boolean {
  return k.startsWith("aff_");
}

/**
 * Resolves OpenAI-compatible chat parsing: prefers dedicated OpenRouter env vars, then
 * `HIRING_RESUME_PARSE_*` (OpenAI, OpenRouter, LiteLLM, etc.).
 */
export function resolveLlmParseConfig(): ResolvedLlmResumeParse | null {
  const orKey =
    normalizeEnvSecret(process.env.OPENROUTER_API_KEY) ||
    normalizeEnvSecret(process.env.HIRING_RESUME_OPENROUTER_API_KEY);
  if (orKey && !isLikelyAffindaApiKey(orKey)) {
    const baseRaw =
      normalizeEnvSecret(process.env.OPENROUTER_BASE_URL) ||
      normalizeEnvSecret(process.env.HIRING_RESUME_OPENROUTER_BASE_URL) ||
      "https://openrouter.ai/api/v1";
    const model =
      normalizeEnvSecret(process.env.OPENROUTER_MODEL) ||
      normalizeEnvSecret(process.env.HIRING_RESUME_OPENROUTER_MODEL) ||
      "openai/gpt-4o-mini";
    return {
      apiKey: orKey,
      baseNormalized: baseRaw.replace(/\/$/, ""),
      model,
      isOpenRouter: true,
    };
  }

  const genericKey = normalizeEnvSecret(process.env.HIRING_RESUME_PARSE_API_KEY);
  if (!genericKey || isLikelyAffindaApiKey(genericKey)) return null;
  const explicitBase = normalizeEnvSecret(process.env.HIRING_RESUME_PARSE_BASE_URL);
  const baseRaw =
    explicitBase ||
    (genericKey.startsWith("sk-or-") ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1");
  const model =
    normalizeEnvSecret(process.env.HIRING_RESUME_PARSE_MODEL) ||
    (genericKey.startsWith("sk-or-") ? "openai/gpt-4o-mini" : "gpt-4o-mini");
  const baseNormalized = baseRaw.replace(/\/$/, "");
  return {
    apiKey: genericKey,
    baseNormalized,
    model,
    isOpenRouter: baseNormalized.includes("openrouter.ai"),
  };
}

/** True when bulk import can call an LLM (OpenRouter, OpenAI, or other OpenAI-compatible API). */
export function isLlmResumeParsingConfigured(): boolean {
  return resolveLlmParseConfig() !== null;
}

/**
 * Structured extraction via OpenAI-compatible Chat Completions JSON mode.
 */
export async function parseResumeFieldsWithLlm(resumeText: string): Promise<LlmParseOutcome> {
  const cfg = resolveLlmParseConfig();

  const stubParsed: ParsedResumeFields = {
    fullName: null,
    email: null,
    phone: null,
    candidateLocation: null,
    fieldConfidence: {},
  };

  if (!cfg) {
    return {
      ok: false,
      error:
        "Résumé parsing is not configured for LLM. Set OPENROUTER_API_KEY (OpenRouter `sk-or-…`). If `HIRING_RESUME_PARSE_API_KEY` is an Affinda key (`aff_…`), remove it from that variable or use it only with a dedicated integration — it cannot be used as an OpenAI-compatible chat key.",
      parsed: stubParsed,
    };
  }

  const { apiKey, baseNormalized, model, isOpenRouter } = cfg;

  const bodyText = truncateForModel(resumeText, 14_000);

  const system = `You extract candidate profile fields from résumé plain text for an ATS.
Return ONLY valid JSON matching this shape:
{"fullName": string|null,"email":string|null,"phone":string|null,"candidateLocation":string|null,"fieldConfidence":{"fullName"?:number,"email"?:number,"phone"?:number,"candidateLocation"?:number}}

Rules:
- fullName: candidate's full name as written on the résumé (not company names).
- email: best primary email if clearly present.
- phone: one primary phone with country code if visible.
- candidateLocation: city/region where they appear to be based if stated (not employer HQ).
- fieldConfidence: optional 0–1 confidence per field you populated (omit keys you leave null).
- Use null when unknown — never invent emails or phones.`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (isOpenRouter) {
    const referer =
      normalizeEnvSecret(process.env.OPENROUTER_HTTP_REFERER) ||
      normalizeEnvSecret(process.env.NEXT_PUBLIC_APP_URL);
    if (referer)
      headers["HTTP-Referer"] = latin1ByteStringHeaderValue(referer, 2048);
    const titleRaw =
      normalizeEnvSecret(process.env.OPENROUTER_APP_TITLE) || "Humans of SIB - resume import";
    headers["X-Title"] = latin1ByteStringHeaderValue(titleRaw, 256);
  }

  const chatUrlResult = resolveChatCompletionsUrl(baseNormalized);
  if (!chatUrlResult.ok) {
    return {
      ok: false,
      error:
        "Invalid base URL for résumé parsing (check OPENROUTER_BASE_URL or HIRING_RESUME_PARSE_BASE_URL).",
      parsed: stubParsed,
    };
  }

  let response: Response;
  try {
    response = await fetch(chatUrlResult.url, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(LLM_CHAT_COMPLETION_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Résumé text:\n---\n${bodyText}\n---`,
          },
        ],
      }),
    });
  } catch (err) {
    const timedOut = isFetchTimeoutError(err);
    const chain = collectErrorChain(err);
    console.error("[hiring-resume-llm] chat/completions fetch failed", {
      baseNormalized,
      model,
      timedOut,
      error: chain,
    });
    const safe = sanitizeTransportErrorForUser(chain);
    const baseMsg = timedOut
      ? `Request timed out contacting résumé parsing service (${LLM_CHAT_COMPLETION_TIMEOUT_MS / 1000}s).`
      : "Could not reach résumé parsing service.";
    const error = safe ? `${baseMsg} (${safe})` : baseMsg;
    return { ok: false, error, parsed: stubParsed };
  }

  if (!response.ok) {
    const upstream = await parsingErrorMessage(response);
    const suffix = upstream ? ` ${upstream}` : "";
    const hint401 =
      response.status === 401
        ? " Wrong or mismatched API key for this base URL. For OpenRouter use OPENROUTER_API_KEY and optional OPENROUTER_BASE_URL, or HIRING_RESUME_PARSE_BASE_URL=https://openrouter.ai/api/v1 with an OpenRouter key."
        : "";
    return {
      ok: false,
      error: `Résumé parsing failed (HTTP ${response.status}).${suffix}${hint401} Fill fields manually.`,
      parsed: stubParsed,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: "Invalid response from parsing service.", parsed: stubParsed };
  }

  const content =
    typeof json === "object" &&
    json !== null &&
    "choices" in json &&
    Array.isArray((json as { choices: unknown }).choices)
      ? (json as { choices: { message?: { content?: string } }[] }).choices[0]?.message?.content
      : null;

  if (!content || typeof content !== "string") {
    return { ok: false, error: "Empty parser response.", parsed: stubParsed };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    return { ok: false, error: "Parser returned non-JSON.", parsed: stubParsed };
  }

  const parsed = parsedResumeFieldsSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, error: "Parser returned unexpected JSON.", parsed: stubParsed };
  }

  return { ok: true, parsed: sanitizeParsed(parsed.data), model };
}

/** Shared trim rules for ParsedResumeFields (used by LLM + any future mappers). */
export function sanitizeParsedResumeFields(raw: ParsedResumeFields): ParsedResumeFields {
  return sanitizeParsed(raw);
}
