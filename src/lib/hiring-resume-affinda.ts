import type { ParsedResumeFields } from "@/lib/hiring-resume-llm";
import { sanitizeParsedResumeFields } from "@/lib/hiring-resume-llm";

/** Affinda résumé uploads are capped lower than generic documents (docs: ~5 MB for resumes). */
export const AFFINDA_RESUME_MAX_BYTES = 5 * 1024 * 1024;

export type AffindaParseOutcome =
  | { ok: true; parsed: ParsedResumeFields; model: "affinda" }
  | { ok: false; error: string; parsed?: ParsedResumeFields };

function normalizeEnv(raw: string | undefined): string {
  let s = (raw ?? "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickRawString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    /** Affinda full schema often nests display text under these (compact mode uses plain strings). */
    for (const key of [
      "parsed",
      "formatted",
      "raw",
      "text",
      "value",
      "normalized",
      "rawInput",
      "rawText",
      "internationalNumber",
      "nationalNumber",
      "formattedNumber",
      "email",
      "mailbox",
    ]) {
      const inner = o[key];
      if (typeof inner === "string") {
        const t = inner.trim();
        if (t.length) return t;
      }
    }
    /** Some tokens wrap the display string one level deeper, e.g. `{ parsed: { formatted: "..." } }`. */
    const nestedParsed = o.parsed;
    if (nestedParsed && typeof nestedParsed === "object") {
      const nestedStr = pickRawString(nestedParsed);
      if (nestedStr) return nestedStr;
    }
  }
  return null;
}

/** First non-empty string from an array (Affinda compact `email` / `phoneNumber` are string arrays). */
function firstPickFromAffindaList(list: unknown): string | null {
  if (!Array.isArray(list)) return null;
  for (const item of list) {
    const s = pickRawString(item);
    if (s) return s;
  }
  return null;
}

/** Conservative email pattern for fallbacks (rawText / loose scan). */
const AFFINDA_EMAIL_LIKE = /\b[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

/** Affinda occasionally nests the résumé payload (or returns extra envelope keys). */
function flattenAffindaResumeData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const top = data as Record<string, unknown>;
  let m: Record<string, unknown> = { ...top };

  /** Shallow merge so we don't drop fields that only exist on the parent (e.g. `email`) while enriching from `parsed`. */
  const nestKeys = [
    "resume",
    "resumeData",
    "parsedResume",
    "extractedResume",
    "result",
    "parsed",
    "personalInformation",
    "personalDetails",
    "personal",
    "contact",
  ];
  for (const k of nestKeys) {
    const inner = top[k];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      m = { ...m, ...(inner as Record<string, unknown>) };
    }
  }

  /** One more unwrap if merger left a nested extractor blob (`data.parsed` as object containing `candidateName` + primitives). */
  const secondPass = ["parsed", "extractedResume", "resume"];
  for (const k of secondPass) {
    const blob = (m as Record<string, unknown>)[k];
    if (blob && typeof blob === "object" && !Array.isArray(blob)) {
      const o = blob as Record<string, unknown>;
      if ("candidateName" in o || "email" in o || "phoneNumber" in o) {
        m = { ...m, ...o };
      }
    }
  }

  return m;
}

function extractEmailRegexFromBlob(v: unknown, depth = 0, budget = { n: 0 }): string | null {
  if (depth > 10 || budget.n > 300) return null;
  budget.n++;

  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const m = v.match(AFFINDA_EMAIL_LIKE);
    return m ? m[0] : null;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const f = extractEmailRegexFromBlob(item, depth + 1, budget);
      if (f) return f;
    }
    return null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;

    /** Prefer subtrees keyed like email.* */
    for (const key of Object.keys(o)) {
      if (!/mail/i.test(key)) continue;
      const val = o[key];
      const fromPick =
        typeof val === "string"
          ? val.trim()
          : val && typeof val === "object"
            ? pickRawString(val)
            : null;
      if (fromPick && AFFINDA_EMAIL_LIKE.test(fromPick)) return fromPick.match(AFFINDA_EMAIL_LIKE)![0];
      const deep = extractEmailRegexFromBlob(val, depth + 1, budget);
      if (deep) return deep;
    }

    for (const key of Object.keys(o)) {
      if (/attachments|image|headshot|photo|logo/i.test(key)) continue;
      const val = o[key];
      const maybe = typeof val === "string" ? val : val;
      const f = extractEmailRegexFromBlob(maybe, depth + 1, budget);
      if (f) return f;
    }
  }
  return null;
}

function emailFromWebsiteEntries(v: unknown): string | null {
  const lists = Array.isArray(v) ? v : v ? [v] : [];
  for (const row of lists) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const raw =
      typeof o.url === "string"
        ? o.url.trim()
        : typeof o.uri === "string"
          ? o.uri.trim()
          : pickRawString(o.url ?? o.uri);
    if (!raw) continue;

    const lower = raw.toLowerCase();
    if (lower.startsWith("mailto:")) {
      const rest = decodeURIComponent(raw.slice(7)).split(/[;&?#\s]/)[0];
      if (rest.includes("@")) return rest;
    }

    const m = raw.match(AFFINDA_EMAIL_LIKE);
    if (m) return m[0];
  }

  /** Affinda `{ type: "Email", … }`-style hints */
  for (const row of lists) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const typeStr = pickRawString(o.type) ?? pickRawString(o.websiteType);
    if (typeStr && /email/i.test(typeStr)) {
      const s = pickRawString(o.url) ?? pickRawString(o.address) ?? pickRawString(o.value);
      if (s) {
        const m = s.match(AFFINDA_EMAIL_LIKE);
        if (m) return m[0];
      }
    }
  }

  return null;
}

function firstEmailFromResumeData(d: Record<string, unknown>): string | null {
  for (const list of [d.emails, d.emailAddresses, d.contactEmails]) {
    if (Array.isArray(list)) {
      const s = firstPickFromAffindaList(list);
      if (s) return s;
    }
  }
  const emailField = d.email;
  if (Array.isArray(emailField)) {
    const s = firstPickFromAffindaList(emailField);
    if (s) return s;
  }
  for (const key of [
    "email",
    "emailId",
    "emailID",
    "candidateEmail",
    "emailAddress",
    "primaryEmail",
    "contactEmail",
  ]) {
    const v = d[key];
    if (Array.isArray(v)) {
      const s = firstPickFromAffindaList(v);
      if (s) return s;
    }
    const s = pickRawString(v);
    if (s) return s;
  }

  /** Custom workspace schemas sometimes emit label/value tuples. */
  const tupleLists = [d.fields, d.dataPoints, d.components];
  for (const list of tupleLists) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const o = row as Record<string, unknown>;
      const label =
        pickRawString(o.name) ??
        pickRawString(o.label) ??
        pickRawString(o.field) ??
        pickRawString(o.key) ??
        pickRawString(o.title);
      if (!label || !/mail/i.test(label)) continue;
      const val =
        pickRawString(o.value) ??
        pickRawString(o.text) ??
        pickRawString(o.parsed);
      if (val) return val;
    }
  }

  return null;
}

function firstEmailWithAffindaFallbacks(d: Record<string, unknown>): string | null {
  const direct = firstEmailFromResumeData(d);
  if (direct) return direct;

  const fromSites = emailFromWebsiteEntries(d.websites ?? d.website);
  if (fromSites) return fromSites;

  for (const block of [d.rawText, d.text, d.plainText, d.documentText]) {
    if (typeof block === "string" && block.length) {
      const m = block.match(AFFINDA_EMAIL_LIKE);
      if (m) return m[0];
    }
  }

  return extractEmailRegexFromBlob(d);
}

function pickPhoneFromEntry(entry: unknown): string | null {
  const s = pickRawString(entry);
  if (s) return s;
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const o = entry as Record<string, unknown>;
    for (const key of [
      "formattedNumber",
      "nationalNumber",
      "internationalNumber",
      "rawInput",
      "rawText",
      "normalized",
    ]) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

function firstPhoneFromResumeData(d: Record<string, unknown>): string | null {
  const arrays = [
    d.phoneNumbers,
    d.phoneNumberDetails,
    d.phoneNumber,
    d.telephoneNumbers,
    d.mobileNumbers,
  ];
  for (const list of arrays) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const p = pickPhoneFromEntry(entry);
      if (p) return p;
    }
  }
  const singles = [d.phoneNumber, d.phone, d.telephoneNumber, d.mobileNumber];
  for (const x of singles) {
    if (x === undefined || x === null) continue;
    if (Array.isArray(x)) {
      for (const entry of x) {
        const p = pickPhoneFromEntry(entry);
        if (p) return p;
      }
    } else {
      const p = pickPhoneFromEntry(x);
      if (p) return p;
    }
  }
  return null;
}

function resolveAffindaApiKey(): string {
  const explicit = normalizeEnv(process.env.AFFINDA_API_KEY);
  if (explicit) return explicit;
  return normalizeEnv(process.env.HIRING_RESUME_PARSE_API_KEY);
}

/** True when workspace + API key are set (Affinda path replaces OpenAI chat parsing). */
export function isAffindaResumeParsingConfigured(): boolean {
  const ws = normalizeEnv(process.env.AFFINDA_WORKSPACE);
  const key = resolveAffindaApiKey();
  return !!(ws && key);
}

export function resolveAffindaBaseUrl(): string {
  const raw = normalizeEnv(process.env.AFFINDA_API_BASE_URL);
  const base = raw || "https://api.affinda.com";
  return base.replace(/\/$/, "");
}

function mimeForAffindaBlob(fileName: string, mimeHint?: string): string {
  const hint = (mimeHint || "").toLowerCase();
  if (hint && hint !== "application/octet-stream") return hint;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

/** Map Affinda resume `data` JSON to our staging shape (defensive — schema varies by extractor version). */
export function mapAffindaResumeDataToParsedFields(data: unknown): ParsedResumeFields {
  const d = flattenAffindaResumeData(data);

  let fullName: string | null = null;

  const cn = d.candidateName;
  if (cn && typeof cn === "object") {
    const o = cn as Record<string, unknown>;
    const joinedName = [
      pickRawString(o.first) ?? pickRawString(o.candidateNameFirst) ?? pickRawString(o.givenName),
      pickRawString(o.middle) ?? pickRawString(o.candidateNameMiddle),
      pickRawString(o.last) ?? pickRawString(o.candidateNameFamily) ?? pickRawString(o.familyName),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    fullName =
      pickRawString(o.raw) ??
      pickRawString(o.formatted) ??
      (joinedName.length ? joinedName : null);
  }
  if (!fullName) fullName = pickRawString(d.name) ?? pickRawString(d.fullName);

  const email = firstEmailWithAffindaFallbacks(d);
  const phone = firstPhoneFromResumeData(d);

  let candidateLocation: string | null = null;
  const loc = d.location;
  if (loc && typeof loc === "object") {
    const o = loc as Record<string, unknown>;
    const joinedLoc = [
      pickRawString(o.city),
      pickRawString(o.state),
      pickRawString(o.country),
    ]
      .filter(Boolean)
      .join(", ")
      .trim();
    candidateLocation =
      pickRawString(o.raw) ??
      pickRawString(o.formatted) ??
      pickRawString(o.rawInput) ??
      pickRawString(o.city) ??
      (joinedLoc.length ? joinedLoc : null);
  }
  if (!candidateLocation) candidateLocation = pickRawString(d.candidateLocation);

  const parsed: ParsedResumeFields = {
    fullName,
    email,
    phone,
    candidateLocation,
    fieldConfidence: {},
  };

  return sanitizeParsedResumeFields(parsed);
}

function extractIdentifier(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const meta = o.meta as Record<string, unknown> | undefined;
  if (meta && typeof meta.identifier === "string" && meta.identifier.trim())
    return meta.identifier.trim();
  if (typeof o.identifier === "string" && o.identifier.trim()) return o.identifier.trim();
  return null;
}

function extractReady(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const meta = (body as { meta?: { ready?: boolean } }).meta;
  return meta?.ready === true;
}

const AFFINDA_PROCESSING_FALLBACK = "Affinda reported a processing error.";

/** True when `v` carries no signal (null, empty string, empty container, numeric 0, or object whose values are all absent). */
function valueIsAbsent(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return true;
  if (typeof v === "string") return !v.trim();
  if (typeof v === "number") return v === 0 || Number.isNaN(v);
  if (Array.isArray(v)) return v.length === 0 || v.every(valueIsAbsent);
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    if (keys.length === 0) return true;
    return keys.every((k) => valueIsAbsent((v as Record<string, unknown>)[k]));
  }
  return false;
}

/**
 * Affinda often includes an `error` object on ready documents even when there is no failure
 * (e.g. `{ errorCode: null, errorDetail: null }`). Only treat non-empty payloads as failures.
 */
function affindaDocumentErrorIsMeaningful(err: unknown): boolean {
  if (err === null || err === undefined || err === false || err === "") return false;
  if (typeof err === "string") return err.trim().length > 0;
  if (Array.isArray(err)) return err.some((x) => !valueIsAbsent(x));
  if (typeof err !== "object") return true;
  return Object.values(err as Record<string, unknown>).some((v) => !valueIsAbsent(v));
}

/** Affinda sets `meta.ready` with an `error` object when extraction failed; shape varies by API version. */
function describeAffindaDocumentError(err: unknown): string {
  if (err === null || err === undefined) return AFFINDA_PROCESSING_FALLBACK;
  if (typeof err === "string") {
    const t = err.trim();
    return t || AFFINDA_PROCESSING_FALLBACK;
  }
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const key of ["detail", "message", "description", "title"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    const nestedErr = o.error;
    if (typeof nestedErr === "string" && nestedErr.trim()) return nestedErr.trim();
    if (nestedErr && typeof nestedErr === "object") {
      const inner = nestedErr as Record<string, unknown>;
      for (const key of ["detail", "message"]) {
        const v = inner[key];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    }
    const code = typeof o.code === "string" && o.code.trim() ? o.code.trim() : null;
    const msg = typeof o.msg === "string" && o.msg.trim() ? o.msg.trim() : null;
    if (code && msg) return `${code}: ${msg}`;
    if (code) return code;
    if (msg) return msg;

    const errors = o.errors;
    if (Array.isArray(errors) && errors.length) {
      const parts: string[] = [];
      for (const item of errors) {
        if (typeof item === "string" && item.trim()) parts.push(item.trim());
        else if (item && typeof item === "object") {
          const ei = item as Record<string, unknown>;
          const bit =
            (typeof ei.detail === "string" && ei.detail.trim()) ||
            (typeof ei.message === "string" && ei.message.trim()) ||
            "";
          if (bit) parts.push(bit);
        }
      }
      if (parts.length) return parts.slice(0, 5).join("; ");
    }
    try {
      const json = JSON.stringify(err);
      if (json !== "{}" && json.length <= 560 && affindaDocumentErrorIsMeaningful(err)) {
        return `Affinda: ${json}`;
      }
    } catch {
      /* ignore */
    }
  }
  return AFFINDA_PROCESSING_FALLBACK;
}

async function readAffindaError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string;
      error?: string | { message?: string };
      detail?: string;
    };
    if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail.trim();
    const e = body.error;
    if (typeof e === "string" && e.trim()) return e.trim();
    if (e && typeof e === "object" && typeof e.message === "string") return e.message.trim();
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * Upload file to Affinda v3 Documents API and poll until parsed data is ready.
 * @see https://docs.affinda.com/resumes/integration
 */
export async function parseResumeWithAffinda(opts: {
  buffer: Buffer;
  fileName: string;
  mimeHint?: string;
}): Promise<AffindaParseOutcome> {
  const stub: ParsedResumeFields = {
    fullName: null,
    email: null,
    phone: null,
    candidateLocation: null,
    fieldConfidence: {},
  };

  const workspace = normalizeEnv(process.env.AFFINDA_WORKSPACE);
  const apiKey = resolveAffindaApiKey();
  const base = resolveAffindaBaseUrl();

  if (!workspace || !apiKey) {
    return {
      ok: false,
      error:
        "Affinda is not configured (set AFFINDA_WORKSPACE and AFFINDA_API_KEY or HIRING_RESUME_PARSE_API_KEY).",
      parsed: stub,
    };
  }

  if (opts.buffer.length > AFFINDA_RESUME_MAX_BYTES) {
    return {
      ok: false,
      error: `File exceeds Affinda résumé limit (${AFFINDA_RESUME_MAX_BYTES / (1024 * 1024)} MB). Compress or split uploads.`,
      parsed: stub,
    };
  }

  const mime = mimeForAffindaBlob(opts.fileName, opts.mimeHint);
  let postRes: Response;
  try {
    const fd = new FormData();
    fd.append(
      "file",
      new Blob([new Uint8Array(opts.buffer)], { type: mime }),
      opts.fileName.slice(0, 280),
    );
    fd.append("workspace", workspace);
    fd.append("wait", "true");
    fd.append("compact", "true");
    const documentType =
      normalizeEnv(process.env.AFFINDA_RESUME_DOCUMENT_TYPE) ||
      normalizeEnv(process.env.AFFINDA_DOCUMENT_TYPE);
    if (documentType) fd.append("documentType", documentType);

    postRes = await fetch(`${base}/v3/documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: fd,
    });
  } catch {
    return {
      ok: false,
      error: "Could not reach Affinda API. Check AFFINDA_API_BASE_URL for your region.",
      parsed: stub,
    };
  }

  if (!postRes.ok) {
    const detail = await readAffindaError(postRes);
    const suffix = detail ? ` ${detail}` : "";
    const hint =
      postRes.status === 401
        ? " Invalid API key or wrong region URL (api.affinda.com vs api.us1.affinda.com vs api.eu1.affinda.com)."
        : "";
    return {
      ok: false,
      error: `Affinda upload failed (HTTP ${postRes.status}).${suffix}${hint}`,
      parsed: stub,
    };
  }

  let postJson: unknown;
  try {
    postJson = await postRes.json();
  } catch {
    return { ok: false, error: "Affinda returned invalid JSON after upload.", parsed: stub };
  }

  const identifier = extractIdentifier(postJson);
  if (!identifier) {
    return {
      ok: false,
      error: "Affinda did not return a document identifier.",
      parsed: stub,
    };
  }

  if (extractReady(postJson)) {
    const errRaw = (postJson as { error?: unknown }).error;
    if (affindaDocumentErrorIsMeaningful(errRaw)) {
      const msg = describeAffindaDocumentError(errRaw);
      return { ok: false, error: msg, parsed: stub };
    }
    const data = (postJson as { data?: unknown }).data;
    const parsed = mapAffindaResumeDataToParsedFields(data);
    return { ok: true, parsed, model: "affinda" };
  }

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await sleep(1000);

    let getRes: Response;
    try {
      getRes = await fetch(`${base}/v3/documents/${encodeURIComponent(identifier)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch {
      return {
        ok: false,
        error: "Lost connection while polling Affinda for parse results.",
        parsed: stub,
      };
    }

    if (!getRes.ok) {
      const detail = await readAffindaError(getRes);
      return {
        ok: false,
        error: `Affinda poll failed (HTTP ${getRes.status}).${detail ? ` ${detail}` : ""}`,
        parsed: stub,
      };
    }

    let doc: unknown;
    try {
      doc = await getRes.json();
    } catch {
      continue;
    }

    if (extractReady(doc)) {
      const errRaw = (doc as { error?: unknown }).error;
      if (affindaDocumentErrorIsMeaningful(errRaw)) {
        const detail = describeAffindaDocumentError(errRaw);
        return { ok: false, error: detail, parsed: stub };
      }
      const data = (doc as { data?: unknown }).data;
      const parsed = mapAffindaResumeDataToParsedFields(data);
      return { ok: true, parsed, model: "affinda" };
    }
  }

  return {
    ok: false,
    error: "Affinda parsing timed out after 60s. Try again or fill fields manually.",
    parsed: stub,
  };
}
