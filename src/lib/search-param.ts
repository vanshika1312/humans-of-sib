/** Next.js search params can be `string | string[]` — use a single string for app logic. */
export function firstSearchParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}
