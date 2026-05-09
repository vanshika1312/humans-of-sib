import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

/** Allocate next `SIB-NNNNN` inside a transaction (best-effort uniqueness). */
export async function allocateEmployeeCode(tx: Prisma.TransactionClient): Promise<string> {
  let row = await tx.orgCounter.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) {
    row = await tx.orgCounter.create({
      data: { id: SINGLETON_ID, nextEmployeeSeq: 1 },
    });
  }
  const n = row.nextEmployeeSeq;
  await tx.orgCounter.update({
    where: { id: SINGLETON_ID },
    data: { nextEmployeeSeq: n + 1 },
  });
  return `SIB-${String(n).padStart(5, "0")}`;
}

/** For scripts / backfill when not inside a user-creating transaction. */
export async function allocateEmployeeCodeStandalone(): Promise<string> {
  return prisma.$transaction((tx) => allocateEmployeeCode(tx));
}
