import { CelebrationCard } from "./CelebrationCard";
import type { CelebrationEntry } from "@/lib/celebrations";

export function CelebrationsToday({ entries }: { entries: CelebrationEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-ink-600 mb-3">🎊 Today</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {entries.map((entry) => (
          <CelebrationCard key={`${entry.kind}-${entry.userId}`} entry={entry} />
        ))}
      </div>
    </section>
  );
}
