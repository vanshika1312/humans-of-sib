/**
 * Turn computed working weekdays per policy half ({ periodYear-half -> days }) into
 * ledger debits (0.5-day granularity when needed) that sum to min(overrideTotal, sumComputed).
 */
export function ledgerDebitSplitByHalf(
  computedByHalf: Map<string, number>,
  overrideTotal: number | null | undefined,
): Map<string, number> {
  if (computedByHalf.size === 0) return new Map();

  const keys = [...computedByHalf.keys()].sort();
  const entries = keys.map((k) => [k, computedByHalf.get(k) ?? 0] as const);
  const sumComputed = entries.reduce((a, [, v]) => a + v, 0);
  if (sumComputed <= 0) {
    return new Map(entries.map(([k]) => [k, 0]));
  }

  let target =
    overrideTotal === null || overrideTotal === undefined ? sumComputed : Number(overrideTotal);

  if (!Number.isFinite(target)) target = sumComputed;
  target = Math.max(0, Math.min(target, sumComputed));

  if (target === sumComputed) {
    return new Map(entries);
  }
  if (target === 0) {
    return new Map(entries.map(([k]) => [k, 0]));
  }

  return splitDebitProportionally(entries, target);
}

/** Allocate `target` across halves proportionally to weights, rounded to nearest 0.5 day. */
function splitDebitProportionally(
  entries: readonly (readonly [string, number])[],
  target: number,
): Map<string, number> {
  const sumComputed = entries.reduce((a, [, v]) => a + v, 0);
  if (sumComputed <= 0) return new Map(entries.map(([k]) => [k, 0]));
  const out = new Map<string, number>();
  let assigned = 0;
  entries.forEach(([k, v], i) => {
    if (i === entries.length - 1) {
      out.set(k, Math.max(0, Math.round((target - assigned) * 2) / 2));
    } else {
      const share = (target * v) / sumComputed;
      const part = Math.max(0, Math.round(share * 2) / 2);
      out.set(k, part);
      assigned += part;
    }
  });
  return out;
}
