import type { HiringJobQuestionType } from "@/generated/prisma";

export const HIRING_JOB_QUESTION_TYPES: HiringJobQuestionType[] = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "DROPDOWN",
  "FILE",
  "YES_NO",
];

export const HIRING_JOB_QUESTION_TYPE_LABEL: Record<HiringJobQuestionType, string> = {
  SHORT_TEXT: "Short answer",
  LONG_TEXT: "Long answer",
  DROPDOWN: "Dropdown",
  FILE: "File upload",
  YES_NO: "Yes / No",
};

export const MAX_JOB_SCREENING_QUESTIONS = 25;
export const MAX_DROPDOWN_OPTIONS = 20;
export const SCREENING_FILE_ACCEPT =
  ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,.zip,.txt,.ppt,.pptx,application/pdf";

export type HiringJobQuestionInput = {
  id?: string;
  prompt: string;
  helpText?: string;
  type: HiringJobQuestionType;
  required: boolean;
  options: string[];
};

export type HiringJobQuestionRecord = {
  id: string;
  prompt: string;
  helpText: string | null;
  type: HiringJobQuestionType;
  required: boolean;
  optionsJson: string | null;
  sortOrder: number;
};

function isQuestionType(value: string): value is HiringJobQuestionType {
  return (HIRING_JOB_QUESTION_TYPES as string[]).includes(value);
}

export function parseDropdownOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean)
      .slice(0, MAX_DROPDOWN_OPTIONS);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parseDropdownOptions(parsed);
    } catch {
      /* treat as newline-separated */
    }
    return raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_DROPDOWN_OPTIONS);
  }
  return [];
}

export function parseHiringJobQuestionsFromJson(raw: unknown): {
  questions: HiringJobQuestionInput[];
  error: string | null;
} {
  if (raw == null || raw === "") return { questions: [], error: null };
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return { questions: [], error: null };
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      return { questions: [], error: "Application questions could not be read. Try again." };
    }
  }
  if (!Array.isArray(parsed)) {
    return { questions: [], error: "Application questions could not be read. Try again." };
  }
  if (parsed.length > MAX_JOB_SCREENING_QUESTIONS) {
    return {
      questions: [],
      error: `You can add at most ${MAX_JOB_SCREENING_QUESTIONS} custom questions.`,
    };
  }

  const questions: HiringJobQuestionInput[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
    if (!prompt) continue;
    if (prompt.length > 500) {
      return { questions: [], error: "A question is longer than 500 characters." };
    }
    const typeRaw = typeof o.type === "string" ? o.type : "";
    if (!isQuestionType(typeRaw)) {
      return { questions: [], error: "Pick a valid answer type for each question." };
    }
    const helpText =
      typeof o.helpText === "string" ? o.helpText.trim().slice(0, 500) || undefined : undefined;
    const required = o.required === true || o.required === "true" || o.required === "on";
    const options = typeRaw === "DROPDOWN" ? parseDropdownOptions(o.options ?? o.optionsText) : [];
    if (typeRaw === "DROPDOWN" && options.length < 2) {
      return {
        questions: [],
        error: `“${prompt}” needs at least two dropdown options.`,
      };
    }
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : undefined;
    questions.push({ id, prompt: prompt.slice(0, 500), helpText, type: typeRaw, required, options });
  }
  return { questions, error: null };
}

export function parseHiringJobQuestionsFromForm(formData: FormData): {
  questions: HiringJobQuestionInput[];
  error: string | null;
} {
  return parseHiringJobQuestionsFromJson(formData.get("screeningQuestionsJson"));
}

export function questionOptionsFromRecord(row: HiringJobQuestionRecord): string[] {
  return parseDropdownOptions(row.optionsJson);
}

export function toEditorQuestions(rows: HiringJobQuestionRecord[]): HiringJobQuestionInput[] {
  return rows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    helpText: row.helpText ?? undefined,
    type: row.type,
    required: row.required,
    options: questionOptionsFromRecord(row),
  }));
}

type TxQuestionClient = {
  hiringJobQuestion: {
    findMany: (args: { where: { jobId: string }; select: { id: true } }) => Promise<{ id: string }[]>;
    update: (args: {
      where: { id: string };
      data: {
        prompt: string;
        helpText: string | null;
        type: HiringJobQuestionType;
        required: boolean;
        optionsJson: string | null;
        sortOrder: number;
      };
    }) => Promise<unknown>;
    create: (args: {
      data: {
        jobId: string;
        prompt: string;
        helpText: string | null;
        type: HiringJobQuestionType;
        required: boolean;
        optionsJson: string | null;
        sortOrder: number;
      };
    }) => Promise<{ id: string }>;
    deleteMany: (args: {
      where: { jobId: string; id?: { notIn: string[] } };
    }) => Promise<unknown>;
  };
};

export async function syncJobQuestionsInTxn(
  tx: TxQuestionClient,
  jobId: string,
  questions: HiringJobQuestionInput[],
) {
  const existing = await tx.hiringJobQuestion.findMany({
    where: { jobId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((q) => q.id));
  const keepIds: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const optionsJson = q.type === "DROPDOWN" ? JSON.stringify(q.options) : null;
    const helpText = q.helpText ?? null;
    if (q.id && existingIds.has(q.id)) {
      keepIds.push(q.id);
      await tx.hiringJobQuestion.update({
        where: { id: q.id },
        data: {
          prompt: q.prompt,
          helpText,
          type: q.type,
          required: q.required,
          optionsJson,
          sortOrder: i,
        },
      });
    } else {
      const created = await tx.hiringJobQuestion.create({
        data: {
          jobId,
          prompt: q.prompt,
          helpText,
          type: q.type,
          required: q.required,
          optionsJson,
          sortOrder: i,
        },
      });
      keepIds.push(created.id);
    }
  }

  await tx.hiringJobQuestion.deleteMany(
    keepIds.length === 0
      ? { where: { jobId } }
      : { where: { jobId, id: { notIn: keepIds } } },
  );
}

export type ScreeningAnswerToSave = {
  questionId: string;
  prompt: string;
  type: HiringJobQuestionType;
  textValue: string | null;
  file: File | null;
};

export function collectScreeningAnswersFromForm(
  formData: FormData,
  questions: HiringJobQuestionRecord[],
): { answers: ScreeningAnswerToSave[]; error: string | null } {
  const answers: ScreeningAnswerToSave[] = [];

  for (const q of questions) {
    const options = questionOptionsFromRecord(q);
    if (q.type === "FILE") {
      const file = formData.get(`qfile_${q.id}`);
      const hasFile = file instanceof File && file.size > 0;
      if (q.required && !hasFile) {
        return { answers: [], error: `Please upload a file for “${q.prompt}”.` };
      }
      answers.push({
        questionId: q.id,
        prompt: q.prompt,
        type: q.type,
        textValue: null,
        file: hasFile ? file : null,
      });
      continue;
    }

    const raw = String(formData.get(`q_${q.id}`) ?? "").trim();
    if (q.required && !raw) {
      return { answers: [], error: `Please answer “${q.prompt}”.` };
    }
    if (!raw) {
      answers.push({
        questionId: q.id,
        prompt: q.prompt,
        type: q.type,
        textValue: null,
        file: null,
      });
      continue;
    }

    if (q.type === "DROPDOWN" && !options.includes(raw)) {
      return { answers: [], error: `Pick a valid option for “${q.prompt}”.` };
    }
    if (q.type === "YES_NO" && raw !== "Yes" && raw !== "No") {
      return { answers: [], error: `Choose Yes or No for “${q.prompt}”.` };
    }
    if (q.type === "SHORT_TEXT" && raw.length > 500) {
      return { answers: [], error: `“${q.prompt}” must be 500 characters or fewer.` };
    }
    if (q.type === "LONG_TEXT" && raw.length > 8000) {
      return { answers: [], error: `“${q.prompt}” is too long.` };
    }

    answers.push({
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      textValue: raw,
      file: null,
    });
  }

  return { answers, error: null };
}
