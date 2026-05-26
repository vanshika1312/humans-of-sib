import { formatDate } from "@/lib/utils";

const FACE_BY_SCORE: Record<number, string> = {
  1: "😩",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "🤩",
};

type Point = { weekStart: Date; score: number };

export function PulseTrendChart({ points }: { points: Point[] }) {
  const ordered = [...points].reverse();
  const maxScore = 5;
  const maxBarPx = 96;

  if (ordered.length === 0) {
    return (
      <p className="text-sm text-ink-400 text-center py-6">Submit a few weeks of pulse to see your trend.</p>
    );
  }

  return (
    <div>
      <div
        className="flex items-end justify-between gap-1.5 h-28"
        role="img"
        aria-label="Your pulse scores over recent weeks"
      >
        {ordered.map((p) => {
          const barH = Math.max(6, Math.round((p.score / maxScore) * maxBarPx));
          return (
            <div key={p.weekStart.toISOString()} className="flex flex-1 flex-col items-center gap-1 min-w-0">
              <span className="text-lg leading-none" aria-hidden>
                {FACE_BY_SCORE[p.score]}
              </span>
              <div
                className="w-full max-w-[2.25rem] rounded-t-md bg-sky-400"
                style={{ height: barH }}
                title={`${formatDate(p.weekStart)}: ${p.score}/5`}
              />
              <span className="text-[9px] text-ink-400 truncate w-full text-center">
                {p.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-ink-400 mt-3 text-center">Oldest ← → newest</p>
    </div>
  );
}
