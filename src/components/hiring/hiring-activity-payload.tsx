import type { HiringActivityKind } from "@/generated/prisma";
import type { ReactNode } from "react";

type HiringActivityPayloadBlockProps = {
  kind: HiringActivityKind;
  payloadJson: string;
};

/** Turn stored audit JSON into a short, recruiter-friendly recap (timeline / duplicate intake UI). */
export function HiringActivityPayloadBlock({ kind, payloadJson }: HiringActivityPayloadBlockProps) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson) as unknown;
  } catch {
    return (
      <details className="mt-3 rounded-lg border border-ink-100 bg-ink-50/50 text-left">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-500 hover:text-ink-700 select-none">
          Raw event data (unparseable)
        </summary>
        <pre className="mx-3 mb-3 max-h-40 overflow-auto rounded-md bg-white p-2 text-[10px] leading-snug text-ink-600 whitespace-pre-wrap border border-ink-100">
          {payloadJson}
        </pre>
      </details>
    );
  }

  const extra = readableExtras(kind, parsed);

  return (
    <details className="mt-3 rounded-lg border border-ink-100 bg-ink-50/50 text-left">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-500 hover:text-ink-700 select-none">
        Stored fields · expand for technical JSON
      </summary>
      {extra ? <div className="border-t border-ink-100 bg-white/70 px-3 py-2 text-xs text-ink-600">{extra}</div> : null}
      <pre className="mx-3 mb-3 max-h-36 overflow-auto rounded-md bg-white p-2 text-[10px] leading-snug text-ink-500 whitespace-pre-wrap border border-ink-100">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    </details>
  );
}

function readableExtras(kind: HiringActivityKind, payload: unknown): ReactNode | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;

  switch (kind) {
    case "APPLICATION_STAGE_CHANGED": {
      const from =
        typeof o.fromStageLabel === "string"
          ? o.fromStageLabel
          : typeof o.fromStage === "string"
            ? o.fromStage
            : typeof o.fromStageKey === "string"
              ? o.fromStageKey
              : null;
      const to =
        typeof o.toStageLabel === "string"
          ? o.toStageLabel
          : typeof o.toStage === "string"
            ? o.toStage
            : typeof o.toStageKey === "string"
              ? o.toStageKey
              : null;
      if (typeof from === "string" && typeof to === "string" && from === to) {
        return (
          <p className="text-ink-500">
            Stage recorded as both <strong>{from}</strong> — no change.
          </p>
        );
      }
      return null;
    }
    case "APPLICATION_CREATED": {
      const src = o.applicationSource;
      if (typeof src === "string" && src.trim()) {
        return (
          <p>
            <span className="text-ink-400">Source on application:</span> {src}
          </p>
        );
      }
      return null;
    }
    case "CANDIDATE_DUPLICATE_INTAKE": {
      const rows: { label: string; value: string }[] = [];
      const push = (label: string, v: unknown) => {
        if (v == null) return;
        const s = String(v).trim();
        if (!s) return;
        rows.push({ label, value: s });
      };
      push("Name on form", o.fullName);
      push("Phone", o.phone);
      push("Location", o.candidateLocation);
      push("Source", o.source);
      push("Résumé link / path", o.resumeUrl);
      push("Notes", o.notes);
      if ("targetJobId" in o && o.targetJobId) push("Requested job ID", o.targetJobId);
      if (rows.length === 0) return null;
      return (
        <dl className="grid gap-1.5">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <dt className="text-ink-400 shrink-0">{r.label}</dt>
              <dd className="text-ink-700 break-all">{r.value}</dd>
            </div>
          ))}
        </dl>
      );
    }
    case "CANDIDATE_UPDATED": {
      const before = o.before;
      const after = o.after;
      if (
        typeof before === "object" &&
        before &&
        typeof after === "object" &&
        after &&
        Object.keys(changedFields(before as Record<string, unknown>, after as Record<string, unknown>)).length > 0
      ) {
        const labels: Record<string, string> = {
          fullName: "Name",
          email: "Email",
          phone: "Phone",
          candidateLocation: "Location",
          source: "Source",
          resumeUrl: "Résumé",
          notes: "Notes",
        };
        const changed = changedFields(before as Record<string, unknown>, after as Record<string, unknown>);
        return (
          <ul className="list-disc list-inside space-y-0.5 text-ink-700">
            {Object.entries(changed).map(([key, pair]) => (
              <li key={key}>
                <span className="font-medium">{labels[key] ?? key}</span>
                {": "}
                <span className="text-ink-500">{String(pair.before || "—")}</span>
                {" → "}
                <span>{String(pair.after || "—")}</span>
              </li>
            ))}
          </ul>
        );
      }
      return <p className="text-ink-500">Profile fields changed — expand below for the full snapshot.</p>;
    }
    case "CANDIDATE_CREATED":
      return <p className="text-ink-500">Intake snapshot — expand below only if you need the raw payload.</p>;
    default:
      return null;
  }
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> {
  const out: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      out[k] = { before: b, after: a };
    }
  }
  return out;
}
