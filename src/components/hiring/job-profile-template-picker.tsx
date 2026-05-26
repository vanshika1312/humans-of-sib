"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import type { HiringJobTemplateFieldsV1 } from "@/lib/hiring-job-template-fields";

export type JobProfileTemplateOption = {
  id: string;
  title: string;
  fields: HiringJobTemplateFieldsV1 | null;
};

type FieldMap = {
  description?: HTMLTextAreaElement | null;
  skillsRequired?: HTMLTextAreaElement | null;
  experienceRequired?: HTMLInputElement | null;
  employmentType?: HTMLInputElement | null;
  workArrangement?: HTMLSelectElement | null;
  location?: HTMLInputElement | null;
  salaryRange?: HTMLInputElement | null;
};

export function JobProfileTemplatePicker({
  templates,
  formId,
  fieldIds,
}: {
  templates: JobProfileTemplateOption[];
  formId?: string;
  fieldIds: {
    description: string;
    skillsRequired: string;
    experienceRequired: string;
    employmentType: string;
    workArrangement: string;
    location: string;
    salaryRange: string;
  };
}) {
  const selectRef = useRef<HTMLSelectElement>(null);

  const resolveFields = useCallback((): FieldMap => {
    const q = formId ? `#${formId} ` : "";
    const get = <T extends HTMLElement>(id: string) =>
      document.querySelector<T>(`${q}#${CSS.escape(id)}`) ?? document.getElementById(id) as T | null;

    return {
      description: get<HTMLTextAreaElement>(fieldIds.description),
      skillsRequired: get<HTMLTextAreaElement>(fieldIds.skillsRequired),
      experienceRequired: get<HTMLInputElement>(fieldIds.experienceRequired),
      employmentType: get<HTMLInputElement>(fieldIds.employmentType),
      workArrangement: get<HTMLSelectElement>(fieldIds.workArrangement),
      location: get<HTMLInputElement>(fieldIds.location),
      salaryRange: get<HTMLInputElement>(fieldIds.salaryRange),
    };
  }, [formId, fieldIds]);

  const applyTemplate = useCallback(() => {
    const id = selectRef.current?.value;
    if (!id) return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl?.fields) return;

    const f = resolveFields();
    const targets: { el: HTMLElement | null; next: string }[] = [
      { el: f.description ?? null, next: tpl.fields.description ?? "" },
      { el: f.skillsRequired ?? null, next: tpl.fields.skillsRequired ?? "" },
      { el: f.experienceRequired ?? null, next: tpl.fields.experienceRequired ?? "" },
      { el: f.employmentType ?? null, next: tpl.fields.employmentType ?? "" },
      { el: f.location ?? null, next: tpl.fields.location ?? "" },
      { el: f.salaryRange ?? null, next: tpl.fields.salaryRange ?? "" },
    ];

    const hasExisting = targets.some(({ el, next }) => {
      if (!next.trim() || !el) return false;
      const current =
        el instanceof HTMLSelectElement ? el.value : (el as HTMLInputElement | HTMLTextAreaElement).value;
      return current.trim().length > 0;
    });

    if (hasExisting) {
      const ok = window.confirm(
        "Applying this template will replace description, skills, and other reusable fields that already have text. Continue?",
      );
      if (!ok) return;
    }

    if (tpl.fields.description && f.description) f.description.value = tpl.fields.description;
    if (tpl.fields.skillsRequired && f.skillsRequired) f.skillsRequired.value = tpl.fields.skillsRequired;
    if (tpl.fields.experienceRequired && f.experienceRequired) {
      f.experienceRequired.value = tpl.fields.experienceRequired;
    }
    if (tpl.fields.employmentType && f.employmentType) f.employmentType.value = tpl.fields.employmentType;
    if (tpl.fields.workArrangement && f.workArrangement) {
      f.workArrangement.value = tpl.fields.workArrangement;
    }
    if (tpl.fields.location && f.location) f.location.value = tpl.fields.location;
    if (tpl.fields.salaryRange && f.salaryRange) f.salaryRange.value = tpl.fields.salaryRange;

    f.description?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [templates, resolveFields]);

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50/50 px-3 py-2 text-xs text-ink-600">
        Save reusable job fields under{" "}
        <Link href="/hiring/templates?tab=job" className="font-semibold text-sky-700 hover:underline">
          Hiring → Templates → Job profiles
        </Link>{" "}
        to prefill openings faster.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-sky-900/80">Start from template</div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="job-profile-template-select">Job profile template</Label>
          <Select id="job-profile-template-select" ref={selectRef} className="mt-1.5" defaultValue="">
            <option value="">Select a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={applyTemplate}>
          Apply template
        </Button>
        <Link href="/hiring/templates?tab=job" className="text-xs font-semibold text-sky-700 hover:underline pb-2">
          Manage templates
        </Link>
      </div>
    </div>
  );
}
