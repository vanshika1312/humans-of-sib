import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ListTodo } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { displayName } from "@/lib/user-display-name";
import { serializePersonalBoardForClient } from "@/lib/personal-board-client";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrCreatePersonalTaskBoard } from "@/lib/personal-task-board-setup";
import { AddBoardColumnDialog } from "./add-board-column-dialog";
import { AssignTaskDialog, type AssignableTaskMember } from "./assign-task-dialog";
import type { ClientBoard, ClientTaskAssignee } from "./task-kanban-types";
import { loadPersonalTaskBoardForModal } from "./board-actions";
import { TaskKanbanBoardLoader } from "./task-kanban-board-loader";
import { TeamTaskMemberCards, type TeamMemberForTasks } from "./team-task-member-cards";
import { AssignedByMeTasks } from "./assigned-by-me-tasks";

type SearchParams = Promise<{ userId?: string; task?: string }>;

export default function MyTasksPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <MyTasksPageBody searchParams={searchParams} />
    </Suspense>
  );
}

async function MyTasksPageBody({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireAppViewer();
  if (!viewer) notFound();

  const sp = await searchParams;
  const initialTaskParam =
    typeof sp.task === "string" && sp.task.trim().length > 0 ? sp.task.trim().slice(0, 160) : null;

  const memberSelect = {
    id: true,
    name: true,
    firstName: true,
    lastName: true,
    email: true,
    image: true,
    title: true,
    status: true,
    managerId: true,
    departmentId: true,
  } as const;

  const allActiveMembers = await prisma.user.findMany({
    where: { status: "ACTIVE", id: { not: viewer.id } },
    select: memberSelect,
    orderBy: [{ firstName: "asc" }, { email: "asc" }],
  });

  const assignableMembers: AssignableTaskMember[] = allActiveMembers.map((u) => ({
    id: u.id,
    name: u.name,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    title: u.title,
  }));

  const memberOptions: ClientTaskAssignee[] = [
    {
      id: viewer.id,
      name: viewer.name,
      firstName: viewer.firstName,
      lastName: viewer.lastName,
      email: viewer.email,
      image: viewer.image,
    },
    ...allActiveMembers.map((u) => ({
      id: u.id,
      name: u.name,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      image: u.image,
    })),
  ];

  const canSeeTeamTaskSummaries = viewer.role === "ADMIN" || viewer.role === "MANAGER";

  const teamLinks = (() => {
    if (!canSeeTeamTaskSummaries) return [];
    const source =
      viewer.role === "MANAGER" ? allActiveMembers.filter((u) => u.managerId === viewer.id) : allActiveMembers;

    const byId = new Map<string, TeamMemberForTasks>();
    for (const u of source) {
      if (u.status === "EXITED") continue;
      byId.set(u.id, {
        id: u.id,
        name: u.name,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        image: u.image,
        title: u.title,
      });
    }
    return Array.from(byId.values()).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  })();

  const assignedByMeTasks = await prisma.personalTask.findMany({
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

  const trackedCounts: Record<string, number> = {};
  if (canSeeTeamTaskSummaries && teamLinks.length > 0) {
    const teamIds = teamLinks.map((u) => u.id);
    const boards = await prisma.personalTaskBoard.findMany({
      where: { ownerUserId: { in: teamIds } },
      select: { id: true, ownerUserId: true },
    });
    const boardIds = boards.map((b) => b.id);
    const ownerByBoardId = new Map(boards.map((b) => [b.id, b.ownerUserId]));
    if (boardIds.length > 0) {
      const counts = await prisma.personalTask.groupBy({
        by: ["boardId"],
        where: {
          boardId: { in: boardIds },
          stage: { isFinishedColumn: false },
        },
        _count: { _all: true },
      });
      for (const c of counts) {
        const ownerUserId = ownerByBoardId.get(c.boardId);
        if (!ownerUserId) continue;
        trackedCounts[ownerUserId] = c._count._all;
      }
    }
  }

  const showTeamGrid = canSeeTeamTaskSummaries && teamLinks.length > 0;

  const prismaViewerBoard = await getOrCreatePersonalTaskBoard(viewer.id);
  const clientBoardMine = serializePersonalBoardForClient(prismaViewerBoard);

  /** Deep link `/my-tasks?userId=` → modal open with SSR-prefetched board */
  let initialTeamOverlay: { userId: string; board: ClientBoard; initialOpenTaskId: string | null } | null = null;
  let peekTeamMemberCard: TeamMemberForTasks | null = null;

  const urlPeerIdRaw = typeof sp.userId === "string" ? sp.userId.trim() : "";
  const urlPeerId = urlPeerIdRaw.length > 0 && urlPeerIdRaw !== viewer.id ? urlPeerIdRaw : null;

  if (urlPeerId) {
    const rBoard = await loadPersonalTaskBoardForModal(urlPeerId);
    if (rBoard.ok) {
      initialTeamOverlay = {
        userId: urlPeerId,
        board: rBoard.board,
        initialOpenTaskId:
          initialTaskParam && rBoard.board.tasks.some((task) => task.id === initialTaskParam) ? initialTaskParam : null,
      };
      peekTeamMemberCard =
        teamLinks.find((m) => m.id === urlPeerId) ??
        (await prisma.user.findUnique({
          where: { id: urlPeerId },
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            title: true,
          },
        }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink-700">
            <ListTodo className="size-7 shrink-0 text-sky-600" />
            My tasks
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Use your personal board for your own work, assign tasks across the organisation, and track only the tasks you
            delegated without seeing someone else&apos;s full list unless your role already allows it.
          </p>
        </div>
        <AssignTaskDialog members={assignableMembers} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assigned by me</CardTitle>
          <CardDescription>
            Track delegated tasks without opening someone&apos;s full board. Click any task to jump into a filtered teammate view.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <AssignedByMeTasks initialTasks={assignedByMeTasks} />
        </CardContent>
      </Card>

      <TeamTaskMemberCards
        members={showTeamGrid ? teamLinks : []}
        trackedCounts={trackedCounts}
        viewerId={viewer.id}
        peekMember={peekTeamMemberCard}
        initialOverlay={initialTeamOverlay}
        memberOptions={memberOptions}
        showGrid={showTeamGrid}
      />

      <Card id="your-board-anchor">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <CardTitle>Your board</CardTitle>
            <CardDescription>
              Drag column headers to reorder statuses. Drag cards by the grip to move them. Click a card to open details.
            </CardDescription>
          </div>
          <AddBoardColumnDialog ownerUserId={viewer.id} />
        </CardHeader>
        <CardContent className="pt-1">
          <TaskKanbanBoardLoader
            board={clientBoardMine}
            ownerUserId={viewer.id}
            viewerId={viewer.id}
            readOnly={false}
            initialOpenTaskId={
              !urlPeerId &&
              initialTaskParam &&
              prismaViewerBoard.tasks.some((t) => t.id === initialTaskParam)
                ? initialTaskParam
                : null
            }
            memberOptions={memberOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
