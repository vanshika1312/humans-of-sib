"use client";

import { AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type AtsPreview = { score: number; matched: string[]; missing: string[]; jobTitle: string } | null;

type ParseResponse = {
  ok: boolean;
  error?: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  candidateLocation?: string | null;
  atsPreview?: AtsPreview;
};

function scoreTone(score: number): string {
  if (score >= 75) return "text-emerald-700";
  if (score >= 50) return "text-amber-700";
  return "text-ink-500";
}

/**
 * Drop-in replacement for a plain "résumé file" input on candidate intake/edit forms: uploads the
 * file to the résumé parsing API on selection, then auto-fills the given form fields (by DOM id)
 * with the extracted name/email/phone/location — and, when a job is selected, previews an ATS-style
 * skill match score. The file input itself keeps posting normally as part of the surrounding
 * `<form action={...}>` server action.
 */
export function ResumeAutofillPanel({
  inputId,
  inputName = "resumeFile",
  fieldIds,
  jobSelectId,
  helperText,
  fillMode = "empty-only",
}: {
  inputId: string;
  inputName?: string;
  fieldIds: {
    fullName?: string;
    email?: string;
    phone?: string;
    candidateLocation?: string;
  };
  /** DOM id of a <select> whose current value is the job to preview an ATS score against. */
  jobSelectId?: string;
  helperText?: string;
  /**
   * `empty-only` — never clobber values the recruiter already typed (intake).
   * `overwrite` — always replace from the résumé (profile update / replace file).
   */
  fillMode?: "empty-only" | "overwrite";
}) {
  const [status, setStatus] = useState<"idle" | "parsing" | "done" | "error">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ats, setAts] = useState<AtsPreview>(null);

  function setFieldValue(id: string | undefined, value: string | null | undefined) {
    if (!id || !value || !value.trim()) return;
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    if (fillMode === "empty-only" && el.value.trim()) return;
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setStatus("parsing");
    setMessage(null);
    setAts(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const jobId = jobSelectId
        ? (document.getElementById(jobSelectId) as HTMLSelectElement | null)?.value?.trim()
        : "";
      if (jobId) fd.append("jobId", jobId);

      const res = await fetch("/api/hiring/resume/parse", { method: "POST", body: fd });
      const data = (await res.json()) as ParseResponse;

      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not parse that résumé — fill fields in manually.");
        return;
      }

      setFieldValue(fieldIds.fullName, data.fullName);
      setFieldValue(fieldIds.email, data.email);
      setFieldValue(fieldIds.phone, data.phone);
      setFieldValue(fieldIds.candidateLocation, data.candidateLocation);
      setAts(data.atsPreview ?? null);
      setStatus("done");
      setMessage("Parsed with keyword matching — double-check the fields above.");
    } catch {
      setStatus("error");
      setMessage("Something went wrong while parsing. Fill fields in manually.");
    }
  }

  return (
    <div>
      <input
        id={inputId}
        name={inputName}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="mt-1.5 block w-full text-sm text-ink-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink-700 hover:file:bg-ink-200 cursor-pointer"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {helperText ? <p className="text-xs text-ink-400 mt-1 leading-relaxed">{helperText}</p> : null}

      {status === "parsing" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-sky-700">
          <Loader2 size={13} className="animate-spin" />
          Reading {fileName} and filling in details…
        </p>
      )}
      {status === "done" && message && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 size={13} />
          {message}
        </p>
      )}
      {status === "error" && message && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-700">
          <AlertCircle size={13} />
          {message}
        </p>
      )}

      {ats && (
        <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50/60 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-700">
              <Sparkles size={13} className="text-sky-600" />
              ATS match for {ats.jobTitle}
            </p>
            <span className={cn("text-sm font-bold tabular-nums", scoreTone(ats.score))}>{ats.score}%</span>
          </div>
          {ats.matched.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {ats.matched.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          {ats.missing.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ats.missing.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-ink-400 ring-1 ring-ink-200"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
