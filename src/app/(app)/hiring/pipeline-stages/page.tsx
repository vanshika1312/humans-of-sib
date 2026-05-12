import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { firstSearchParam } from "@/lib/search-param";
import { Badge } from "@/components/ui/badge";
import { createPipelineStage, deletePipelineStage, updatePipelineStage } from "./actions";

type Props = {
  searchParams: Promise<{ error?: string | string[]; saved?: string | string[]; removed?: string | string[]; edited?: string | string[] }>;
};

export default async function HiringPipelineStagesPage(props: Props) {
  const sp = await props.searchParams;
  const flashError = firstSearchParam(sp.error);
  const flashSaved = firstSearchParam(sp.saved) === "1";
  const flashRemoved = firstSearchParam(sp.removed) === "1";
  const flashEdited = firstSearchParam(sp.edited) === "1";

  const stages = await prisma.hiringPipelineStage.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  return (
    <div className="space-y-8 max-w-3xl pb-10">
      <PageHeader
        title="Pipeline stages"
        emoji="🔀"
        subtitle="Applicants move through these steps on every posting. Columns on the Pipeline board match this order."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/hiring/pipeline">
              <Button variant="outline" size="md">
                ← Pipeline
              </Button>
            </Link>
          </div>
        }
      />

      {flashSaved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Stage saved.
        </div>
      )}
      {flashRemoved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Stage removed.
        </div>
      )}
      {flashEdited && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Stage updated.
        </div>
      )}
      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(flashError)}
        </div>
      )}

      <Card className="border-sky-100/80">
        <CardHeader className="border-b border-ink-100 bg-ink-50/60">
          <CardTitle>Add a stage</CardTitle>
          <CardDescription>
            New stages appear as new columns everywhere (applications, pipeline kanban). The internal key is generated from
            the name — useful for integrations and templates.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form action={createPipelineStage} className="flex flex-wrap items-end gap-4 max-w-lg">
            <div className="flex-1 min-w-[220px]">
              <Label htmlFor="stageLabel">Stage name</Label>
              <Input
                id="stageLabel"
                name="label"
                placeholder="e.g. Phone screen, Assignment review…"
                className="mt-1.5"
                required
                maxLength={160}
              />
            </div>
            <Button type="submit" variant="accent">
              Add stage
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured stages ({stages.length})</CardTitle>
          <CardDescription>
            Ordered top-to-bottom · same order left-to-right on the pipeline. Edit labels and sort order anytime. Delete only
            when nobody is in that stage and no questionnaire template points at it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-ink-100">
          {stages.length === 0 ? (
            <p className="text-sm text-ink-500 py-8">
              No stages — run a database migration or seed; the ATS needs at least one stage.
            </p>
          ) : (
            stages.map((s) => {
              const del = deletePipelineStage.bind(null, s.id);
              const patch = updatePipelineStage.bind(null, s.id);
              return (
                <div key={s.id} className="py-4 first:pt-0 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="font-semibold text-ink-800">{s.label}</div>
                      <div className="text-[11px] text-ink-400 uppercase tracking-wide">
                        Order {s.sortOrder} · key <span className="font-mono text-ink-500">{s.key}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.isHired ? <Badge tone="green">Hired outcome</Badge> : null}
                        {s.isRejected ? <Badge tone="sky">Rejected outcome</Badge> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <details className="group/edit [&_summary::-webkit-details-marker]:hidden">
                        <summary className="list-none rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-600 cursor-pointer hover:bg-ink-50 select-none shadow-sm">
                          Edit…
                        </summary>
                        <form action={patch} className="mt-3 rounded-xl border border-ink-100 bg-ink-50/40 p-4 grid gap-3 max-w-xs w-full shadow-inner">
                          <div>
                            <Label htmlFor={`lbl-${s.id}`}>Stage name</Label>
                            <Input id={`lbl-${s.id}`} name="label" defaultValue={s.label} required maxLength={160} className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor={`ord-${s.id}`}>Sort order</Label>
                            <Input
                              id={`ord-${s.id}`}
                              name="sortOrder"
                              type="number"
                              inputMode="numeric"
                              defaultValue={s.sortOrder}
                              required
                              className="mt-1"
                            />
                            <p className="text-[11px] text-ink-400 mt-1">Lower sorts earlier in kanban lists.</p>
                          </div>
                          <fieldset className="space-y-2">
                            <legend className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-2">
                                  Outcomes
                            </legend>
                            <label className="flex items-center gap-2 text-sm text-ink-700">
                              <input type="checkbox" name="isHired" value="true" defaultChecked={s.isHired} />
                              Exclude from active pipeline (“hired outcome” column)
                            </label>
                            <label className="flex items-center gap-2 text-sm text-ink-700">
                              <input type="checkbox" name="isRejected" value="true" defaultChecked={s.isRejected} />
                              Exclude from active pipeline (“rejected outcome”)
                            </label>
                          </fieldset>
                          <Button type="submit" variant="accent" size="sm">
                            Save changes
                          </Button>
                        </form>
                      </details>
                      <form action={del}>
                        <Button type="submit" variant="danger" size="sm">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

    </div>
  );
}
