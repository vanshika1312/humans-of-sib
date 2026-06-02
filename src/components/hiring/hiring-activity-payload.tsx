import type { HiringActivityKind } from "@/generated/prisma";
import type { ReactNode } from "react";

type HiringActivityPayloadBlockProps = {
  kind: HiringActivityKind;
  payloadJson: string;
  /** Candidate timeline: hide raw JSON / technical disclosure UI; show human-readable extras only. */
  timelineSurface?: boolean;
};

/** Turn stored audit JSON into a short, recruiter-friendly recap (timeline / duplicate intake UI). */
export function HiringActivityPayloadBlock({
  kind,
  payloadJson,
  timelineSurface,
}: HiringActivityPayloadBlockProps) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson) as unknown;
  } catch {
    if (timelineSurface) return null;
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

  const extra = readableExtras(kind, parsed, { timelineSurface });

  if (timelineSurface) {
    if (!extra) return null;
    return (
      <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50/50 px-3 py-2 text-left text-xs text-ink-600">
        {extra}
      </div>
    );
  }

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

function reviewRoundInterviewerLines(o: Record<string, unknown>): ReactNode[] {
  const lines: ReactNode[] = [];
  const roundLabel = typeof o.roundLabel === "string" ? o.roundLabel : null;
  if (roundLabel) {
    lines.push(
      <p key="round">
        <span className="text-ink-400">Round:</span> {roundLabel}
      </p>,
    );
  }
  const interviewer = typeof o.interviewer === "string" ? o.interviewer : null;
  if (interviewer) {
    lines.push(
      <p key="interviewer">
        <span className="text-ink-400">Interviewer:</span> {interviewer}
      </p>,
    );
  }
  return lines;
}

function readableExtras(
  kind: HiringActivityKind,
  payload: unknown,
  opts?: { timelineSurface?: boolean },
): ReactNode | null {
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
    case "APPLICATION_REVIEW_UPDATED": {
      const changedObj = typeof o.changed === "object" && o.changed ? (o.changed as Record<string, unknown>) : {};
      const ratingChanged = changedObj.rating === true;
      const commentChanged = changedObj.comment === true;
      const interviewerChanged = changedObj.interviewer === true;

      const before = typeof o.before === "object" && o.before ? (o.before as Record<string, unknown>) : {};
      const after = typeof o.after === "object" && o.after ? (o.after as Record<string, unknown>) : {};

      const beforeRating = before.rating;
      const afterRating = after.rating;
      const beforeComment = typeof before.comment === "string" ? before.comment : null;
      const afterComment = typeof after.comment === "string" ? after.comment : null;
      const beforeInterviewer = typeof before.interviewer === "string" ? before.interviewer : null;
      const afterInterviewer = typeof after.interviewer === "string" ? after.interviewer : null;

      const lines: ReactNode[] = [...reviewRoundInterviewerLines(o)];
      if (ratingChanged) {
        lines.push(
          <span key="rating">
            <span className="text-ink-400">Rating:</span>{" "}
            <span className="text-ink-500">{beforeRating == null ? "—" : String(beforeRating)}</span> →{" "}
            <span>{afterRating == null ? "—" : String(afterRating)}</span>
          </span>,
        );
      }
      if (commentChanged) {
        lines.push(
          <span key="comment">
            <span className="text-ink-400">Written feedback:</span>{" "}
            {beforeComment && afterComment ? (
              <span className="whitespace-pre-wrap">
                <span className="text-ink-500">“{beforeComment}”</span> → <span>“{afterComment}”</span>
              </span>
            ) : (
              <span>updated</span>
            )}
          </span>,
        );
      }
      if (interviewerChanged) {
        lines.push(
          <span key="interviewer-change">
            <span className="text-ink-400">Interviewer:</span>{" "}
            <span className="text-ink-500">{beforeInterviewer ?? "—"}</span> →{" "}
            <span>{afterInterviewer ?? "—"}</span>
          </span>,
        );
      }

      if (lines.length === 0) return null;

      return (
        <ul className="list-disc list-inside space-y-0.5 text-ink-700">
          {lines.map((x, idx) => (
            <li key={idx}>{x}</li>
          ))}
        </ul>
      );
    }
    case "APPLICATION_REVIEW_DELETED": {
      const del = typeof o.deleted === "object" && o.deleted ? (o.deleted as Record<string, unknown>) : {};
      const rating = del.rating;
      const comment = typeof del.comment === "string" ? del.comment : null;
      const lines: ReactNode[] = [...reviewRoundInterviewerLines(o)];
      if (rating != null) {
        lines.push(
          <span key="rating">
            <span className="text-ink-400">Rating:</span> {String(rating)}
          </span>,
        );
      }
      if (comment) {
        lines.push(
          <span key="comment" className="whitespace-pre-wrap">
            <span className="text-ink-400">Deleted feedback:</span> “{comment}”
          </span>,
        );
      }
      if (lines.length === 0) return null;
      return (
        <ul className="list-disc list-inside space-y-0.5 text-ink-700">
          {lines.map((x, idx) => (
            <li key={idx}>{x}</li>
          ))}
        </ul>
      );
    }
    case "APPLICATION_INTERVIEW_SCHEDULED": {
      const when =
        typeof o.scheduledAt === "string"
          ? new Date(o.scheduledAt)
          : null;
      const tz = typeof o.timezone === "string" ? o.timezone : null;
      const mins = typeof o.durationMinutes === "number" ? o.durationMinutes : null;
      const link =
        typeof o.googleCalendarHtmlLink === "string" && o.googleCalendarHtmlLink.trim()
          ? o.googleCalendarHtmlLink.trim()
          : null;
      const interviewers =
        Array.isArray(o.interviewerNames) && o.interviewerNames.length
          ? o.interviewerNames.map(String).join(", ")
          : null;
      const loc = typeof o.locationOrLink === "string" && o.locationOrLink.trim() ? o.locationOrLink.trim() : null;

      return (
        <ul className="list-disc list-inside space-y-0.5 text-ink-700">
          {when && !Number.isNaN(when.getTime()) ? (
            <li>
              <span className="text-ink-400">When:</span> {when.toLocaleString("en-IN", { timeZone: tz ?? undefined })}
              {tz ? ` (${tz})` : ""}
              {mins ? ` · ${mins} min` : ""}
            </li>
          ) : null}
          {interviewers ? (
            <li>
              <span className="text-ink-400">Interviewers:</span> {interviewers}
            </li>
          ) : null}
          {loc ? (
            <li>
              <span className="text-ink-400">Location / link:</span> {loc}
            </li>
          ) : null}
          {link ? (
            <li>
              <a href={link} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">
                Open in Google Calendar
              </a>
            </li>
          ) : null}
        </ul>
      );
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
      return opts?.timelineSurface ? (
        <p className="text-ink-500">Profile fields updated.</p>
      ) : (
        <p className="text-ink-500">Profile fields changed — expand below for the full snapshot.</p>
      );
    }
    case "CANDIDATE_CREATED":
      if (opts?.timelineSurface) return null;
      return <p className="text-ink-500">Intake snapshot — expand below only if you need the raw payload.</p>;
    case "APPLICATION_NOTES_UPDATED": {
      const before = typeof o.before === "string" ? o.before : o.before == null ? null : String(o.before);
      const after = typeof o.after === "string" ? o.after : o.after == null ? null : String(o.after);
      if (!before && !after) return null;
      return (
        <p className="text-ink-600 whitespace-pre-wrap">
          <span className="text-ink-400">Notes:</span>{" "}
          {before ? <span className="text-ink-500">“{before.slice(0, 120)}{before.length > 120 ? "…" : ""}”</span> : "—"}
          {" → "}
          {after ? <span>“{after.slice(0, 120)}{after.length > 120 ? "…" : ""}”</span> : "cleared"}
        </p>
      );
    }
    case "APPLICATION_ATTACHMENT_ADDED":
    case "APPLICATION_ATTACHMENT_REMOVED": {
      const fileName = typeof o.fileName === "string" ? o.fileName : null;
      const category = typeof o.category === "string" ? o.category : null;
      if (!fileName && !category) return null;
      return (
        <p className="text-ink-600">
          {category ? (
            <>
              <span className="text-ink-400">Type:</span> {category}
              {fileName ? " · " : null}
            </>
          ) : null}
          {fileName ? (
            <>
              <span className="text-ink-400">File:</span> {fileName}
            </>
          ) : null}
        </p>
      );
    }
    case "APPLICATION_REVIEW_ADDED": {
      const rating = o.rating;
      const comment = typeof o.comment === "string" ? o.comment : null;
      const lines = [...reviewRoundInterviewerLines(o)];
      if (rating != null) {
        lines.push(
          <p key="rating">
            <span className="text-ink-400">Rating:</span> {String(rating)}
          </p>,
        );
      }
      if (comment) {
        lines.push(
          <p key="comment" className="whitespace-pre-wrap">
            <span className="text-ink-400">Feedback:</span> “{comment}”
          </p>,
        );
      }
      if (lines.length === 0) return null;
      return <div className="space-y-1 text-ink-600">{lines}</div>;
    }
    case "JOB_UPDATED": {
      const before = typeof o.before === "object" && o.before ? (o.before as Record<string, unknown>) : null;
      const after = typeof o.after === "object" && o.after ? (o.after as Record<string, unknown>) : null;
      if (!before || !after) return null;
      const labels: Record<string, string> = {
        title: "Title",
        status: "Status",
        location: "Location",
        openings: "Openings",
        workArrangement: "Work arrangement",
      };
      const changed = changedFields(before, after);
      const keys = Object.keys(changed).filter((k) => labels[k]);
      if (keys.length === 0) {
        return opts?.timelineSurface ? (
          <p className="text-ink-500">Posting details updated.</p>
        ) : null;
      }
      return (
        <ul className="list-disc list-inside space-y-0.5 text-ink-700">
          {keys.map((key) => (
            <li key={key}>
              <span className="font-medium">{labels[key]}</span>
              {": "}
              <span className="text-ink-500">{String(changed[key].before ?? "—")}</span>
              {" → "}
              <span>{String(changed[key].after ?? "—")}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "BULK_APPLICATIONS_DELETED": {
      const count = typeof o.count === "number" ? o.count : null;
      if (count == null) return null;
      return (
        <p className="text-ink-600">
          <span className="text-ink-400">Rows removed:</span> {count}
        </p>
      );
    }
    case "REQUISITION_REJECTED": {
      const note = typeof o.reviewNote === "string" ? o.reviewNote.trim() : "";
      if (!note) return null;
      return (
        <p className="text-ink-600 whitespace-pre-wrap">
          <span className="text-ink-400">Decline note:</span> {note}
        </p>
      );
    }
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
