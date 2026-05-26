import type { WinCategory, WinRewardType } from "@prisma/client";

export const WIN_CATEGORY_LABEL: Record<WinCategory, string> = {
  LEARNING: "Learning",
  OPERATIONS: "Operations",
  SALES: "Sales",
  INNOVATION: "Innovation",
};

export const WIN_CATEGORY_TONE: Record<WinCategory, string> = {
  LEARNING: "bg-emerald-50 text-emerald-800 border-emerald-200",
  OPERATIONS: "bg-violet-50 text-violet-800 border-violet-200",
  SALES: "bg-sky-50 text-sky-800 border-sky-200",
  INNOVATION: "bg-amber-50 text-amber-900 border-amber-200",
};

export const REWARD_TYPE_LABEL: Record<WinRewardType, string> = {
  NONE: "Recognition",
  CASH: "Cash reward",
  CERTIFICATE: "Certificate",
  CASH_AND_CERTIFICATE: "Cash + Certificate",
  VOUCHER: "Gift voucher",
  SHOUTOUT: "Public shoutout",
};

const AVATAR_TONES = [
  "from-orange-300 to-orange-500",
  "from-sky-300 to-sky-500",
  "from-violet-300 to-violet-500",
  "from-pink-300 to-pink-500",
  "from-emerald-300 to-emerald-500",
];

export function avatarGradientForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  return AVATAR_TONES[hash]!;
}

export function formatInrCompact(paise: number) {
  const rupees = paise / 100;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)}L`;
  if (rupees >= 1_000) return `₹${Math.round(rupees / 1_000)}K`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

export function formatRewardLabel(opts: {
  rewardType: WinRewardType;
  rewardLabel?: string | null;
  rewardAmountPaise?: number | null;
}) {
  if (opts.rewardLabel?.trim()) return opts.rewardLabel.trim();
  if (opts.rewardAmountPaise && opts.rewardAmountPaise > 0) {
    const amt = formatInrCompact(opts.rewardAmountPaise);
    if (opts.rewardType === "CASH_AND_CERTIFICATE") return `Cert + ${amt}`;
    if (opts.rewardType === "CASH") return `${amt} cash`;
    if (opts.rewardType === "VOUCHER") return `${amt} voucher`;
  }
  return REWARD_TYPE_LABEL[opts.rewardType];
}

/** Cash, voucher, or certificate wins that should stand out on the home feed. */
export function isFeedHighlightReward(rewardType: WinRewardType) {
  return (
    rewardType === "CASH" ||
    rewardType === "CERTIFICATE" ||
    rewardType === "CASH_AND_CERTIFICATE" ||
    rewardType === "VOUCHER"
  );
}

export function rewardBadgeTone(rewardType: WinRewardType) {
  switch (rewardType) {
    case "CASH":
      return "bg-emerald-50 text-emerald-800";
    case "CERTIFICATE":
    case "CASH_AND_CERTIFICATE":
      return "bg-violet-50 text-violet-800";
    case "VOUCHER":
      return "bg-orange-50 text-orange-800";
    case "SHOUTOUT":
      return "bg-sky-50 text-sky-800";
    default:
      return "bg-ink-100 text-ink-600";
  }
}

export function pointsForCelebration(rewardType: WinRewardType) {
  switch (rewardType) {
    case "CASH_AND_CERTIFICATE":
      return 450;
    case "CASH":
      return 350;
    case "CERTIFICATE":
      return 300;
    case "VOUCHER":
      return 200;
    case "SHOUTOUT":
      return 150;
    default:
      return 200;
  }
}

export function reactionPoints(kind: "CLAP" | "FIRE" | "YAY") {
  switch (kind) {
    case "FIRE":
      return 8;
    case "CLAP":
      return 5;
    case "YAY":
      return 5;
  }
}

export function currentSpotlightMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthYearLabel(spotlightMonth: string) {
  const [y, m] = spotlightMonth.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date);
}

export async function nextWinCertNumber() {
  const year = new Date().getFullYear();
  const prefix = `HOS-WIN-${year}-`;
  const { prisma } = await import("@/lib/prisma");
  const latest = await prisma.winCertificate.findFirst({
    where: { certNumber: { startsWith: prefix } },
    orderBy: { certNumber: "desc" },
    select: { certNumber: true },
  });
  const lastSeq = latest ? parseInt(latest.certNumber.slice(prefix.length), 10) : 0;
  const seq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export function parseRewardAmountToPaise(raw: string | null | undefined) {
  if (!raw?.trim()) return undefined;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 100);
}

export function buildRewardLabel(
  rewardType: WinRewardType,
  amountPaise?: number,
  customLabel?: string,
) {
  if (customLabel?.trim()) return customLabel.trim();
  if (!amountPaise) {
    if (rewardType === "SHOUTOUT") return "Company shoutout";
    if (rewardType === "CERTIFICATE") return "Certificate issued";
    return undefined;
  }
  const amt = formatInrCompact(amountPaise);
  switch (rewardType) {
    case "CASH":
      return `${amt} cash reward`;
    case "VOUCHER":
      return `${amt} voucher`;
    case "CASH_AND_CERTIFICATE":
      return `Cert + ${amt}`;
    case "CERTIFICATE":
      return `Certificate + ${amt}`;
    default:
      return amt;
  }
}
