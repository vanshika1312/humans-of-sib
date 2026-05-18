import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await requireAppViewer();
  if (!viewer) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const tasks = await prisma.personalTask.findMany({
    where: {
      assignedByUserId: viewer.id,
      assignedToUserId: { not: viewer.id },
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          image: true,
          title: true,
        },
      },
      stage: {
        select: {
          title: true,
          isFinishedColumn: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return Response.json({ ok: true, tasks }, { headers: { "Cache-Control": "no-store" } });
}

