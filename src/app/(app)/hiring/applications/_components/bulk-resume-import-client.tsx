"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import type { ParsedResumeFields } from "@/lib/hiring-resume-llm";
import { formatDateTimeUtc } from "@/lib/utils";
import {
  commitBulkResumeImport,
  createBulkResumeImportFromUpload,
  discardBulkResumeImportBatch,
  type BulkImportCommitRow,
} from "../import-actions";

/** Must match AFFINDA_RESUME_MAX_BYTES in `@/lib/hiring-resume-affinda`. */
const AFFINDA_RESUME_MAX_BYTES_CLIENT = 5 * 1024 * 1024;

const EMPTY_PARSED: ParsedResumeFields = {
  fullName: null,
  email: null,
  phone: null,
  candidateLocation: null,
  fieldConfidence: {},
};

export type SerializedImportItem = {
  id: string;
  fileName: string;
  resumeUrl: string;
  status: string;
  error: string | null;
  parsedPayloadJson: string | null;
};

export type SerializedImportBatch = {
  id: string;
  sourceChannel: "UPLOAD" | "EMAIL";
  applicationSource: string | null;
  targetJobId: string | null;
  expiresAt: string;
  items: SerializedImportItem[];
  /** Server fingerprint so client rows refresh after committed imports */
  revision?: string;
};

function parseStoredPayload(raw: string | null): {
  parsed: ParsedResumeFields;
  warnings?: string[];
} {
  if (!raw) return { parsed: { ...EMPTY_PARSED } };
  try {
    const j = JSON.parse(raw) as { parsed?: ParsedResumeFields; warnings?: string[] };
    return {
      parsed: {
        fullName: j.parsed?.fullName ?? null,
        email: j.parsed?.email ?? null,
        phone: j.parsed?.phone ?? null,
        candidateLocation: j.parsed?.candidateLocation ?? null,
        fieldConfidence: j.parsed?.fieldConfidence ?? {},
      },
      warnings: j.warnings,
    };
  } catch {
    return { parsed: { ...EMPTY_PARSED } };
  }
}

type RowState = {
  itemId: string;
  include: boolean;
  fullName: string;
  email: string;
  phone: string;
  candidateLocation: string;
  warnings?: string[];
  status: string;
  serverError: string | null;
  resumeUrl: string;
};

function buildRows(batch: SerializedImportBatch | null): RowState[] {
  if (!batch) return [];
  return batch.items.map((it) => {
    const { parsed, warnings } = parseStoredPayload(it.parsedPayloadJson);
    return {
      itemId: it.id,
      include: it.status !== "IMPORTED",
      fullName: parsed.fullName ?? "",
      email: parsed.email ?? "",
      phone: parsed.phone ?? "",
      candidateLocation: parsed.candidateLocation ?? "",
      warnings,
      status: it.status,
      serverError: it.error,
      resumeUrl: it.resumeUrl,
    };
  });
}

export function BulkResumeImportClient(props: {
  openJobs: { id: string; title: string }[];
  initialBatch: SerializedImportBatch | null;
  webhookBaseUrl: string;
  affindaResumeParsingEnabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [jobId, setJobId] = useState("");
  const [source, setSource] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const [rows, setRows] = useState<RowState[]>(() => buildRows(props.initialBatch));

  const batchId = props.initialBatch?.id ?? null;

  const inboundWebhookHint = props.webhookBaseUrl
    ? `${props.webhookBaseUrl}/api/webhooks/hiring-resume-inbound`
    : "/api/webhooks/hiring-resume-inbound";

  const affindaOn = props.affindaResumeParsingEnabled ?? false;

  async function onUploadSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!jobId) {
      toast.error("Choose an open job.");
      return;
    }
    if (!files?.length) {
      toast.error("Choose one or more résumé files.");
      return;
    }
    if (affindaOn) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].size > AFFINDA_RESUME_MAX_BYTES_CLIENT) {
          toast.error(
            `${files[i].name}: exceeds Affinda’s ${AFFINDA_RESUME_MAX_BYTES_CLIENT / (1024 * 1024)} MB résumé limit.`,
          );
          return;
        }
      }
    }
    const fd = new FormData();
    fd.set("targetJobId", jobId);
    fd.set("applicationSource", source.trim());
    for (let i = 0; i < files.length; i++) {
      fd.append("resumeFiles", files[i]);
    }

    startTransition(async () => {
      const result = await createBulkResumeImportFromUpload(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Résumés processed — review fields below.");
      router.replace(`/hiring/applications/import?batch=${encodeURIComponent(result.batchId)}`);
      router.refresh();
    });
  }

  function updateRow(itemId: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.itemId === itemId ? { ...r, ...patch } : r)));
  }

  async function onCommit() {
    if (!batchId) return;
    const payload: BulkImportCommitRow[] = rows.map((r) => ({
      itemId: r.itemId,
      include: r.include && r.status !== "IMPORTED",
      fullName: r.fullName,
      email: r.email,
      phone: r.phone || null,
      candidateLocation: r.candidateLocation || null,
    }));

    startTransition(async () => {
      const { results } = await commitBulkResumeImport(batchId, payload);
      let imported = 0;
      let failed = 0;
      const next = [...rows];
      for (const res of results) {
        const idx = next.findIndex((x) => x.itemId === res.itemId);
        if (idx === -1) continue;
        const attempt = payload.find((p) => p.itemId === res.itemId)?.include ?? false;
        if (!attempt) continue;
        if (res.ok) {
          imported++;
          next[idx] = { ...next[idx], status: "IMPORTED", include: false, serverError: null };
        } else {
          failed++;
          next[idx] = { ...next[idx], serverError: res.error ?? "Failed" };
        }
      }
      setRows(next);
      if (failed && imported) {
        toast.message(`Imported ${imported} row(s); ${failed} failed — fix and retry.`);
      } else if (failed) {
        toast.error(`${failed} row(s) failed — fix errors and try again.`);
      } else if (imported) {
        toast.success(`Imported ${imported} candidate(s).`);
      }
      router.refresh();
    });
  }

  async function onDiscard() {
    if (!batchId) return;
    startTransition(async () => {
      const r = await discardBulkResumeImportBatch(batchId);
      if (!r.ok) {
        toast.error(r.error ?? "Could not discard.");
        return;
      }
      toast.success("Draft discarded.");
      router.replace("/hiring/applications/import");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <Card className="border-ink-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <CardHeader className="border-b border-ink-100">
          <CardTitle className="text-base">Inbound email (optional)</CardTitle>
          <CardDescription>
            Forward résumés from mail to your ingress provider so each message POSTs multipart attachments to your webhook.
            Configure <code className="text-xs bg-ink-100 px-1 rounded">HIRING_RESUME_INBOUND_SECRET</code>,{" "}
            <code className="text-xs bg-ink-100 px-1 rounded">HIRING_INBOUND_DEFAULT_JOB_ID</code>, and point the vendor at{" "}
            <code className="text-xs bg-ink-100 px-1 rounded break-all">{inboundWebhookHint}</code>.
            Authenticate with header{" "}
            <code className="text-xs bg-ink-100 px-1 rounded">Authorization: Bearer …</code> or{" "}
            <code className="text-xs bg-ink-100 px-1 rounded">X-Hiring-Inbound-Secret</code>.
          </CardDescription>
        </CardHeader>
      </Card>

      {!batchId ? (
        <Card className="border-ink-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <CardHeader>
            <CardTitle className="text-base">Upload from computer</CardTitle>
            <CardDescription className="space-y-2">
              <span className="block">
                PDF or DOCX — stored files may be up to <strong>12 MB</strong> each.
                {affindaOn ? (
                  <>
                    {" "}
                    With{" "}
                    <a
                      href="https://docs.affinda.com/resumes/integration"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-sky-700 underline-offset-4 hover:underline"
                    >
                      Affinda
                    </a>{" "}
                    parsing enabled, each résumé must be ≤ <strong>5 MB</strong> (their résumé API limit).
                  </>
                ) : (
                  <>
                    {" "}
                    Auto-filled columns use{" "}
                    <a
                      href="https://docs.affinda.com/resumes/integration"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-sky-700 underline-offset-4 hover:underline"
                    >
                      Affinda
                    </a>{" "}
                    only — OpenAI is not called. Until workspace + API key are configured on the server, type fields manually after upload.
                  </>
                )}
              </span>
              <span className="block text-xs text-ink-500 leading-relaxed">
                Env for parsing:{" "}
                <code className="bg-ink-100 px-1 rounded">AFFINDA_WORKSPACE</code>,{" "}
                <code className="bg-ink-100 px-1 rounded">AFFINDA_API_KEY</code> (or{" "}
                <code className="bg-ink-100 px-1 rounded">HIRING_RESUME_PARSE_API_KEY</code>
                ), optional{" "}
                <code className="bg-ink-100 px-1 rounded">AFFINDA_RESUME_DOCUMENT_TYPE</code> (Résumé Parser
                document type id),{" "}
                <code className="bg-ink-100 px-1 rounded">AFFINDA_API_BASE_URL</code>{" "}
                (<code className="bg-ink-100 px-1 rounded">https://api.affinda.com</code>,{" "}
                <code className="bg-ink-100 px-1 rounded">api.us1.affinda.com</code>,{" "}
                <code className="bg-ink-100 px-1 rounded">api.eu1.affinda.com</code>). Field reference:{" "}
                <a
                  href="https://docs.affinda.com/resumes/data-extracted"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-sky-700 underline-offset-4 hover:underline"
                >
                  Data extracted
                </a>
                .
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onUploadSubmit} className="space-y-5 max-w-xl">
              <div>
                <Label htmlFor="targetJobId">Open job posting</Label>
                <select
                  id="targetJobId"
                  name="targetJobId"
                  required
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <option value="">Select…</option>
                  {props.openJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
                {props.openJobs.length === 0 ? (
                  <p className="text-xs text-amber-700 mt-2">
                    No open postings —{" "}
                    <Link href="/hiring/jobs/new" className="font-semibold underline">
                      create one first
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="applicationSource">Source / portal label (optional)</Label>
                <Input
                  id="applicationSource"
                  name="applicationSource"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="LinkedIn, referral batch…"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="resumeFiles">Résumé files</Label>
                <Input
                  id="resumeFiles"
                  name="resumeFiles"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="mt-1.5 h-auto py-2 cursor-pointer"
                  onChange={(e) => setFiles(e.target.files)}
                />
              </div>
              <Button type="submit" variant="accent" disabled={pending || props.openJobs.length === 0}>
                {pending ? "Processing…" : "Parse résumés"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-ink-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-ink-100">
            <div>
              <CardTitle className="text-base">Review &amp; import</CardTitle>
              <CardDescription>
                Batch <span className="font-mono text-xs">{batchId}</span> · expires{" "}
                {formatDateTimeUtc(props.initialBatch!.expiresAt)} · channel{" "}
                {props.initialBatch!.sourceChannel}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onDiscard} disabled={pending}>
                Discard draft
              </Button>
              <Button type="button" variant="accent" size="sm" onClick={onCommit} disabled={pending}>
                {pending ? "Saving…" : "Import selected rows"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm min-w-[920px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-3 py-2 w-10">Use</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Full name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Résumé</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.itemId} className="align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={r.include}
                        disabled={r.status === "IMPORTED"}
                        onChange={(e) => updateRow(r.itemId, { include: e.target.checked })}
                        aria-label={`Include ${r.fileName}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-ink-600 max-w-[160px]">
                      <span className="break-all">{r.fileName}</span>
                      {r.status === "IMPORTED" ? (
                        <span className="block text-[10px] font-semibold uppercase text-emerald-700 mt-1">
                          Imported
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={r.fullName}
                        disabled={r.status === "IMPORTED"}
                        onChange={(e) => updateRow(r.itemId, { fullName: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={r.email}
                        disabled={r.status === "IMPORTED"}
                        onChange={(e) => updateRow(r.itemId, { email: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={r.phone}
                        disabled={r.status === "IMPORTED"}
                        onChange={(e) => updateRow(r.itemId, { phone: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={r.candidateLocation}
                        disabled={r.status === "IMPORTED"}
                        onChange={(e) => updateRow(r.itemId, { candidateLocation: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.resumeUrl.startsWith("/hiring-uploads/") ? (
                        <a
                          href={r.resumeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-sky-700 hover:underline"
                        >
                          Open file
                        </a>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-500 max-w-[220px]">
                      {r.serverError ? (
                        <span className="text-red-700">{r.serverError}</span>
                      ) : r.warnings?.length ? (
                        <span>{r.warnings.join(" · ")}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
