"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { submitTrainingQuiz, type SubmitQuizResult } from "../actions";
import Link from "next/link";

type Question = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
};

export function TrainingQuizForm({
  trainingId,
  questions,
  passThreshold,
  completed,
  existingCertNumber,
  existingCertId,
}: {
  trainingId: string;
  questions: Question[];
  passThreshold: number;
  completed: boolean;
  existingCertNumber?: string | null;
  existingCertId?: string | null;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitQuizResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (completed && !result) {
    return (
      <Card>
        <CardContent className="pt-5 space-y-3">
          <Badge tone="green" className="mb-2">Completed</Badge>
          <p className="text-sm text-ink-600">
            You&apos;ve already passed this quiz
            {existingCertNumber ? ` · Certificate #${existingCertNumber}` : ""}.
          </p>
          {existingCertId ? (
            <Link href={`/trainings/certificates/${existingCertId}/print`}>
              <Button size="sm" variant="outline">Download certificate</Button>
            </Link>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  function selectAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitTrainingQuiz(trainingId, answers);
      setResult(res);
    });
  }

  if (result?.ok && result.passed) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="pt-5 space-y-3">
          <Badge tone="green">Quiz passed · {result.score}%</Badge>
          <p className="text-sm text-ink-700">
            You earned <strong>{result.pointsAwarded} points</strong> and certificate{" "}
            <strong>#{result.certNumber}</strong>.
          </p>
          <Link href={`/trainings/certificates/${result.certId}/print`}>
            <Button size="sm" variant="accent">Download certificate</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const allAnswered = questions.every((q) => answers[q.id]);

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div>
          <h3 className="font-semibold text-ink-700">Completion quiz</h3>
          <p className="text-sm text-ink-500 mt-1">
            Pass with {passThreshold}% or higher to earn your certificate and points.
          </p>
        </div>

        {result?.ok && !result.passed ? (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
            Score: {result.score}% — you need {result.passThreshold}% to pass. Review the material and try again.
          </div>
        ) : null}

        {questions.map((q, idx) => (
          <fieldset key={q.id} className="space-y-2">
            <legend className="text-sm font-medium text-ink-700">
              {idx + 1}. {q.prompt}
            </legend>
            <div className="space-y-2 pl-1">
              {q.options.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm text-ink-600 cursor-pointer">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === o.id}
                    onChange={() => selectAnswer(q.id, o.id)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <Button
          type="button"
          variant="accent"
          disabled={pending || !allAnswered}
          onClick={handleSubmit}
        >
          {pending ? "Submitting…" : "Submit quiz"}
        </Button>
      </CardContent>
    </Card>
  );
}
