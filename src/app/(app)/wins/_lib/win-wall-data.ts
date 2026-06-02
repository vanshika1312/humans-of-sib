import { prisma } from "@/lib/prisma";
import { currentSpotlightMonth, formatInrCompact, reactionPoints } from "@/lib/win-wall";
import { getWinCertificateTemplate } from "@/lib/win-certificate-template";
import type { WinReactionKind } from "@prisma/client";

export async function loadWinWallData(viewerId: string) {
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const spotlightMonth = currentSpotlightMonth();
  const [monthLabelYear, monthLabelMonth] = spotlightMonth.split("-").map(Number);
  const monthStart = new Date(monthLabelYear!, monthLabelMonth! - 1, 1);

  const [
    recentWins,
    spotlightWin,
    yearWins,
    members,
    certificates,
    reactionAgg,
    certTemplate,
  ] = await Promise.all([
    prisma.win.findMany({
      where: { source: { not: "TRAINING" } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        user: { include: { department: true } },
        reactions: { select: { kind: true, userId: true } },
        certificate: { select: { certNumber: true } },
      },
    }),
    prisma.win.findFirst({
      where: { spotlightMonth },
      include: {
        user: { include: { department: true } },
        reactions: { select: { kind: true, userId: true } },
        certificate: true,
      },
    }),
    prisma.win.findMany({
      where: { createdAt: { gte: yearStart } },
      select: {
        id: true,
        userId: true,
        rewardType: true,
        rewardAmountPaise: true,
        source: true,
        pointsAwarded: true,
        createdAt: true,
      },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE", invitationPending: false },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        title: true,
        department: { select: { name: true } },
      },
    }),
    prisma.winCertificate.findMany({
      orderBy: { issuedAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true, title: true, image: true } },
        issuedBy: { select: { name: true } },
      },
    }),
    prisma.winReaction.groupBy({
      by: ["winId", "kind"],
      _count: { _all: true },
    }),
    getWinCertificateTemplate(),
  ]);

  const winsCelebrated = yearWins.filter((w) => w.source !== "SELF").length;
  const membersRewarded = new Set(
    yearWins.filter((w) => w.rewardType !== "NONE").map((w) => w.userId),
  ).size;
  const cashPaise = yearWins.reduce((sum, w) => sum + (w.rewardAmountPaise ?? 0), 0);
  const certsIssued = await prisma.winCertificate.count({
    where: { issuedAt: { gte: yearStart } },
  });

  const reactionByWin = new Map<string, Partial<Record<WinReactionKind, number>>>();
  for (const row of reactionAgg) {
    const m = reactionByWin.get(row.winId) ?? {};
    m[row.kind] = row._count._all;
    reactionByWin.set(row.winId, m);
  }

  const userPoints = new Map<string, number>();
  for (const w of yearWins) {
    userPoints.set(w.userId, (userPoints.get(w.userId) ?? 0) + w.pointsAwarded);
  }
  for (const w of recentWins) {
    const counts = reactionByWin.get(w.id);
    if (!counts) continue;
    let bonus = 0;
    for (const [kind, n] of Object.entries(counts) as [WinReactionKind, number][]) {
      bonus += n * reactionPoints(kind);
    }
    if (bonus > 0) {
      userPoints.set(w.userId, (userPoints.get(w.userId) ?? 0) + bonus);
    }
  }

  const leaderboardIds = [...userPoints.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  const leaderboardUsers =
    leaderboardIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: leaderboardIds } },
          include: { department: true },
        })
      : [];

  const leaderboard = leaderboardIds
    .map((id, idx) => {
      const u = leaderboardUsers.find((x) => x.id === id);
      if (!u) return null;
      const pts = userPoints.get(id) ?? 0;
      const maxPts = Math.max(userPoints.get(leaderboardIds[0]!) ?? 0, 1);
      return { rank: idx + 1, user: u, points: pts, progress: Math.round((pts / maxPts) * 100) };
    })
    .filter(Boolean) as {
    rank: number;
    user: (typeof leaderboardUsers)[0];
    points: number;
    progress: number;
  }[];

  const historyWins = await prisma.win.findMany({
    where: { createdAt: { gte: yearStart }, source: { not: "TRAINING" } },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      user: { include: { department: true } },
    },
  });

  const latestCert = certificates[0] ?? null;

  return {
    stats: {
      winsCelebrated,
      membersRewarded,
      cashLabel: cashPaise > 0 ? formatInrCompact(cashPaise) : "₹0",
      certsIssued,
    },
    recentWins,
    spotlightWin,
    spotlightMonth,
    monthLabel: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
      monthStart,
    ),
    members,
    certificates,
    latestCert,
    certTemplate,
    leaderboard,
    historyWins,
    viewerId,
    reactionByWin,
  };
}

export type WinWallData = Awaited<ReturnType<typeof loadWinWallData>>;
