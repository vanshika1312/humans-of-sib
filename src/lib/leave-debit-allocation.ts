/**
 * Turn computed working weekdays per policy half ({ periodYear-half -> days }) into
 * integer ledger debits that sum to min(overrideTotal, sumComputed).
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
    overrideTotal === null || overrideTotal === undefined
      ? sumComputed
      : Math.floor(Number(overrideTotal));

  if (!Number.isFinite(target)) target = sumComputed;
  target = Math.max(0, Math.min(target, sumComputed));

  if (target === sumComputed) {
    return new Map(entries);
  }
  if (target === 0) {
    return new Map(entries.map(([k]) => [k, 0]));
  }

  const frac = entries.map(([k, v]) => {
    const ideal = (target * v) / sumComputed;
    const floorPart = Math.floor(ideal);
    return { k, v, ideal, floor: floorPart, fracRem: ideal - floorPart };
  });

  let assigned = frac.reduce((a, f) => a + f.floor, 0);
  let leftover = target - assigned;
  frac.sort((a, b) => b.fracRem - a.fracRem || a.k.localeCompare(b.k));
  for (let i = 0; i < frac.length && leftover > 0; i++) {
    frac[i]!.floor++;
    leftover--;
  }

  return new Map(
    frac
      .sort((a, b) => a.k.localeCompare(b.k))
      .map((f) => [f.k, f.floor] as const),
  );
}
