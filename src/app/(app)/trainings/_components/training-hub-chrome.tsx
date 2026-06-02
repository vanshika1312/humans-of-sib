import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "books", label: "Books" },
  { id: "courses", label: "Courses" },
  { id: "progress", label: "My progress" },
  { id: "certificates", label: "Certificates" },
] as const;

export type TrainingTab = (typeof TABS)[number]["id"];

export function parseTrainingTab(raw: string | undefined): TrainingTab {
  if (raw === "courses" || raw === "progress" || raw === "certificates") return raw;
  return "books";
}

export function TrainingHubChrome({ tab }: { tab?: string }) {
  const active = parseTrainingTab(tab);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-800 flex items-center gap-2">
          <span aria-hidden>🎓</span> Learning hub
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          Read motivational books, take free courses, pass quizzes, and earn points & certificates.
        </p>
      </div>
      <nav className="flex flex-wrap gap-2 border-b border-ink-100 pb-3 mb-6">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "books" ? "/trainings" : `/trainings?tab=${t.id}`}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              active === t.id ? "bg-sky-100 text-sky-900" : "text-ink-500 hover:bg-ink-50 hover:text-ink-700",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
