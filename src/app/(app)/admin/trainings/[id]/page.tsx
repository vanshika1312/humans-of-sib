import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { canManageTrainingLibrary } from "@/lib/training-admin";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { TrainingEditorForm } from "../_components/training-editor-form";
import { updateTraining, deleteTraining } from "../actions";
import { firstSearchParam } from "@/lib/search-param";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[]; error?: string | string[] }>;
};

export default async function AdminTrainingEditPage({ params, searchParams }: Props) {
  const me = await requireAppViewer();
  if (!canManageTrainingLibrary(me)) redirect("/home");

  const { id } = await params;
  const sp = await searchParams;
  const saved = firstSearchParam(sp.saved);
  const error = firstSearchParam(sp.error);

  const training = await prisma.training.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { options: true },
      },
    },
  });
  if (!training) notFound();

  const quizQuestions = training.questions.map((q) => ({
    prompt: q.prompt,
    options: q.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
  }));

  const boundUpdate = updateTraining.bind(null, id);
  const boundDelete = deleteTraining.bind(null, id);

  return (
    <div>
      <PageHeader
        title="Edit training"
        emoji="✏️"
        subtitle={training.title}
        action={
          <Link href="/admin/trainings">
            <Button variant="outline">Back to list</Button>
          </Link>
        }
      />
      {saved === "1" ? (
        <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Saved successfully.
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          {error.startsWith("upload-")
            ? "PDF upload failed. Use a PDF under 12 MB."
            : decodeURIComponent(error)}
        </p>
      ) : null}

      <TrainingEditorForm
        action={boundUpdate}
        initial={{
          id: training.id,
          title: training.title,
          description: training.description ?? "",
          type: training.type,
          category: training.category ?? "",
          coverImage: training.coverImage ?? "",
          durationMin: training.durationMin ?? "",
          passingScore: training.passingScore ?? 70,
          pointsAwarded: training.pointsAwarded,
          isPublished: training.isPublished,
          author: training.author ?? "",
          externalUrl: training.externalUrl ?? "",
          provider: training.provider ?? "",
          contentUrl: training.contentUrl ?? "",
          quizQuestions,
        }}
      />

      <form action={boundDelete} className="mt-8">
        <Button type="submit" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50">
          Delete training
        </Button>
      </form>
    </div>
  );
}
