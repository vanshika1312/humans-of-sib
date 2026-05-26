import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import {
  HIRING_EMAIL_PURPOSES,
  HIRING_EMAIL_PURPOSE_LABEL,
} from "@/lib/hiring-email-purpose";
import { jobTemplatePreviewText, parseHiringJobTemplateFields } from "@/lib/hiring-job-template-fields";
import { HIRING_TEMPLATE_CATEGORY_LABEL } from "@/lib/hiring-template-category";
import { WORK_ARRANGEMENT_OPTIONS } from "@/lib/hiring-job-copy";
import type { HiringEmailPurpose, HiringTemplateCategory } from "@/generated/prisma";
import {
  deleteHiringTemplate,
  duplicateHiringTemplate,
  updateHiringTemplate,
} from "../actions";
import type { HiringTemplateTab } from "./hiring-template-tabs";

export type TemplateRow = {
  id: string;
  title: string;
  body: string;
  category: HiringTemplateCategory;
  pipelineStageId: string | null;
  pipelineStage: { label: string } | null;
  subject: string | null;
  emailPurpose: HiringEmailPurpose | null;
  jobFieldsJson: string | null;
  sortOrder: number;
  updatedAt: Date;
  createdBy: { name: string | null; email: string | null } | null;
};

export function TemplateListItem({
  row,
  stages,
  tab,
  categoryLabel,
}: {
  row: TemplateRow;
  stages: { id: string; label: string }[];
  tab: HiringTemplateTab;
  categoryLabel?: string;
}) {
  const who = row.createdBy?.name ?? row.createdBy?.email ?? "—";
  const delAction = deleteHiringTemplate.bind(null, row.id);
  const saveAction = updateHiringTemplate.bind(null, row.id);
  const dupAction = duplicateHiringTemplate.bind(null, row.id);
  const label = categoryLabel ?? HIRING_TEMPLATE_CATEGORY_LABEL[row.category];
  const stageNote =
    row.category === "QUESTIONNAIRE_GUIDE" && row.pipelineStage?.label ? (
      <span className="text-ink-500"> · {row.pipelineStage.label}</span>
    ) : null;
  const emailNote =
    row.category === "EMAIL" && row.emailPurpose ? (
      <span className="text-ink-500"> · {HIRING_EMAIL_PURPOSE_LABEL[row.emailPurpose]}</span>
    ) : null;
  const defaultStageId = row.category === "QUESTIONNAIRE_GUIDE" ? (row.pipelineStageId ?? "") : "";
  const jobFields = parseHiringJobTemplateFields(row.jobFieldsJson);
  const preview =
    row.category === "JOB_POST"
      ? jobTemplatePreviewText(row.body, row.jobFieldsJson)
      : row.category === "EMAIL" && row.subject
        ? `Subject: ${row.subject}\n\n${row.body}`
        : row.body;

  return (
    <li className="rounded-xl border border-ink-100 p-4 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-semibold text-ink-800">{row.title}</div>
          <div className="text-[11px] text-ink-400 mt-0.5">
            {label}
            {stageNote}
            {emailNote}
            {row.category === "QUESTIONNAIRE_GUIDE" ? ` · Order ${row.sortOrder}` : ""}
            {" · Updated "}
            {formatDate(row.updatedAt)} · {who}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {row.category === "JOB_POST" ? (
            <form action={dupAction}>
              <input type="hidden" name="tab" value={tab} />
              <Button type="submit" variant="outline" size="sm">
                Duplicate
              </Button>
            </form>
          ) : null}
          <details className="group/edit [&_summary::-webkit-details-marker]:hidden">
            <summary className="list-none rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 cursor-pointer hover:bg-ink-50 select-none shadow-sm">
              Edit…
            </summary>
            <form action={saveAction} className="mt-4 grid gap-3 max-w-2xl border-t border-ink-100 pt-4">
              <input type="hidden" name="tab" value={tab} />
              <input type="hidden" name="category" value={row.category} />
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label htmlFor={`title-${row.id}`}>Title</Label>
                  <Input
                    id={`title-${row.id}`}
                    name="title"
                    required
                    maxLength={200}
                    defaultValue={row.title}
                    className="mt-1.5"
                  />
                </div>
                {row.category === "QUESTIONNAIRE_GUIDE" ? (
                  <>
                    <div>
                      <Label htmlFor={`ps-${row.id}`}>Funnel stage</Label>
                      <Select
                        id={`ps-${row.id}`}
                        name="pipelineStageId"
                        required
                        className="mt-1.5"
                        defaultValue={defaultStageId}
                      >
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`sort-${row.id}`}>Sort order</Label>
                      <Input
                        id={`sort-${row.id}`}
                        name="sortOrder"
                        type="number"
                        min={0}
                        max={999}
                        defaultValue={row.sortOrder}
                        className="mt-1.5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor={`body-${row.id}`}>Questionnaire</Label>
                      <Textarea
                        id={`body-${row.id}`}
                        name="body"
                        required
                        rows={8}
                        defaultValue={row.body}
                        className="mt-1.5 font-mono text-sm"
                      />
                    </div>
                  </>
                ) : null}
                {row.category === "EMAIL" ? (
                  <>
                    <div>
                      <Label htmlFor={`purpose-${row.id}`}>Purpose</Label>
                      <Select
                        id={`purpose-${row.id}`}
                        name="emailPurpose"
                        required
                        className="mt-1.5"
                        defaultValue={row.emailPurpose ?? "OTHER"}
                      >
                        {HIRING_EMAIL_PURPOSES.map((p) => (
                          <option key={p} value={p}>
                            {HIRING_EMAIL_PURPOSE_LABEL[p]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor={`subject-${row.id}`}>Subject</Label>
                      <Input
                        id={`subject-${row.id}`}
                        name="subject"
                        required
                        maxLength={500}
                        defaultValue={row.subject ?? ""}
                        className="mt-1.5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor={`body-${row.id}`}>Body</Label>
                      <Textarea
                        id={`body-${row.id}`}
                        name="body"
                        required
                        rows={8}
                        defaultValue={row.body}
                        className="mt-1.5 font-mono text-sm"
                      />
                    </div>
                  </>
                ) : null}
                {row.category === "JOB_POST" && jobFields ? (
                  <>
                    <div className="sm:col-span-2">
                      <Label htmlFor={`desc-${row.id}`}>Job description</Label>
                      <Textarea
                        id={`desc-${row.id}`}
                        name="jobDescription"
                        rows={6}
                        defaultValue={jobFields.description ?? ""}
                        className="mt-1.5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor={`skills-${row.id}`}>Skills required</Label>
                      <Textarea
                        id={`skills-${row.id}`}
                        name="jobSkillsRequired"
                        rows={3}
                        defaultValue={jobFields.skillsRequired ?? ""}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`exp-${row.id}`}>Experience</Label>
                      <Input
                        id={`exp-${row.id}`}
                        name="jobExperienceRequired"
                        defaultValue={jobFields.experienceRequired ?? ""}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`emp-${row.id}`}>Employment type</Label>
                      <Input
                        id={`emp-${row.id}`}
                        name="jobEmploymentType"
                        defaultValue={jobFields.employmentType ?? ""}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`wa-${row.id}`}>Work arrangement</Label>
                      <Select
                        id={`wa-${row.id}`}
                        name="jobWorkArrangement"
                        className="mt-1.5"
                        defaultValue={jobFields.workArrangement ?? ""}
                      >
                        <option value="">—</option>
                        {WORK_ARRANGEMENT_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`loc-${row.id}`}>City / region</Label>
                      <Input
                        id={`loc-${row.id}`}
                        name="jobLocation"
                        defaultValue={jobFields.location ?? ""}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`sal-${row.id}`}>Salary range</Label>
                      <Input
                        id={`sal-${row.id}`}
                        name="jobSalaryRange"
                        defaultValue={jobFields.salaryRange ?? ""}
                        className="mt-1.5"
                      />
                    </div>
                  </>
                ) : null}
                {row.category === "OTHER" ? (
                  <div className="sm:col-span-2">
                    <Label htmlFor={`body-${row.id}`}>Content</Label>
                    <Textarea
                      id={`body-${row.id}`}
                      name="body"
                      required
                      rows={8}
                      defaultValue={row.body}
                      className="mt-1.5 font-mono text-sm"
                    />
                  </div>
                ) : null}
              </div>
              <Button type="submit" variant="accent" size="sm" className="w-fit">
                Save changes
              </Button>
            </form>
          </details>
          <form action={delAction}>
            <input type="hidden" name="tab" value={tab} />
            <Button type="submit" variant="danger" size="sm">
              Delete
            </Button>
          </form>
        </div>
      </div>
      <pre className="text-sm text-ink-600 whitespace-pre-wrap bg-ink-50/70 rounded-lg p-3 border border-ink-100 max-h-[320px] overflow-auto">
        {preview}
      </pre>
    </li>
  );
}
