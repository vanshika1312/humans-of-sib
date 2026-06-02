export type QuizQuestionInput = {
  prompt: string;
  options: { label: string; isCorrect: boolean }[];
};

export type QuizAnswerMap = Record<string, string>;

export function scoreTrainingQuiz(
  questions: { id: string; options: { id: string; isCorrect: boolean }[] }[],
  answers: QuizAnswerMap,
): { score: number; passed: boolean; passThreshold: number } {
  if (questions.length === 0) {
    return { score: 0, passed: false, passThreshold: 70 };
  }

  let correct = 0;
  for (const q of questions) {
    const selected = answers[q.id];
    if (!selected) continue;
    const opt = q.options.find((o) => o.id === selected);
    if (opt?.isCorrect) correct += 1;
  }

  const score = Math.round((correct / questions.length) * 100);
  return { score, passed: false, passThreshold: 70 };
}

export function gradeTrainingQuiz(
  questions: { id: string; options: { id: string; isCorrect: boolean }[] }[],
  answers: QuizAnswerMap,
  passThreshold: number,
): { score: number; passed: boolean } {
  const base = scoreTrainingQuiz(questions, answers);
  return { score: base.score, passed: base.score >= passThreshold };
}

export function parseQuizQuestionsJson(raw: string): QuizQuestionInput[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((q) => {
        if (!q || typeof q !== "object") return null;
        const prompt = typeof (q as { prompt?: unknown }).prompt === "string" ? (q as { prompt: string }).prompt.trim() : "";
        const optionsRaw = (q as { options?: unknown }).options;
        if (!prompt || !Array.isArray(optionsRaw)) return null;
        const options = optionsRaw
          .map((o) => {
            if (!o || typeof o !== "object") return null;
            const label = typeof (o as { label?: unknown }).label === "string" ? (o as { label: string }).label.trim() : "";
            const isCorrect = Boolean((o as { isCorrect?: unknown }).isCorrect);
            if (!label) return null;
            return { label, isCorrect };
          })
          .filter(Boolean) as { label: string; isCorrect: boolean }[];
        if (options.length < 2) return null;
        if (!options.some((o) => o.isCorrect)) return null;
        return { prompt, options };
      })
      .filter(Boolean) as QuizQuestionInput[];
  } catch {
    return [];
  }
}

export function validateQuizQuestions(questions: QuizQuestionInput[], minQuestions: number): string | null {
  if (questions.length < minQuestions) {
    return `Add at least ${minQuestions} quiz questions before publishing.`;
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    if (!q.prompt) return `Question ${i + 1} needs a prompt.`;
    if (q.options.length < 2) return `Question ${i + 1} needs at least 2 options.`;
    if (!q.options.some((o) => o.isCorrect)) return `Question ${i + 1} needs one correct answer.`;
  }
  return null;
}
