import type { Role } from "@prisma/client";

const AWARD_ROLES: Role[] = ["MANAGER", "DEPT_HEAD", "HR", "CEO", "ADMIN"];

export function canAwardWins(role: Role) {
  return AWARD_ROLES.includes(role);
}

export type WinWallTab = "wall" | "leaderboard" | "certificates" | "nominate" | "history";

export const WIN_WALL_TABS: { id: WinWallTab; label: string; emoji: string }[] = [
  { id: "wall", label: "Win wall", emoji: "🥇" },
  { id: "leaderboard", label: "Leaderboard", emoji: "📊" },
  { id: "certificates", label: "Certificates", emoji: "📜" },
  { id: "nominate", label: "Nominate", emoji: "✍️" },
  { id: "history", label: "History", emoji: "📋" },
];

export function parseWinWallTab(tab?: string): WinWallTab {
  if (tab && WIN_WALL_TABS.some((t) => t.id === tab)) return tab as WinWallTab;
  return "wall";
}
