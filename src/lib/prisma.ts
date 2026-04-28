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

export const prisma = global._prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") {
  global._prisma = undefined; // clear on hot-reload so new models are always picked up
  global._prisma = prisma;
}
