import { Suspense } from "react";
import Link from "next/link";
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
import type { ClientBoard } from "./task-kanban-types";
import { loadPersonalTaskBoardForModal } from "./board-actions";
import { TaskKanbanBoardLoader } from "./task-kanban-board-loader";
import { TeamTaskMemberCards, type TeamMemberForTasks } from "./team-task-member-cards";

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
    for (const u of directReports) {
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
    for (const u of deptPeers) {
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

  const prismaViewerBoard = await getOrCreatePersonalTaskBoard(viewer.id);
  const clientBoardMine = serializePersonalBoardForClient(prismaViewerBoard);

  /** Deep link `/my-tasks?userId=` → modal open with SSR-prefetched board */
  let initialTeamOverlay: { userId: string; board: ClientBoard } | null = null;
  let peekTeamMemberCard: TeamMemberForTasks | null = null;

  const urlPeerIdRaw = typeof sp.userId === "string" ? sp.userId.trim() : "";
  const urlPeerId = urlPeerIdRaw.length > 0 && urlPeerIdRaw !== viewer.id ? urlPeerIdRaw : null;

  if (urlPeerId) {
    const rBoard = await loadPersonalTaskBoardForModal(urlPeerId);
    if (rBoard.ok) {
      initialTeamOverlay = { userId: urlPeerId, board: rBoard.board };
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
            Kanban board in the style of Jira: drag cards between columns, drag column headers to reorder statuses, open a
            card for details, attach files, and comment — rename columns, mark a column as done, and add or remove empty
            columns.
          </p>
        </div>
      </div>

      {showTeamSection && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Team tasks</CardTitle>
            <CardDescription>
              Click a teammate — their board opens over a blurred backdrop. Your board stays below.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {teamLinks.length > 0 || initialTeamOverlay ? (
              <TeamTaskMemberCards
                members={teamLinks}
                openCounts={openCounts}
                viewerId={viewer.id}
                peekMember={peekTeamMemberCard}
                initialOverlay={initialTeamOverlay}
              />
            ) : null}
            {teamLinks.length === 0 && ["HR", "CEO", "ADMIN"].includes(viewer.role) && (
              <Link
                href="/people"
                className="inline-flex text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline"
              >
                Browse People — open links use the same overlay when you&apos;re allowed to view someone&apos;s board
              </Link>
            )}
          </CardContent>
        </Card>
      )}

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
              initialTaskParam &&
              prismaViewerBoard.tasks.some((t) => t.id === initialTaskParam)
                ? initialTaskParam
                : null
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
