/**
 * Canonical Skillinabox departments: shown in every department picker (this order).
 * Align with `prisma/seed.ts` via {@link WORKSPACE_DEPARTMENTS}.
 */
export const WORKSPACE_DEPARTMENTS = [
  { name: "Sales", slug: "sales", emoji: "💼" },
  { name: "Marketing", slug: "marketing", emoji: "📣" },
  { name: "Social Media", slug: "social-media", emoji: "📱" },
  { name: "Product", slug: "product", emoji: "🛠️" },
  { name: "HR", slug: "hr", emoji: "👥" },
  { name: "Supply Chain", slug: "supply-chain", emoji: "📦" },
  { name: "Operations", slug: "operations", emoji: "⚙️" },
  { name: "Finance", slug: "finance", emoji: "💰" },
  { name: "Accounts", slug: "accounts", emoji: "🧾" },
  { name: "Video Editing", slug: "video-editing", emoji: "🎬" },
  { name: "CSAT", slug: "csat", emoji: "🤝" },
  { name: "Tech", slug: "tech", emoji: "💻" },
  { name: "Founders' Office", slug: "founders-office", emoji: "✨" },
] as const;

export type WorkspaceDepartmentRow = (typeof WORKSPACE_DEPARTMENTS)[number];

/** Names only (for creatable combo suggestions). */
export const WORKSPACE_DEPARTMENT_NAMES: readonly string[] = WORKSPACE_DEPARTMENTS.map((d) => d.name);

export function slugifyDepartmentName(raw: string): string {
  const norm = raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return norm.length > 0 ? norm : "department";
}
