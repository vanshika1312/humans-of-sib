import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  HIRING_JOB_QUESTION_TYPE_LABEL,
  SCREENING_FILE_ACCEPT,
  questionOptionsFromRecord,
  type HiringJobQuestionRecord,
} from "@/lib/hiring-job-questions";

export function ApplicationQuestionFields({ questions }: { questions: HiringJobQuestionRecord[] }) {
  if (questions.length === 0) return null;

  return (
    <section className="space-y-4 border-t border-ink-100 pt-6">
      <div>
        <h2 className="text-base font-semibold text-ink-900">Additional questions</h2>
        <p className="text-sm text-ink-500 mt-0.5">These are specific to this role.</p>
      </div>
      <ol className="space-y-5">
        {questions.map((q, idx) => {
          const options = questionOptionsFromRecord(q);
          const fieldId = `q_${q.id}`;
          const fileId = `qfile_${q.id}`;
          return (
            <li key={q.id} className="space-y-2">
              <Label htmlFor={q.type === "FILE" ? fileId : q.type === "YES_NO" ? `${fieldId}-yes` : fieldId}>
                {idx + 1}. {q.prompt}
                {q.required ? <span className="text-red-600"> *</span> : null}
                <span className="ml-2 text-xs font-normal text-ink-400">
                  {HIRING_JOB_QUESTION_TYPE_LABEL[q.type]}
                </span>
              </Label>
              {q.helpText ? <p className="text-xs text-ink-500">{q.helpText}</p> : null}
              {q.type === "SHORT_TEXT" ? (
                <Input id={fieldId} name={fieldId} required={q.required} maxLength={500} />
              ) : null}
              {q.type === "LONG_TEXT" ? (
                <Textarea id={fieldId} name={fieldId} required={q.required} rows={5} maxLength={8000} />
              ) : null}
              {q.type === "DROPDOWN" ? (
                <Select id={fieldId} name={fieldId} required={q.required} defaultValue="">
                  <option value="">{q.required ? "Select an option" : "Optional — select an option"}</option>
                  {options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              ) : null}
              {q.type === "YES_NO" ? (
                <div className="flex flex-wrap gap-4 text-sm text-ink-700">
                  <label className="inline-flex items-center gap-2">
                    <input id={`${fieldId}-yes`} type="radio" name={fieldId} value="Yes" required={q.required} />
                    Yes
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name={fieldId} value="No" required={q.required} />
                    No
                  </label>
                </div>
              ) : null}
              {q.type === "FILE" ? (
                <Input
                  id={fileId}
                  name={fileId}
                  type="file"
                  required={q.required}
                  accept={SCREENING_FILE_ACCEPT}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
