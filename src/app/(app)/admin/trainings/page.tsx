import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { canManageTrainingLibrary, TRAINING_TYPE_LABEL } from "@/lib/training-admin";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { firstSearchParam } from "@/lib/search-param";

export default function AdminTrainingsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string | string[]; error?: string | string[] }>;
}) {
  return (
    <div>
      <PageHeader
        title="Training library"
        emoji="📚"
        subtitle="Books, external courses, and completion quizzes."
        action={
          <div className="flex gap-2">
            <Link href="/admin">
              <Button variant="outline">Admin home</Button>
            </Link>
            <Link href="/admin/trainings/new">
              <Button variant="accent">
                <Plus className="size-4" /> Add training
              </Button>
            </Link>
          </div>
        }
      />
      <Suspense fallback={<RouteBodyFallback />}>
        <AdminTrainingsBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AdminTrainingsBody({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string | string[]; error?: string | string[] }>;
}) {
  const me = await requireAppViewer();
  if (!canManageTrainingLibrary(me)) redirect("/home");

  const sp = await searchParams;
  const deleted = firstSearchParam(sp.deleted);
  const error = firstSearchParam(sp.error);

  const trainings = await prisma.training.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { enrollments: true, questions: true, certificates: true } },
    },
  });

  return (
    <>
      {deleted === "1" ? (
        <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Training deleted.
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          {decodeURIComponent(error)}
        </p>
      ) : null}

      {trainings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-500">
            No trainings yet.{" "}
            <Link href="/admin/trainings/new" className="text-sky-700 font-medium hover:underline">
              Add the first one
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trainings.map((t) => (
            <Card key={t.id}>
              <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink-700">{t.title}</span>
                    <Badge tone="sky">{TRAINING_TYPE_LABEL[t.type] ?? t.type}</Badge>
                    <Badge tone={t.isPublished ? "green" : "ink"}>{t.isPublished ? "Published" : "Draft"}</Badge>
                  </div>
                  <p className="text-xs text-ink-400 mt-1">
                    {t._count.questions} quiz questions · {t._count.enrollments} enrollments · {t.pointsAwarded} pts ·{" "}
                    {t._count.certificates} certs issued
                  </p>
                </div>
                <Link href={`/admin/trainings/${t.id}`}>
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
