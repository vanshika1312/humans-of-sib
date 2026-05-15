import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { loadPipelineStagesOrdered } from "@/lib/hiring-pipeline";
import {
  HIRING_TEMPLATE_CATEGORIES,
  HIRING_TEMPLATE_CATEGORY_LABEL,
  isHiringTemplateCategory,
} from "@/lib/hiring-template-category";
import { createHiringTemplate, deleteHiringTemplate, updateHiringTemplate } from "./actions";
import { firstSearchParam } from "@/lib/search-param";
import { formatDate } from "@/lib/utils";
import type { HiringTemplateCategory } from "@/generated/prisma";

type Props = {
  searchParams: Promise<{
    error?: string | string[];
    saved?: string | string[];
    removed?: string | string[];
    category?: string | string[];
  }>;
};

export default async function HiringTemplatesPage(props: Props) {
  const sp = await props.searchParams;
  const flashError = firstSearchParam(sp.error);
  const flashSaved = firstSearchParam(sp.saved) === "1";
  const flashRemoved = firstSearchParam(sp.removed) === "1";
  const categoryParam = firstSearchParam(sp.category);
  const formCategoryDefault: HiringTemplateCategory =
    categoryParam && isHiringTemplateCategory(categoryParam) ? categoryParam : "QUESTIONNAIRE_GUIDE";

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

  const defaultQuestionnaireStageId =
    pipelineStagesOrdered.find((s) => s.key === "INTERVIEW")?.id ?? pipelineStagesOrdered[0]?.id ?? "";

  const nonQuestionnaire = templates.filter((t) => t.category !== "QUESTIONNAIRE_GUIDE");

  const byStage = new Map<string | null, typeof templates>();
  pipelineStagesOrdered.forEach((s) => byStage.set(s.id, []));
  templates
    .filter((t) => t.category === "QUESTIONNAIRE_GUIDE")
    .forEach((t) => {
      const id = t.pipelineStageId ?? null;
      if (!byStage.has(id)) byStage.set(id, []);
      byStage.get(id)!.push(t);
    });

  return (
    <div className="space-y-8 max-w-4xl pb-10">
      <PageHeader
        title="Templates"
        emoji="📋"
        subtitle="Questionnaires follow your configured pipeline stages. Manage stages under Hiring → Stages."
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

      <Card className="border-sky-100/70">
        <CardHeader className="border-b border-ink-100 bg-ink-50/60">
          <CardTitle>New template</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form action={createHiringTemplate} className="grid gap-4 max-w-2xl">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  maxLength={200}
                  placeholder="e.g. Phone screen script, Outreach — passive candidate…"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="category">Template type</Label>
                <Select
                  id="category"
                  name="category"
                  required
                  className="mt-1.5"
                  defaultValue={formCategoryDefault}
                >
                  {HIRING_TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {HIRING_TEMPLATE_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="pipelineStageId">Maps to funnel stage (questionnaires only)</Label>
                <Select
                  id="pipelineStageId"
                  name="pipelineStageId"
                  className="mt-1.5"
                  defaultValue={defaultQuestionnaireStageId}
                >
                  <option value="">—</option>
                  {pipelineStagesOrdered.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] text-ink-400 mt-1">
                  Ignored for email / job post / other — leave blank unless type is questionnaire.
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="body">Content</Label>
              <Textarea
                id="body"
                name="body"
                required
                rows={10}
                className="mt-1.5 font-mono text-sm"
                placeholder={`• Question one…\n\nHi {{name}},\n\nWe're hiring for …`}
              />
            </div>
            <Button type="submit" variant="accent">
              Save template
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-10">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
              Questionnaires by stage
            </h3>
            {pipelineStagesOrdered.map((stage) => {
              const rows = byStage.get(stage.id) ?? [];
              return (
                <div key={stage.id} className="mb-8 last:mb-0">
                  <h4 className="text-sm font-semibold text-ink-700 mb-2">{stage.label}</h4>
                  {rows.length === 0 ? (
                    <p className="text-sm text-ink-500">No questionnaire templates yet for this stage.</p>
                  ) : (
                    <ul className="space-y-4">
                      {rows.map((row) => (
                        <TemplateListItem
                          key={row.id}
                          row={row}
                          stages={pipelineStagesOrdered.map((ps) => ({ id: ps.id, label: ps.label }))}
                          categoryLabel={HIRING_TEMPLATE_CATEGORY_LABEL[row.category]}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
              Email · job posts · other
            </h3>
            {nonQuestionnaire.length === 0 ? (
              <p className="text-sm text-ink-500">No templates in this bucket yet.</p>
            ) : (
              <ul className="space-y-4">
                {nonQuestionnaire.map((row) => (
                  <TemplateListItem
                  key={row.id}
                  row={row}
                  stages={pipelineStagesOrdered.map((ps) => ({ id: ps.id, label: ps.label }))}
                  categoryLabel={HIRING_TEMPLATE_CATEGORY_LABEL[row.category]}
                />
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateListItem({
  row,
  stages,
  categoryLabel,
}: {
  row: {
    id: string;
    title: string;
    body: string;
    category: HiringTemplateCategory;
    pipelineStageId: string | null;
    pipelineStage: { label: string } | null;
    updatedAt: Date;
    createdBy: { name: string | null; email: string | null } | null;
  };
  stages: { id: string; label: string }[];
  categoryLabel: string;
}) {
  const who = row.createdBy?.name ?? row.createdBy?.email ?? "—";
  const delAction = deleteHiringTemplate.bind(null, row.id);
  const saveAction = updateHiringTemplate.bind(null, row.id);
  const stageNote =
    row.category === "QUESTIONNAIRE_GUIDE" && row.pipelineStage?.label ? (
      <span className="text-ink-500"> · {row.pipelineStage.label}</span>
    ) : null;
  const defaultStageId = row.category === "QUESTIONNAIRE_GUIDE" ? (row.pipelineStageId ?? "") : "";

  return (
    <li className="rounded-xl border border-ink-100 p-4 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-semibold text-ink-800">{row.title}</div>
          <div className="text-[11px] text-ink-400 mt-0.5">
            {categoryLabel}
            {stageNote} · Updated {formatDate(row.updatedAt)} · {who}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <details className="group/edit [&_summary::-webkit-details-marker]:hidden">
            <summary className="list-none rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 cursor-pointer hover:bg-ink-50 select-none shadow-sm">
              Edit…
            </summary>
            <form action={saveAction} className="mt-4 grid gap-3 max-w-2xl border-t border-ink-100 pt-4">
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
                <div>
                  <Label htmlFor={`cat-${row.id}`}>Template type</Label>
                  <Select id={`cat-${row.id}`} name="category" required className="mt-1.5" defaultValue={row.category}>
                    {HIRING_TEMPLATE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {HIRING_TEMPLATE_CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`ps-${row.id}`}>Maps to funnel stage (questionnaires only)</Label>
                  <Select
                    id={`ps-${row.id}`}
                    name="pipelineStageId"
                    className="mt-1.5"
                    defaultValue={defaultStageId}
                  >
                    <option value="">—</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor={`body-${row.id}`}>Content</Label>
                <Textarea id={`body-${row.id}`} name="body" required rows={8} defaultValue={row.body} className="mt-1.5 font-mono text-sm" />
              </div>
              <Button type="submit" variant="accent" size="sm" className="w-fit">
                Save changes
              </Button>
            </form>
          </details>
          <form action={delAction}>
            <Button type="submit" variant="danger" size="sm">
              Delete
            </Button>
          </form>
        </div>
      </div>
      <pre className="text-sm text-ink-600 whitespace-pre-wrap bg-ink-50/70 rounded-lg p-3 border border-ink-100 max-h-[320px] overflow-auto">
        {row.body}
      </pre>
    </li>
  );
}
