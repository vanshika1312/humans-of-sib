"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { TrainingQuizBuilder } from "./training-quiz-builder";
import type { QuizQuestionInput } from "@/lib/training-quiz";
import type { TrainingType } from "@/generated/prisma";

export type TrainingFormInitial = {
  id?: string;
  title: string;
  description: string;
  type: TrainingType;
  category: string;
  coverImage: string;
  durationMin: number | "";
  passingScore: number;
  pointsAwarded: number;
  isPublished: boolean;
  author: string;
  externalUrl: string;
  provider: string;
  contentUrl: string;
  quizQuestions: QuizQuestionInput[];
};

export function TrainingEditorForm({
  initial,
  action,
}: {
  initial: TrainingFormInitial;
  action: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [type, setType] = useState<TrainingType>(initial.type);
  const isBook = type === "READING";
  const isCourse = type === "EXTERNAL_COURSE";

  return (
    <form action={action} className="space-y-6 max-w-3xl">
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={initial.title} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={initial.description} rows={3} className="mt-1" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select
                id="type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as TrainingType)}
                className="mt-1"
                required
              >
                <option value="READING">Book (PDF)</option>
                <option value="EXTERNAL_COURSE">External course</option>
                <option value="SELF_PACED">Self-paced</option>
                <option value="WORKSHOP">Workshop</option>
                <option value="LIVE">Live</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" defaultValue={initial.category} placeholder="Growth, Leadership…" className="mt-1" />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="durationMin">Duration (min)</Label>
              <Input id="durationMin" name="durationMin" type="number" min={0} defaultValue={initial.durationMin} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="passingScore">Pass score %</Label>
              <Input id="passingScore" name="passingScore" type="number" min={0} max={100} defaultValue={initial.passingScore} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="pointsAwarded">Points on pass</Label>
              <Input id="pointsAwarded" name="pointsAwarded" type="number" min={0} defaultValue={initial.pointsAwarded} className="mt-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="coverImage">Cover image URL</Label>
            <Input id="coverImage" name="coverImage" defaultValue={initial.coverImage} className="mt-1" />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input name="isPublished" type="checkbox" defaultChecked={initial.isPublished} />
            Published (visible to team)
          </label>
        </CardContent>
      </Card>

      {isBook ? (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <h3 className="font-semibold text-ink-700">Book details</h3>
            <div>
              <Label htmlFor="author">Author</Label>
              <Input id="author" name="author" defaultValue={initial.author} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="pdfFile">PDF file</Label>
              <p className="text-xs text-ink-400 mt-0.5 mb-2">Upload a licensed PDF (max 12 MB). Only upload content your org may distribute.</p>
              <input
                id="pdfFile"
                name="pdfFile"
                type="file"
                accept=".pdf,application/pdf"
                className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-900"
              />
              {initial.contentUrl ? (
                <p className="text-sm mt-2">
                  Current:{" "}
                  <Link href={initial.contentUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">
                    Open PDF
                  </Link>
                </p>
              ) : null}
              <input type="hidden" name="contentUrl" value={initial.contentUrl} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isCourse ? (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <h3 className="font-semibold text-ink-700">External course</h3>
            <div>
              <Label htmlFor="provider">Provider</Label>
              <Input id="provider" name="provider" defaultValue={initial.provider} placeholder="Coursera, YouTube, Google…" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="externalUrl">Course URL</Label>
              <Input id="externalUrl" name="externalUrl" type="url" defaultValue={initial.externalUrl} required={isCourse} className="mt-1" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <TrainingQuizBuilder initialQuestions={initial.quizQuestions} />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="accent">Save training</Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/trainings")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
