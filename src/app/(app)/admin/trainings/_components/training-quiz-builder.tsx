"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { QuizQuestionInput } from "@/lib/training-quiz";
import { MIN_QUIZ_QUESTIONS } from "@/lib/training-admin";
import { Plus, Trash2 } from "lucide-react";

function emptyQuestion(): QuizQuestionInput {
  return {
    prompt: "",
    options: [
      { label: "", isCorrect: true },
      { label: "", isCorrect: false },
    ],
  };
}

export function TrainingQuizBuilder({
  initialQuestions,
  name = "quizJson",
}: {
  initialQuestions: QuizQuestionInput[];
  name?: string;
}) {
  const [questions, setQuestions] = useState<QuizQuestionInput[]>(
    initialQuestions.length > 0 ? initialQuestions : [emptyQuestion(), emptyQuestion(), emptyQuestion()],
  );

  function updateQuestion(idx: number, patch: Partial<QuizQuestionInput>) {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function updateOption(qIdx: number, oIdx: number, label: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const options = q.options.map((o, j) => (j === oIdx ? { ...o, label } : o));
        return { ...q, options };
      }),
    );
  }

  function setCorrect(qIdx: number, oIdx: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        return {
          ...q,
          options: q.options.map((o, j) => ({ ...o, isCorrect: j === oIdx })),
        };
      }),
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addOption(qIdx: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx || q.options.length >= 5) return q;
        return { ...q, options: [...q.options, { label: "", isCorrect: false }] };
      }),
    );
  }

  function removeOption(qIdx: number, oIdx: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx || q.options.length <= 2) return q;
        const options = q.options.filter((_, j) => j !== oIdx);
        if (!options.some((o) => o.isCorrect)) options[0] = { ...options[0]!, isCorrect: true };
        return { ...q, options };
      }),
    );
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(questions)} readOnly />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink-700">Quiz questions</h3>
          <p className="text-xs text-ink-400 mt-0.5">
            Minimum {MIN_QUIZ_QUESTIONS} questions required to publish. One correct answer per question.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addQuestion}>
          <Plus className="size-4" /> Add question
        </Button>
      </div>

      {questions.map((q, qIdx) => (
        <Card key={qIdx}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <Label htmlFor={`q-${qIdx}`}>Question {qIdx + 1}</Label>
                <Input
                  id={`q-${qIdx}`}
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
                  placeholder="What is the main idea of chapter 1?"
                  className="mt-1"
                />
              </div>
              {questions.length > 1 ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => removeQuestion(qIdx)} aria-label="Remove question">
                  <Trash2 className="size-4 text-ink-400" />
                </Button>
              ) : null}
            </div>

            <div className="space-y-2">
              {q.options.map((o, oIdx) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qIdx}`}
                    checked={o.isCorrect}
                    onChange={() => setCorrect(qIdx, oIdx)}
                    aria-label={`Mark option ${oIdx + 1} as correct`}
                  />
                  <Input
                    value={o.label}
                    onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                    placeholder={`Option ${oIdx + 1}`}
                    className="flex-1"
                  />
                  {q.options.length > 2 ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeOption(qIdx, oIdx)}>
                      <Trash2 className="size-3.5 text-ink-400" />
                    </Button>
                  ) : null}
                </div>
              ))}
              {q.options.length < 5 ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => addOption(qIdx)}>
                  <Plus className="size-3.5" /> Add option
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
