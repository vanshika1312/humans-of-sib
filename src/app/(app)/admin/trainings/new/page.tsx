import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { canManageTrainingLibrary } from "@/lib/training-admin";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { TrainingEditorForm } from "../_components/training-editor-form";
import { createTraining } from "../actions";
import { firstSearchParam } from "@/lib/search-param";

export default async function AdminTrainingNewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const me = await requireAppViewer();
  if (!canManageTrainingLibrary(me)) redirect("/home");

  const error = firstSearchParam((await searchParams).error);

  return (
    <div>
      <PageHeader
        title="New training"
        emoji="➕"
        subtitle="Add a book PDF or external course with a completion quiz."
        action={
          <Link href="/admin/trainings">
            <Button variant="outline">Back to list</Button>
          </Link>
        }
      />
      {error ? (
        <p className="mb-4 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          {error.startsWith("upload-")
            ? "PDF upload failed. Use a PDF under 12 MB."
            : decodeURIComponent(error)}
        </p>
      ) : null}
      <TrainingEditorForm
        action={createTraining}
        initial={{
          title: "",
          description: "",
          type: "READING",
          category: "Growth",
          coverImage: "",
          durationMin: "",
          passingScore: 70,
          pointsAwarded: 50,
          isPublished: false,
          author: "",
          externalUrl: "",
          provider: "",
          contentUrl: "",
          quizQuestions: [],
        }}
      />
    </div>
  );
}
