import type { Prisma } from "@/generated/prisma";
import { slugifyDepartmentName, WORKSPACE_DEPARTMENTS } from "@/lib/workspace-departments";

type Db = {
  department: Prisma.DepartmentDelegate;
};

/**
 * Find an existing department by case-insensitive name, or create one (unique slug).
 */
export async function findOrCreateDepartmentByName(db: Db, rawName: string): Promise<{ id: string } | null> {
  const name = rawName.replace(/\s+/g, " ").trim();
  if (!name) return null;

  const lower = name.toLowerCase();

  let existing: { id: string; name: string; slug: string } | null = null;
  try {
    existing = await db.department.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true, slug: true },
    });
  } catch {
    const rows = await db.department.findMany({ select: { id: true, name: true, slug: true } });
    existing = rows.find((r) => r.name.trim().toLowerCase() === lower) ?? null;
  }

  if (existing) return { id: existing.id };

  const base = slugifyDepartmentName(name);
  let slug = base;
  for (let n = 0; n < 40; n++) {
    const clash = await db.department.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
    if (!clash) break;
    if (clash.name.trim().toLowerCase() === lower) {
      return { id: clash.id };
    }
    slug = `${base}-${n + 1}`;
  }

  const presetEmoji =
    WORKSPACE_DEPARTMENTS.find((d) => d.slug === base || d.name.trim().toLowerCase() === lower)?.emoji ?? null;

  const created = await db.department.create({
    data: {
      name,
      slug,
      emoji: presetEmoji,
    },
  });
  return { id: created.id };
}

/** Read `departmentName` from FormData and return its id, or null if empty. */
export async function departmentIdFromForm(
  db: Db,
  formData: FormData,
  fieldName = "departmentName",
): Promise<string | null> {
  const raw = String(formData.get(fieldName) ?? "").trim();
  if (!raw) return null;
  const row = await findOrCreateDepartmentByName(db, raw);
  return row?.id ?? null;
}
