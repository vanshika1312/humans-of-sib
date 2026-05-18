import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListTodo } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { displayName } from "@/lib/user-display-name";
import { canViewPersonalTasks, canEditPersonalTasks } from "@/lib/personal-tasks-access";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrCreatePersonalTaskBoard, type PersonalBoardPayload } from "@/lib/personal-task-board-setup";
import type { ClientBoard } from "./task-kanban-types";
import { AddBoardColumnDialog } from "./add-board-column-dialog";
import { TaskKanbanBoardLoader } from "./task-kanban-board-loader";
import { TeamTaskMemberCards, type TeamMemberForTasks } from "./team-task-member-cards";

type SearchParams = Promise<{ userId?: string; task?: string }>;

function serializeBoard(board: PersonalBoardPayload): ClientBoard {
  return {
    id: board.id,
    updatedAtMs: board.updatedAt.getTime(),
    stages: board.stages.map((s) => ({
      id: s.id,
      title: s.title,
      sortOrder: s.sortOrder,
      isFinishedColumn: s.isFinishedColumn,
    })),
    tasks: board.tasks.map((t) => ({
      id: t.id,
      stageId: t.stageId,
      title: t.title,
      description: t.description,
      sortOrder: t.sortOrder,
      attachments: t.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        url: a.url,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
      comments: t.comments.map((c) => ({
        id: c.id,
        authorId: c.authorId,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        author: {
          id: c.author.id,
          name: c.author.name,
          firstName: c.author.firstName,
          lastName: c.author.lastName,
          email: c.author.email,
          image: c.author.image,
        },
      })),
    })),
  };
}

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
  const targetUserId = typeof sp.userId === "string" && sp.userId.length > 0 ? sp.userId : viewer.id;
  const initialTaskId =
    typeof sp.task === "string" && sp.task.trim().length > 0 ? sp.task.trim().slice(0, 160) : null;

  const owner =
    targetUserId === viewer.id
      ? viewer
      : await prisma.user.findUnique({
          where: { id: targetUserId },
          select: {
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
          },
        });

  if (!owner || owner.status === "EXITED") notFound();

  const canView = canViewPersonalTasks({
    viewerUserId: viewer.id,
    viewerRole: viewer.role,
    ownerUserId: owner.id,
    ownerManagerId: owner.managerId,
    ownerDepartmentId: owner.departmentId,
    viewerHeadedDepartmentId: viewer.headedDept?.id ?? null,
  });

  if (!canView) notFound();

  const readOnly = !canEditPersonalTasks(viewer.id, owner.id);
  const ownerLabel = targetUserId === viewer.id ? "you" : displayName(owner);

  const memberSelect = {
    id: true,
    name: true,
    firstName: true,
    lastName: true,
    email: true,
    image: true,
    title: true,
  } as const;

  const [directReports, deptPeers] = await Promise.all([
    prisma.user.findMany({
      where: { managerId: viewer.id, status: "ACTIVE", id: { not: viewer.id } },
      select: memberSelect,
      orderBy: [{ firstName: "asc" }, { email: "asc" }],
    }),
    viewer.role === "DEPT_HEAD" && viewer.headedDept
      ? prisma.user.findMany({
          where: {
            departmentId: viewer.headedDept.id,
            status: "ACTIVE",
            id: { not: viewer.id },
          },
          select: memberSelect,
          orderBy: [{ firstName: "asc" }, { email: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const teamLinks = (() => {
    const byId = new Map<string, TeamMemberForTasks>();
    for (const u of directReports) byId.set(u.id, u);
    for (const u of deptPeers) byId.set(u.id, u);
    return Array.from(byId.values()).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  })();

  const teamIds = teamLinks.map((u) => u.id);

  let openCounts: Record<string, number> = {};
  if (teamIds.length > 0) {
    openCounts = Object.fromEntries(
      await Promise.all(
        teamIds.map(async (uid) => {
          const n = await prisma.personalTask.count({
            where: {
              board: { ownerUserId: uid },
              stage: { isFinishedColumn: false },
            },
          });
          return [uid, n] as const;
        }),
      ),
    );
  }

  const showTeamSection =
    teamLinks.length > 0 || ["HR", "CEO", "ADMIN"].includes(viewer.role);

  const prismaBoard = await getOrCreatePersonalTaskBoard(owner.id);
  const clientBoard = serializeBoard(prismaBoard);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-700 tracking-tight flex items-center gap-2">
            <ListTodo className="size-7 text-sky-600 shrink-0" />
            My tasks
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            Kanban board in the style of Jira: drag cards between columns, drag column headers to reorder statuses, open a
            card for details, attach files, and comment — rename columns, mark a column as done, and add or remove empty
            columns.
          </p>
        </div>
        {targetUserId !== viewer.id && (
          <Link
            href="/my-tasks"
            className="text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline"
          >
            Back to my board
          </Link>
        )}
      </div>

      {readOnly && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          You’re viewing <span className="font-semibold">{displayName(owner)}</span>&apos;s board read-only —
          comments are allowed where you already have visibility; attachments and edits stay with the owner.
        </div>
      )}

      {showTeamSection && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Team tasks</CardTitle>
            <CardDescription>
              Select someone to open their board.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <TeamTaskMemberCards members={teamLinks} openCounts={openCounts} viewingUserId={targetUserId} />
            {teamLinks.length === 0 && ["HR", "CEO", "ADMIN"].includes(viewer.role) && (
              <Link
                href="/people"
                className="inline-flex text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline"
              >
                Browse People to open someone’s board
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <CardTitle>
              {readOnly ? `Board · ${displayName(owner)}` : "Your board"}
            </CardTitle>
            <CardDescription>
              {readOnly
                ? "Open cards to read attachments and descriptions; managers and admins can leave comments."
                : ownerLabel === "you"
                  ? "Drag column headers to reorder statuses. Drag cards by the grip to move them. Click a card to open details."
                  : `Visible to ${ownerLabel}.`}
            </CardDescription>
          </div>
          {!readOnly && <AddBoardColumnDialog ownerUserId={owner.id} />}
        </CardHeader>
        <CardContent className="pt-1">
          <TaskKanbanBoardLoader
            board={clientBoard}
            ownerUserId={owner.id}
            viewerId={viewer.id}
            readOnly={readOnly}
            initialOpenTaskId={
              initialTaskId && prismaBoard.tasks.some((t) => t.id === initialTaskId)
                ? initialTaskId
                : null
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
