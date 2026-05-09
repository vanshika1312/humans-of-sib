type NameFields = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

/** Prefer explicit first/last; fall back to legacy `name`. */
export function displayName(u: NameFields | null | undefined): string {
  if (!u) return "—";
  const parts = [u.firstName?.trim(), u.lastName?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (u.name?.trim()) return u.name.trim();
  return "—";
}
