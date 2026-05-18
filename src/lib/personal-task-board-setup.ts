import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

const DEFAULT_STAGES: { title: string; sortOrder: number; isFinishedColumn: boolean }[] = [
  { title: "To be worked on", sortOrder: 0, isFinishedColumn: false },
  { title: "To do", sortOrder: 1, isFinishedColumn: false },
  { title: "In progress", sortOrder: 2, isFinishedColumn: false },
  { title: "Done", sortOrder: 3, isFinishedColumn: true },
];

const boardInclude = Prisma.validator<Prisma.PersonalTaskBoardInclude>()({
  stages: { orderBy: { sortOrder: "asc" } },
  tasks: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      attachments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          url: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
  },
});

export type PersonalBoardPayload = Prisma.PersonalTaskBoardGetPayload<{ include: typeof boardInclude }>;

export async function getOrCreatePersonalTaskBoard(ownerUserId: string): Promise<PersonalBoardPayload> {
  const found = await prisma.personalTaskBoard.findUnique({
    where: { ownerUserId },
    include: boardInclude,
  });

  if (found) return found;

  return prisma.personalTaskBoard.create({
    data: {
      ownerUserId,
      stages: { create: [...DEFAULT_STAGES] },
    },
    include: boardInclude,
  });
}
