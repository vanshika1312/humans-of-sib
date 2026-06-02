import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { resolveTrainingContentUrl } from "@/lib/training-data";
import { TRAINING_TYPE_LABEL } from "@/lib/training-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrainingQuizForm } from "../_components/training-quiz-form";
import { enrollInTraining } from "../actions";
import { ExternalLink, BookOpen } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

export default async function TrainingDetailPage({ params }: Props) {
  const me = await requireAppViewer();
  if (!me) redirect("/sign-in");

  const { id } = await params;
  const training = await prisma.training.findFirst({
    where: { id, isPublished: true },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { options: { select: { id: true, label: true } } },
      },
    },
  });
  if (!training) notFound();

  const enrollment = await prisma.trainingEnrollment.findUnique({
    where: { userId_trainingId: { userId: me.id, trainingId: id } },
  });

  const cert = await prisma.certificate.findFirst({
    where: { userId: me.id, trainingId: id },
  });

  const pdfUrl = resolveTrainingContentUrl(training.contentUrl);
  const completed = enrollment?.status === "COMPLETED";
  const typeLabel = TRAINING_TYPE_LABEL[training.type] ?? training.type;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/trainings" className="text-sm text-sky-700 hover:underline">
          ← Back to learning hub
        </Link>
        <h1 className="text-2xl font-bold text-ink-800 mt-2">{training.title}</h1>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge tone="sky">{typeLabel}</Badge>
          <Badge tone="ink">{training.pointsAwarded} points on pass</Badge>
          {training.category ? <Badge tone="ink">{training.category}</Badge> : null}
        </div>
        {training.description ? <p className="text-sm text-ink-600 mt-3">{training.description}</p> : null}
      </div>

      {training.type === "READING" && pdfUrl ? (
        <Card>
          <CardContent className="pt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-ink-700 flex items-center gap-2">
                <BookOpen className="size-4" /> Read the book
              </h3>
              {training.author ? <p className="text-sm text-ink-500 mt-1">by {training.author}</p> : null}
            </div>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="accent">Open PDF</Button>
            </a>
          </CardContent>
        </Card>
      ) : null}

      {training.type === "EXTERNAL_COURSE" && training.externalUrl ? (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h3 className="font-semibold text-ink-700 flex items-center gap-2">
              <ExternalLink className="size-4" /> External course
            </h3>
            {training.provider ? <p className="text-sm text-ink-500">{training.provider}</p> : null}
            <p className="text-sm text-ink-600">
              Complete the course on the provider&apos;s site, then return here to take the quiz and earn your
              certificate and points.
            </p>
            <a href={training.externalUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="accent">Open course →</Button>
            </a>
          </CardContent>
        </Card>
      ) : null}

      {!enrollment && !completed ? (
        <form
          action={async () => {
            "use server";
            await enrollInTraining(id);
          }}
        >
          <Button type="submit" variant="outline">
            Mark as started
          </Button>
        </form>
      ) : null}

      <TrainingQuizForm
        trainingId={training.id}
        questions={training.questions}
        passThreshold={training.passingScore ?? 70}
        completed={completed}
        existingCertNumber={cert?.number}
        existingCertId={cert?.id}
      />

      {cert ? (
        <div className="text-sm text-ink-500">
          <Link href={`/trainings/certificates/${cert.id}/print`} className="text-sky-700 hover:underline">
            Download certificate #{cert.number}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
