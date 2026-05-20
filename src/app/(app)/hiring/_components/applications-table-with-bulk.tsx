"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-header";
import { Select } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import {
  applicationSourceLabel,
  formatHiringJobLocation,
  splitCandidateFullName,
} from "@/lib/hiring-application-display";
import { ApplicationStageControl, type PipelineStageOption } from "./application-stage-control";
import {
  bulkDeleteHiringApplications,
  bulkMoveHiringApplicationsToJob,
  bulkUpdateApplicationStages,
} from "../actions";

export type SerializableApplicationRow = {
  id: string;
  appliedAtIso: string;
  applicationSource: string | null;
  candidate: {
    fullName: string;
    email: string;
    phone: string | null;
    candidateLocation: string | null;
    source: string | null;
  };
  job: {
    id: string;
    title: string;
    location: string | null;
    workArrangement: string;
  };
  pipelineStageId: string;
};

function BulkSubmit({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "outline" | "accent" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" className="h-9 shrink-0" disabled={pending}>
      {pending ? "…" : children}
    </Button>
  );
}

function BulkForms({
  selectedIds,
  returnPath,
  stages,
  jobsForBulkMove,
}: {
  selectedIds: string[];
  returnPath: string;
  stages: PipelineStageOption[];
  jobsForBulkMove: { id: string; title: string }[];
}) {
  const hiddenFields = selectedIds.map((id) => (
    <input key={id} type="hidden" name="applicationId" value={id} />
  ));

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
      <form
        action={bulkUpdateApplicationStages}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2.5 shadow-sm"
      >
        <input type="hidden" name="returnPath" value={returnPath} />
        {hiddenFields}
        <div className="min-w-[160px]">
          <label htmlFor="bulk-stage" className="sr-only">
            Stage for bulk update
          </label>
          <Select id="bulk-stage" name="pipelineStageId" required defaultValue="" className="h-9 text-sm">
            <option value="" disabled>
              Stage…
            </option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <BulkSubmit variant="outline">Apply stage</BulkSubmit>
      </form>

      {jobsForBulkMove.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/50 px-3 py-2.5 text-xs text-ink-500 max-w-xs leading-relaxed">
          No postings available for bulk move — create or restore a job first.
        </div>
      ) : (
        <form
          action={bulkMoveHiringApplicationsToJob}
          className="flex flex-wrap items-end gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2.5 shadow-sm"
        >
          <input type="hidden" name="returnPath" value={returnPath} />
          {hiddenFields}
          <div className="min-w-[180px]">
            <label htmlFor="bulk-move-job" className="sr-only">
              Move to posting
            </label>
            <Select id="bulk-move-job" name="targetJobId" required defaultValue="" className="h-9 text-sm">
              <option value="" disabled>
                Move to posting…
              </option>
              {jobsForBulkMove.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </Select>
          </div>
          <BulkSubmit variant="outline">Move</BulkSubmit>
        </form>
      )}

      <form
        action={bulkDeleteHiringApplications}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-red-100 bg-red-50/40 px-3 py-2.5 shadow-sm"
        onSubmit={(e) => {
          if (
            !confirm(
              `Delete ${selectedIds.length} submission(s)? Candidate profiles stay; attachments on those rows are removed.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="returnPath" value={returnPath} />
        {hiddenFields}
        <BulkSubmit variant="danger">Delete selected</BulkSubmit>
      </form>
    </div>
  );
}

export function ApplicationsTableWithBulk({
  rows,
  filtersActive,
  stageSelectOptions,
  jobsForBulkMove,
  returnPath,
}: {
  rows: SerializableApplicationRow[];
  filtersActive: boolean;
  stageSelectOptions: PipelineStageOption[];
  jobsForBulkMove: { id: string; title: string }[];
  returnPath: string;
}) {
  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const fromParam = useMemo(() => encodeURIComponent(returnPath), [returnPath]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    setSelected(new Set(rowIds));
  }, [rowIds]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectedOnPageCount = useMemo(
    () => rowIds.filter((id) => selected.has(id)).length,
    [rowIds, selected],
  );
  const allOnPageSelected = rows.length > 0 && selectedOnPageCount === rows.length;
  const someOnPageSelected = selectedOnPageCount > 0 && !allOnPageSelected;

  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) el.indeterminate = someOnPageSelected;
  }, [someOnPageSelected]);

  const selectedIds = useMemo(() => [...selected].filter((id) => rowIds.includes(id)), [selected, rowIds]);

  return (
    <>
      {selectedIds.length > 0 ? (
        <div className="px-4 py-3 border-b border-ink-100 bg-sky-50/60 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-ink-700">
            {selectedIds.length} selected
            <button
              type="button"
              className="ml-3 text-xs font-semibold text-sky-800 underline-offset-2 hover:underline"
              onClick={clearSelection}
            >
              Clear
            </button>
          </p>
          <BulkForms
            selectedIds={selectedIds}
            returnPath={returnPath}
            stages={stageSelectOptions}
            jobsForBulkMove={jobsForBulkMove}
          />
        </div>
      ) : null}

      <div className="overflow-x-auto relative">
        <table className="w-full text-sm min-w-[1120px]">
          <thead className="sticky top-0 z-[1] bg-ink-50/95 backdrop-blur-sm border-b border-ink-100">
            <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              <th className="px-3 py-3 w-10">
                <span className="sr-only">Select</span>
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={(e) => {
                    if (e.target.checked) selectAllOnPage();
                    else clearSelection();
                  }}
                  className="size-4 rounded border-ink-300 text-sky-600 focus:ring-sky-500"
                  disabled={rows.length === 0}
                  aria-label="Select all on this page"
                />
              </th>
              <th className="px-4 py-3 whitespace-nowrap">Date applied</th>
              <th className="px-4 py-3 whitespace-nowrap">First name</th>
              <th className="px-4 py-3 whitespace-nowrap">Last name</th>
              <th className="px-4 py-3 min-w-[180px]">Email</th>
              <th className="px-4 py-3 whitespace-nowrap">Phone</th>
              <th className="px-4 py-3 min-w-[140px]">Role applied for</th>
              <th className="px-4 py-3 min-w-[120px]">Job location</th>
              <th className="px-4 py-3 min-w-[120px]">Candidate location</th>
              <th className="px-4 py-3 min-w-[120px]">Source / job portal</th>
              <th className="px-4 py-3 min-w-[200px]">Stage</th>
              <th className="px-4 py-3 whitespace-nowrap">Application</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-6">
                  {filtersActive ? (
                    <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 px-6 py-12 text-center text-sm text-ink-500">
                      No applications match these filters —{" "}
                      <Link href="/hiring/applications" className="font-semibold text-sky-700 hover:underline">
                        clear filters
                      </Link>
                      .
                    </div>
                  ) : (
                    <EmptyState
                      emoji="📥"
                      title="No applications yet"
                      description="Add candidates one at a time or drop a batch of résumés — everything lands against open postings."
                      action={
                        <div className="flex flex-wrap gap-3 justify-center">
                          <Link href="/hiring/candidates/new">
                            <Button variant="accent" size="md">
                              Add candidate
                            </Button>
                          </Link>
                          <Link href="/hiring/applications/import">
                            <Button variant="outline" size="md">
                              Bulk import
                            </Button>
                          </Link>
                        </div>
                      }
                    />
                  )}
                </td>
              </tr>
            ) : (
              rows.map((app) => {
                const { firstName, lastName } = splitCandidateFullName(app.candidate.fullName);
                const portal = applicationSourceLabel(app.applicationSource, app.candidate.source);
                const jobLoc = formatHiringJobLocation(app.job);
                const detailHref = `/hiring/applications/${app.id}?from=${fromParam}`;
                return (
                  <tr key={app.id} className="align-top hover:bg-ink-50/40 transition-colors">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(app.id)}
                        onChange={() => toggle(app.id)}
                        className="size-4 rounded border-ink-300 text-sky-600 focus:ring-sky-500"
                        aria-label={`Select ${app.candidate.fullName}`}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-600 tabular-nums">
                      {formatDate(new Date(app.appliedAtIso))}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink-800">
                      <Link href={detailHref} className="text-sky-800 hover:underline">
                        {firstName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-800">
                      <Link href={detailHref} className="hover:underline">
                        {lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-600 break-all">{app.candidate.email}</td>
                    <td className="px-4 py-3 text-ink-600 whitespace-nowrap">{app.candidate.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/hiring/jobs/${app.job.id}`}
                        className="font-medium text-sky-800 hover:underline"
                      >
                        {app.job.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{jobLoc}</td>
                    <td className="px-4 py-3 text-ink-600">{app.candidate.candidateLocation ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-600">{portal}</td>
                    <td className="px-4 py-3">
                      <ApplicationStageControl
                        applicationId={app.id}
                        currentStageId={app.pipelineStageId}
                        stages={stageSelectOptions}
                        returnPath={returnPath}
                        compact
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={detailHref}
                        className="text-xs font-semibold text-sky-700 hover:underline whitespace-nowrap"
                      >
                        Open application →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
