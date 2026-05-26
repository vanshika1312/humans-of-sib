import type { Prisma } from "@/generated/prisma";

/** Match applications when `q` appears in candidate name, email, phone, or job title. */
export function hiringApplicationTextSearchWhere(q: string): Prisma.HiringApplicationWhereInput {
  const trimmed = q.trim();
  const or: Prisma.HiringApplicationWhereInput[] = [
    { candidate: { fullName: { contains: trimmed, mode: "insensitive" } } },
    { candidate: { email: { contains: trimmed, mode: "insensitive" } } },
    { candidate: { phone: { contains: trimmed, mode: "insensitive" } } },
    { job: { title: { contains: trimmed, mode: "insensitive" } } },
  ];

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length >= 4 && digitsOnly !== trimmed) {
    or.push({ candidate: { phone: { contains: digitsOnly, mode: "insensitive" } } });
  }

  return { OR: or };
}
