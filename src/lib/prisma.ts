import { PrismaClient } from "@/generated/prisma";

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
}

function makePrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/**
 * Reuse one client per runtime, but replace it after `prisma generate` adds models.
 * Otherwise `global._prisma` can hold an old PrismaClient without e.g. `leaveBalance`,
 * and `prisma.leaveBalance` is undefined until the dev server fully restarts.
 */
function getPrisma(): PrismaClient {
  const cached = global._prisma;
  const isStale = Boolean(cached) && !("leaveBalance" in (cached as object));

  if (cached && !isStale) return cached;

  if (cached && isStale) {
    void cached.$disconnect().catch(() => {});
    global._prisma = undefined;
  }

  const client = makePrisma();
  global._prisma = client;
  return client;
}

export const prisma = getPrisma();
