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

export function isLiaEnabled(): boolean {
  const flag = normalizeEnvSecret(process.env.LIA_ENABLED);
  if (flag === "0" || flag.toLowerCase() === "false") return false;
  if (flag === "1" || flag.toLowerCase() === "true") return true;
  return Boolean(resolveLiaLlmConfig());
}

export type ResolvedLiaLlm = {
  apiKey: string;
  baseNormalized: string;
  model: string;
  isOpenRouter: boolean;
};

export function resolveLiaLlmConfig(): ResolvedLiaLlm | null {
  const liaKey = normalizeEnvSecret(process.env.LIA_OPENROUTER_API_KEY);
  const orKey = liaKey || normalizeEnvSecret(process.env.OPENROUTER_API_KEY);
  if (!orKey || orKey.startsWith("aff_")) return null;

  const baseRaw =
    normalizeEnvSecret(process.env.LIA_OPENROUTER_BASE_URL) ||
    normalizeEnvSecret(process.env.OPENROUTER_BASE_URL) ||
    "https://openrouter.ai/api/v1";
  const model =
    normalizeEnvSecret(process.env.LIA_MODEL) ||
    normalizeEnvSecret(process.env.OPENROUTER_MODEL) ||
    "openai/gpt-4o-mini";

  const baseNormalized = baseRaw.replace(/\/$/, "");
  return {
    apiKey: orKey,
    baseNormalized,
    model,
    isOpenRouter: baseNormalized.includes("openrouter.ai"),
  };
}

export const LIA_RATE_LIMIT_MESSAGES_PER_HOUR = 30;
