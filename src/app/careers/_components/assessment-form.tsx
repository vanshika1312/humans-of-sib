"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import {
  LIKERT_OPTIONS,
  type AssessmentQuestion,
} from "@/lib/hiring-assessment";
import { cn } from "@/lib/utils";

export function AssessmentForm({
  questions,
  action,
}: {
  questions: AssessmentQuestion[];
  action: (formData: FormData) => Promise<void>;
}) {
  const psychometric = useMemo(() => questions.filter((q) => q.kind === "PSYCHOMETRIC"), [questions]);
  const role = useMemo(() => questions.filter((q) => q.kind === "ROLE"), [questions]);
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        try {
          await action(fd);
        } finally {
          setPending(false);
        }
      }}
      className="space-y-10"
    >
      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            Personality ({psychometric.length} questions)
          </h2>
          <p className="text-sm text-ink-500 mt-1">
            There are no right answers — pick the option closest to how you actually are, not how you think we want you
            to be.
          </p>
        </div>
        <ol className="space-y-5">
          {psychometric.map((q, i) => (
            <li key={q.key} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                Question {i + 1} of {psychometric.length}
              </p>
              <p className="text-sm font-medium text-ink-900 mt-2 leading-relaxed">{q.prompt}</p>
              {q.helpText ? <p className="text-xs text-ink-500 mt-1.5">{q.helpText}</p> : null}
              <div className="mt-4">
                {q.type === "LIKERT" ? (
                  <LikertField name={`aq_${q.key}`} />
                ) : (
                  <SituationalField name={`aq_${q.key}`} options={q.options ?? []} />
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">This role</h2>
          <p className="text-sm text-ink-500 mt-1">
            These questions are written for this opening and how Skillinabox actually works — learners, field, and
            the responsibilities of the job.
          </p>
        </div>
        <ol className="space-y-5" start={psychometric.length + 1}>
          {role.map((q, i) => (
            <li key={q.key} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                Role question {i + 1} of {role.length}
              </p>
              <Label htmlFor={`aq_${q.key}`} className="mt-2 text-sm font-medium text-ink-900 leading-relaxed">
                {q.prompt}
              </Label>
              {q.helpText ? <p className="text-xs text-ink-500 mt-1">{q.helpText}</p> : null}
              <Textarea
                id={`aq_${q.key}`}
                name={`aq_${q.key}`}
                required
                minLength={40}
                maxLength={8000}
                rows={5}
                placeholder="A few concrete sentences…"
                className="mt-3"
              />
            </li>
          ))}
        </ol>
      </section>

      <Button type="submit" variant="accent" size="md" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Submitting…" : "Submit assessment"}
      </Button>
    </form>
  );
}

function LikertField({ name }: { name: string }) {
  return (
    <fieldset>
      <legend className="sr-only">Rating</legend>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {LIKERT_OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50/50 px-3 py-2 text-xs text-ink-700 cursor-pointer",
              "has-[:checked]:border-sky-500 has-[:checked]:bg-sky-50 has-[:checked]:text-sky-950 has-[:checked]:font-semibold",
            )}
          >
            <input type="radio" name={name} value={o.value} required className="accent-sky-600" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SituationalField({ name, options }: { name: string; options: { value: string; label: string }[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Choose one</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex items-start gap-3 rounded-lg border border-ink-200 bg-ink-50/40 px-3 py-3 text-sm text-ink-700 cursor-pointer",
            "has-[:checked]:border-sky-500 has-[:checked]:bg-sky-50 has-[:checked]:text-sky-950",
          )}
        >
          <input type="radio" name={name} value={o.value} required className="mt-1 accent-sky-600" />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
