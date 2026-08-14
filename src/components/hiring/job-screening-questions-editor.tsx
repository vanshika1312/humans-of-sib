"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  HIRING_JOB_QUESTION_TYPES,
  HIRING_JOB_QUESTION_TYPE_LABEL,
  MAX_JOB_SCREENING_QUESTIONS,
  type HiringJobQuestionInput,
} from "@/lib/hiring-job-questions";
import { suggestedApplyQuestionsForJob } from "@/lib/hiring-assessment";
import type { HiringJobQuestionType } from "@/generated/prisma";

type DraftQuestion = {
  key: string;
  id?: string;
  prompt: string;
  helpText: string;
  type: HiringJobQuestionType;
  required: boolean;
  optionsText: string;
};

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyQuestion(): DraftQuestion {
  return {
    key: newKey(),
    prompt: "",
    helpText: "",
    type: "SHORT_TEXT",
    required: false,
    optionsText: "",
  };
}

function fromInitial(initial: HiringJobQuestionInput[] | undefined, defaultJson: string | undefined): DraftQuestion[] {
  if (initial && initial.length > 0) {
    return initial.map((q) => ({
      key: q.id ?? newKey(),
      id: q.id,
      prompt: q.prompt,
      helpText: q.helpText ?? "",
      type: q.type,
      required: q.required,
      optionsText: q.options.join("\n"),
    }));
  }
  if (defaultJson?.trim()) {
    try {
      const parsed = JSON.parse(defaultJson) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((row) => row && typeof row === "object")
          .map((row) => {
            const o = row as Record<string, unknown>;
            const type = HIRING_JOB_QUESTION_TYPES.includes(o.type as HiringJobQuestionType)
              ? (o.type as HiringJobQuestionType)
              : "SHORT_TEXT";
            const options = Array.isArray(o.options)
              ? o.options.filter((v): v is string => typeof v === "string")
              : [];
            return {
              key: typeof o.id === "string" && o.id ? o.id : newKey(),
              id: typeof o.id === "string" && o.id ? o.id : undefined,
              prompt: typeof o.prompt === "string" ? o.prompt : "",
              helpText: typeof o.helpText === "string" ? o.helpText : "",
              type,
              required: o.required === true,
              optionsText: options.join("\n"),
            };
          });
      }
    } catch {
      /* ignore invalid draft */
    }
  }
  return [];
}

function toPayload(questions: DraftQuestion[]): HiringJobQuestionInput[] {
  return questions
    .filter((q) => q.prompt.trim())
    .map((q) => ({
      id: q.id,
      prompt: q.prompt.trim(),
      helpText: q.helpText.trim() || undefined,
      type: q.type,
      required: q.required,
      options: q.optionsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    }));
}

export function JobScreeningQuestionsEditor({
  initialQuestions,
  defaultJson,
}: {
  initialQuestions?: HiringJobQuestionInput[];
  /** Used by the new-opening draft (localStorage) when there is no saved job yet. */
  defaultJson?: string;
}) {
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => fromInitial(initialQuestions, defaultJson));
  const rootRef = useRef<HTMLDivElement>(null);

  const json = useMemo(() => JSON.stringify(toPayload(questions)), [questions]);

  function update(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    setQuestions((prev) => (prev.length >= MAX_JOB_SCREENING_QUESTIONS ? prev : [...prev, emptyQuestion()]));
  }

  function addSuggestedQuestions() {
    const form = rootRef.current?.closest("form");
    const title = String(form?.querySelector<HTMLInputElement>('[name="title"]')?.value ?? "").trim();
    const departmentName = String(form?.querySelector<HTMLInputElement>('[name="departmentName"]')?.value ?? "").trim();
    const suggested = suggestedApplyQuestionsForJob(title, departmentName);
    setQuestions((prev) => {
      const existing = new Set(prev.map((q) => q.prompt.trim().toLowerCase()));
      const extras: DraftQuestion[] = [];
      for (const q of suggested) {
        if (existing.has(q.prompt.trim().toLowerCase())) continue;
        extras.push({
          key: newKey(),
          prompt: q.prompt,
          helpText: q.helpText ?? "",
          type: q.type,
          required: q.required,
          optionsText: q.options.join("\n"),
        });
      }
      return [...prev, ...extras].slice(0, MAX_JOB_SCREENING_QUESTIONS);
    });
  }

  function removeQuestion(key: string) {
    setQuestions((prev) => prev.filter((q) => q.key !== key));
  }

  return (
    <div ref={rootRef} className="rounded-xl border border-ink-100 bg-ink-50/40 p-4 space-y-4">
      <input type="hidden" name="screeningQuestionsJson" value={json} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Application questions</div>
          <p className="text-xs text-ink-500 mt-1.5 leading-relaxed max-w-xl">
            Optional extra questions on the public apply form. Choose the answer type — short or long text, dropdown,
            yes/no, or a file. Existing applications keep the answers they already submitted. After they apply, every
            candidate also takes a personality questionnaire plus role questions — these apply-form extras are separate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addSuggestedQuestions}
            disabled={questions.length >= MAX_JOB_SCREENING_QUESTIONS}
          >
            Add suggested questions
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addQuestion}
            disabled={questions.length >= MAX_JOB_SCREENING_QUESTIONS}
          >
            <Plus className="size-4" />
            Add question
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-ink-500">No custom questions yet — candidates will only submit profile + résumé.</p>
      ) : (
        <ul className="space-y-3">
          {questions.map((q, idx) => (
            <li key={q.key} className="rounded-lg border border-ink-100 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Question {idx + 1}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeQuestion(q.key)}
                  aria-label={`Remove question ${idx + 1}`}
                >
                  <Trash2 className="size-4 text-ink-400" />
                </Button>
              </div>
              <div>
                <Label htmlFor={`screening-prompt-${q.key}`}>Question</Label>
                <Input
                  id={`screening-prompt-${q.key}`}
                  value={q.prompt}
                  onChange={(e) => update(q.key, { prompt: e.target.value })}
                  placeholder="e.g. Why do you want to join Skillinabox?"
                  maxLength={500}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor={`screening-help-${q.key}`}>Helper text (optional)</Label>
                <Input
                  id={`screening-help-${q.key}`}
                  value={q.helpText}
                  onChange={(e) => update(q.key, { helpText: e.target.value })}
                  placeholder="Shown under the question on the apply form"
                  maxLength={500}
                  className="mt-1.5"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`screening-type-${q.key}`}>Answer type</Label>
                  <Select
                    id={`screening-type-${q.key}`}
                    value={q.type}
                    onChange={(e) => update(q.key, { type: e.target.value as HiringJobQuestionType })}
                    className="mt-1.5"
                  >
                    {HIRING_JOB_QUESTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {HIRING_JOB_QUESTION_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm text-ink-600 sm:mt-7">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => update(q.key, { required: e.target.checked })}
                    className="rounded border-ink-300"
                  />
                  Required on apply form
                </label>
              </div>
              {q.type === "DROPDOWN" ? (
                <div>
                  <Label htmlFor={`screening-options-${q.key}`}>Dropdown options (one per line)</Label>
                  <Textarea
                    id={`screening-options-${q.key}`}
                    rows={4}
                    value={q.optionsText}
                    onChange={(e) => update(q.key, { optionsText: e.target.value })}
                    placeholder={"Yes, immediately\n2 weeks notice\n1 month notice"}
                    className="mt-1.5"
                  />
                </div>
              ) : null}
              {q.type === "FILE" ? (
                <p className="text-xs text-ink-500">
                  Candidates can upload PDF, Word, image, zip, or slides (max 12 MB).
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
