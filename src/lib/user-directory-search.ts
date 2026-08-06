import type { Prisma } from "@/generated/prisma";

type SearchableUser = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  employeeCode?: string | null;
};

/** In-memory equivalent of {@link userDirectoryTextSearchWhere}, for lists already loaded from the DB. */
export function userDirectoryMatches(user: SearchableUser, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;

  const fields = [
    user.name,
    user.firstName,
    user.lastName,
    user.email,
    user.personalEmail,
    user.phone,
    user.employeeCode,
  ];
  if (fields.some((f) => f?.toLowerCase().includes(needle))) return true;

  const digitsOnly = needle.replace(/\D/g, "");
  if (digitsOnly.length >= 4 && user.phone) {
    return user.phone.replace(/\D/g, "").includes(digitsOnly);
  }
  return false;
}

/** Match users when `q` appears in their name, work/personal email, phone, or Employee ID. */
export function userDirectoryTextSearchWhere(q: string): Prisma.UserWhereInput {
  const trimmed = q.trim();
  const or: Prisma.UserWhereInput[] = [
    { name: { contains: trimmed, mode: "insensitive" } },
    { firstName: { contains: trimmed, mode: "insensitive" } },
    { lastName: { contains: trimmed, mode: "insensitive" } },
    { email: { contains: trimmed, mode: "insensitive" } },
    { personalEmail: { contains: trimmed, mode: "insensitive" } },
    { phone: { contains: trimmed, mode: "insensitive" } },
    { employeeCode: { contains: trimmed, mode: "insensitive" } },
  ];

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length >= 4 && digitsOnly !== trimmed) {
    or.push({ phone: { contains: digitsOnly, mode: "insensitive" } });
  }

  return { OR: or };
}
