"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { DepartmentNameField } from "@/components/workspace/department-name-field";
import { createJob } from "@/app/(app)/hiring/actions";
import { HIRING_JOB_STATUSES, JOB_STATUS_LABEL } from "@/lib/hiring-copy";
import { WORK_ARRANGEMENT_OPTIONS } from "@/lib/hiring-job-copy";

const STORAGE_KEY = "humans-of-sib:hiring-new-job-draft:v1";

type Draft = Record<string, string>;

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(form: HTMLFormElement) {
  const fd = new FormData(form);
  const o: Draft = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") o[k] = v;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
}

export function NewOpeningForm() {
  const formId = useId();
  const draftFormId = `${formId}-new-opening-draft`;
  const formRef = useRef<HTMLFormElement>(null);
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    setDraft(readDraft());
    setMounted(true);
  }, []);

  const flushSave = useCallback(() => {
    const el = formRef.current;
    if (el) writeDraft(el);
  }, []);

  useEffect(() => {
    const el = formRef.current;
    if (!el || !mounted) return;
    const t = window.setInterval(flushSave, 8000);
    return () => window.clearInterval(t);
  }, [mounted, flushSave]);

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="rounded-2xl border border-ink-100 bg-white shadow-sm p-6 md:p-8 min-h-[480px]"
      />
    );
  }

  const d = draft ?? {};

  return (
    <form
      ref={formRef}
      id={draftFormId}
      action={createJob}
      onInput={flushSave}
      onBlurCapture={flushSave}
      onSubmit={() => localStorage.removeItem(STORAGE_KEY)}
      className="rounded-2xl border border-ink-100 bg-white shadow-sm p-6 md:p-8 space-y-6"
    >
      <div className="rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2 text-xs text-sky-950">
        Your inputs are remembered on this browser until you save - safe for drafts including when status stays{" "}
        <strong>Draft</strong>.
      </div>

      <div>
        <Label htmlFor={`${draftFormId}-title`}>Job title</Label>
        <Input
          id={`${draftFormId}-title`}
          name="title"
          required
          defaultValue={d.title ?? ""}
          placeholder="e.g. Senior Instructional Designer"
          className="mt-1.5"
        />
      </div>

      <DepartmentNameField name="departmentName" label="Department" defaultValue={d.departmentName ?? ""} />

      <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Location</div>
        <div>
          <Label htmlFor={`${draftFormId}-wa`}>Work arrangement</Label>
          <Select
            id={`${draftFormId}-wa`}
            name="workArrangement"
            required
            defaultValue={d.workArrangement || "HYBRID"}
            className="mt-1.5"
          >
            {WORK_ARRANGEMENT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-ink-400 mt-1.5">
            Remote, hybrid, or on-site - pick how this role is expected to work.
          </p>
        </div>
        <div>
          <Label htmlFor={`${draftFormId}-location`}>City / region (optional for fully remote)</Label>
          <Input
            id={`${draftFormId}-location`}
            name="location"
            defaultValue={d.location ?? ""}
            placeholder="e.g. Bengaluru, Mumbai, Pan-India"
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${draftFormId}-employmentType`}>Employment type</Label>
          <Input
            id={`${draftFormId}-employmentType`}
            name="employmentType"
            defaultValue={d.employmentType ?? ""}
            placeholder="Full-time, Contract, Intern…"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor={`${draftFormId}-openings`}>Number of openings</Label>
          <Input
            id={`${draftFormId}-openings`}
            name="openings"
            type="number"
            min={1}
            max={500}
            defaultValue={d.openings || "1"}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${draftFormId}-experienceRequired`}>Experience required</Label>
          <Input
            id={`${draftFormId}-experienceRequired`}
            name="experienceRequired"
            defaultValue={d.experienceRequired ?? ""}
            placeholder="e.g. 3–5 years in L&D"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor={`${draftFormId}-salaryRange`}>Salary range</Label>
          <Input
            id={`${draftFormId}-salaryRange`}
            name="salaryRange"
            defaultValue={d.salaryRange ?? ""}
            placeholder="e.g. ₹8–12 LPA, Competitive + ESOP"
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`${draftFormId}-skillsRequired`}>Skills required</Label>
        <Textarea
          id={`${draftFormId}-skillsRequired`}
          name="skillsRequired"
          rows={4}
          defaultValue={d.skillsRequired ?? ""}
          placeholder="Tools, languages, certifications, must-have competencies…"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor={`${draftFormId}-description`}>Job description</Label>
        <Textarea
          id={`${draftFormId}-description`}
          name="description"
          rows={8}
          defaultValue={d.description ?? ""}
          placeholder="Responsibilities, expectations, team context, benefits…"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor={`${draftFormId}-applicationDeadline`}>Application deadline</Label>
        <Input
          id={`${draftFormId}-applicationDeadline`}
          name="applicationDeadline"
          type="date"
          defaultValue={d.applicationDeadline ?? ""}
          className="mt-1.5 max-w-[240px]"
        />
        <p className="text-xs text-ink-400 mt-1.5">Last day you will accept applications (optional).</p>
      </div>

      <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Apply on company site</div>
        <div>
          <Label htmlFor={`${draftFormId}-externalApplyUrl`}>Company apply URL (optional)</Label>
          <Input
            id={`${draftFormId}-externalApplyUrl`}
            name="externalApplyUrl"
            type="text"
            inputMode="url"
            autoComplete="off"
            defaultValue={d.externalApplyUrl ?? ""}
            placeholder="Leave blank unless job boards redirect to another form"
            className="mt-1.5"
          />
        </div>
        <p className="text-xs text-ink-500 leading-relaxed">
          Optional - only fill if you embed an <strong>Apply on company site</strong> link on external boards. Entries
          there still arrive in your other tool unless you reconcile here. Empty is fine - use Humans of SIB funnel
          only.
        </p>
      </div>

      <div>
        <Label htmlFor={`${draftFormId}-status`}>Posting status</Label>
        <Select id={`${draftFormId}-status`} name="status" defaultValue={d.status || "OPEN"} className="mt-1.5">
          {HIRING_JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {JOB_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap gap-3 pt-2 border-t border-ink-100">
        <Button type="submit" variant="accent">
          Save opening
        </Button>
        <Link href="/hiring/jobs">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
