import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

/** Fields/layout includes shared by `(app)` layout and most app routes — one DB round-trip per request via `cache()`. */
const appViewerInclude = {
  department: true,
  city: true,
  headedDept: { select: { id: true, name: true, emoji: true } as const },
} satisfies Prisma.UserInclude;

export type AppViewer = Prisma.UserGetPayload<{ include: typeof appViewerInclude }>;

export const requireAppViewer = cache(async (): Promise<AppViewer | null> => {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  return prisma.user.findUnique({
    where: { email },
    include: appViewerInclude,
  });
});
