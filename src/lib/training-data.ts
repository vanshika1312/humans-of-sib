import { prisma } from "@/lib/prisma";

export function resolveTrainingContentUrl(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${u.startsWith("/") ? u : `/${u}`}`;
}

export async function loadTrainingLeaderboard(year: number) {
  const yearStart = new Date(year, 0, 1);

  const wins = await prisma.win.findMany({
    where: {
      source: "TRAINING",
      createdAt: { gte: yearStart },
    },
    select: {
      userId: true,
      pointsAwarded: true,
    },
  });

  const userPoints = new Map<string, number>();
  for (const w of wins) {
    userPoints.set(w.userId, (userPoints.get(w.userId) ?? 0) + w.pointsAwarded);
  }

  const topIds = [...userPoints.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  if (topIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: topIds } },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      image: true,
      department: { select: { name: true } },
    },
  });

  return topIds
    .map((id, idx) => {
      const user = users.find((u) => u.id === id);
      if (!user) return null;
      const points = userPoints.get(id) ?? 0;
      const maxPts = userPoints.get(topIds[0]!) ?? 1;
      return {
        rank: idx + 1,
        user,
        points,
        progress: Math.round((points / Math.max(maxPts, 1)) * 100),
      };
    })
    .filter(Boolean) as {
    rank: number;
    user: (typeof users)[0];
    points: number;
    progress: number;
  }[];
}
