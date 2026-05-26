import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { loadPipelineStagesOrdered } from "@/lib/hiring-pipeline";
import {
  HIRING_EMAIL_PURPOSES,
  HIRING_EMAIL_PURPOSE_LABEL,
  HIRING_EMAIL_PURPOSE_SORT,
} from "@/lib/hiring-email-purpose";
import { createHiringTemplate } from "./actions";
import { firstSearchParam } from "@/lib/search-param";
import { WORK_ARRANGEMENT_OPTIONS } from "@/lib/hiring-job-copy";
import { HiringTemplateTabs, type HiringTemplateTab } from "./_components/hiring-template-tabs";
import { PlaceholderCheatsheet } from "./_components/placeholder-cheatsheet";
import { TemplateListItem, type TemplateRow } from "./_components/template-list-item";
import type { HiringEmailPurpose } from "@/generated/prisma";

type Props = {
  searchParams: Promise<{
    error?: string | string[];
    saved?: string | string[];
    removed?: string | string[];
    tab?: string | string[];
  }>;
};

function parseTab(raw: string | undefined): HiringTemplateTab {
  if (raw === "job" || raw === "email" || raw === "questionnaire") return raw;
  return "questionnaire";
}

export default async function HiringTemplatesPage(props: Props) {
  const sp = await props.searchParams;
  const flashError = firstSearchParam(sp.error);
  const flashSaved = firstSearchParam(sp.saved) === "1";
  const flashRemoved = firstSearchParam(sp.removed) === "1";
  const activeTab = parseTab(firstSearchParam(sp.tab));

  const [pipelineStagesOrdered, templates] = await Promise.all([
    loadPipelineStagesOrdered(),
    prisma.hiringInterviewQuestionTemplate.findMany({
      orderBy: [{ category: "asc" }, { pipelineStageId: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
      include: {
        createdBy: { select: { name: true, email: true } },
        pipelineStage: { select: { label: true } },
      },
    }),
  ]);

  const stages = pipelineStagesOrdered.map((ps) => ({ id: ps.id, label: ps.label }));
  const rows = templates as TemplateRow[];

  const jobTemplates = rows.filter((t) => t.category === "JOB_POST");
  const emailTemplates = rows.filter((t) => t.category === "EMAIL");
  const questionnaireTemplates = rows.filter((t) => t.category === "QUESTIONNAIRE_GUIDE");

  const defaultQuestionnaireStageId =
    pipelineStagesOrdered.find((s) => s.key === "INTERVIEW")?.id ?? pipelineStagesOrdered[0]?.id ?? "";

  const byStage = new Map<string, TemplateRow[]>();
  pipelineStagesOrdered.forEach((s) => byStage.set(s.id, []));
  questionnaireTemplates.forEach((t) => {
    const id = t.pipelineStageId ?? "";
    if (!byStage.has(id)) byStage.set(id, []);
    byStage.get(id)!.push(t);
  });

  const emailsByPurpose = new Map<HiringEmailPurpose, TemplateRow[]>();
  for (const p of HIRING_EMAIL_PURPOSE_SORT) emailsByPurpose.set(p, []);
  emailTemplates.forEach((t) => {
    const p = t.emailPurpose ?? "OTHER";
    if (!emailsByPurpose.has(p)) emailsByPurpose.set(p, []);
    emailsByPurpose.get(p)!.push(t);
  });

  return (
    <div className="space-y-8 max-w-4xl pb-10">
      <PageHeader
        title="Templates"
        emoji="📋"
        subtitle="Reusable job profiles, interview questionnaires by funnel stage, and candidate emails."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/hiring/pipeline-stages">
              <Button variant="outline" size="md">
                Pipeline stages
              </Button>
            </Link>
            <Link href="/hiring/applications">
              <Button variant="outline" size="md">
                ← Applications
              </Button>
            </Link>
          </div>
        }
      />

      <Suspense fallback={<div className="h-10" />}>
        <HiringTemplateTabs active={activeTab} />
      </Suspense>

      {flashSaved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Template saved.
        </div>
      )}
      {flashRemoved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Template removed.
        </div>
      )}
      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(flashError)}
        </div>
      )}

      {activeTab === "job" && (
        <>
          <Card className="border-sky-100/70">
            <CardHeader className="border-b border-ink-100 bg-ink-50/60">
              <CardTitle>New job profile template</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-sm text-ink-500 mb-4 leading-relaxed">
                Save reusable description, skills, and location defaults. When you create a job opening, pick a
                template to prefill those fields — you still enter the role title, department, and openings each time.
              </p>
              <form action={createHiringTemplate} className="grid gap-4 max-w-2xl">
                <input type="hidden" name="tab" value="job" />
                <input type="hidden" name="category" value="JOB_POST" />
                <div>
                  <Label htmlFor="title">Template name</Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    maxLength={200}
                    placeholder="e.g. Senior L&D — standard JD"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="jobDescription">Job description</Label>
                  <Textarea
                    id="jobDescription"
                    name="jobDescription"
                    rows={8}
                    className="mt-1.5"
                    placeholder="Responsibilities, expectations, team context…"
                  />
                </div>
                <div>
                  <Label htmlFor="jobSkillsRequired">Skills required</Label>
                  <Textarea id="jobSkillsRequired" name="jobSkillsRequired" rows={4} className="mt-1.5" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="jobExperienceRequired">Experience required</Label>
                    <Input id="jobExperienceRequired" name="jobExperienceRequired" className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="jobEmploymentType">Employment type</Label>
                    <Input id="jobEmploymentType" name="jobEmploymentType" placeholder="Full-time…" className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="jobWorkArrangement">Work arrangement</Label>
                    <Select id="jobWorkArrangement" name="jobWorkArrangement" className="mt-1.5" defaultValue="">
                      <option value="">—</option>
                      {WORK_ARRANGEMENT_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="jobLocation">City / region</Label>
                    <Input id="jobLocation" name="jobLocation" className="mt-1.5" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="jobSalaryRange">Salary range</Label>
                    <Input id="jobSalaryRange" name="jobSalaryRange" className="mt-1.5" />
                  </div>
                </div>
                <Button type="submit" variant="accent">
                  Save job profile template
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved job profile templates</CardTitle>
            </CardHeader>
            <CardContent>
              {jobTemplates.length === 0 ? (
                <p className="text-sm text-ink-500">No job profile templates yet.</p>
              ) : (
                <ul className="space-y-4">
                  {jobTemplates.map((row) => (
                    <TemplateListItem key={row.id} row={row} stages={stages} tab="job" />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "questionnaire" && (
        <>
          <Card className="border-sky-100/70">
            <CardHeader className="border-b border-ink-100 bg-ink-50/60">
              <CardTitle>New questionnaire template</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-sm text-ink-500 mb-4">
                Map each template to a{" "}
                <Link href="/hiring/pipeline-stages" className="font-semibold text-sky-700 hover:underline">
                  pipeline stage
                </Link>{" "}
                (phone screen, interview, etc.). Recruiters see matching guides on applications in that stage.
              </p>
              <form action={createHiringTemplate} className="grid gap-4 max-w-2xl">
                <input type="hidden" name="tab" value="questionnaire" />
                <input type="hidden" name="category" value="QUESTIONNAIRE_GUIDE" />
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    maxLength={200}
                    placeholder="e.g. Technical round — system design"
                    className="mt-1.5"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pipelineStageId">Interview round (funnel stage)</Label>
                    <Select
                      id="pipelineStageId"
                      name="pipelineStageId"
                      required
                      className="mt-1.5"
                      defaultValue={defaultQuestionnaireStageId}
                    >
                      {pipelineStagesOrdered.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sortOrder">Sort order</Label>
                    <Input id="sortOrder" name="sortOrder" type="number" min={0} max={999} defaultValue={0} className="mt-1.5" />
                    <p className="text-[11px] text-ink-400 mt-1">Lower numbers appear first.</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="body">Questionnaire / guide</Label>
                  <Textarea
                    id="body"
                    name="body"
                    required
                    rows={10}
                    className="mt-1.5 font-mono text-sm"
                    placeholder="• Tell me about…&#10;• How would you…"
                  />
                </div>
                <Button type="submit" variant="accent">
                  Save questionnaire
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questionnaires by stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-10">
              {pipelineStagesOrdered.map((stage) => {
                const stageRows = byStage.get(stage.id) ?? [];
                return (
                  <section key={stage.id}>
                    <h4 className="text-sm font-semibold text-ink-700 mb-2">{stage.label}</h4>
                    {stageRows.length === 0 ? (
                      <p className="text-sm text-ink-500">No templates for this stage yet.</p>
                    ) : (
                      <ul className="space-y-4">
                        {stageRows.map((row) => (
                          <TemplateListItem key={row.id} row={row} stages={stages} tab="questionnaire" />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "email" && (
        <>
          <Card className="border-sky-100/70">
            <CardHeader className="border-b border-ink-100 bg-ink-50/60">
              <CardTitle>New email template</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid lg:grid-cols-[1fr_minmax(200px,240px)] gap-6">
                <form action={createHiringTemplate} className="grid gap-4 max-w-2xl">
                  <input type="hidden" name="tab" value="email" />
                  <input type="hidden" name="category" value="EMAIL" />
                  <div>
                    <Label htmlFor="title">Template name</Label>
                    <Input
                      id="title"
                      name="title"
                      required
                      maxLength={200}
                      placeholder="e.g. Rejection — after onsite"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emailPurpose">Purpose</Label>
                    <Select id="emailPurpose" name="emailPurpose" required className="mt-1.5" defaultValue="REJECTED">
                      {HIRING_EMAIL_PURPOSES.map((p) => (
                        <option key={p} value={p}>
                          {HIRING_EMAIL_PURPOSE_LABEL[p]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      name="subject"
                      required
                      maxLength={500}
                      placeholder="Update on your application — {{jobTitle}}"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="body">Body</Label>
                    <Textarea
                      id="body"
                      name="body"
                      required
                      rows={10}
                      className="mt-1.5 font-mono text-sm"
                      placeholder={"Hi {{candidateName}},\n\nThank you for…"}
                    />
                  </div>
                  <Button type="submit" variant="accent">
                    Save email template
                  </Button>
                </form>
                <PlaceholderCheatsheet className="rounded-lg border border-ink-100 bg-ink-50/50 p-3" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved email templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-10">
              {emailTemplates.length === 0 ? (
                <p className="text-sm text-ink-500">No email templates yet.</p>
              ) : (
                HIRING_EMAIL_PURPOSE_SORT.map((purpose) => {
                  const purposeRows = emailsByPurpose.get(purpose) ?? [];
                  if (purposeRows.length === 0) return null;
                  return (
                    <section key={purpose}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
                        {HIRING_EMAIL_PURPOSE_LABEL[purpose]}
                      </h4>
                      <ul className="space-y-4">
                        {purposeRows.map((row) => (
                          <TemplateListItem key={row.id} row={row} stages={stages} tab="email" />
                        ))}
                      </ul>
                    </section>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
