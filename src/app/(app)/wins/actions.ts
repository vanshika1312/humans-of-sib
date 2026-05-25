"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { WinCategory, WinReactionKind, WinRewardType, WinSource } from "@prisma/client";
import { canAwardWins } from "@/lib/win-wall-access";
import {
  buildRewardLabel,
  currentSpotlightMonth,
  nextWinCertNumber,
  parseRewardAmountToPaise,
  pointsForCelebration,
} from "@/lib/win-wall";
import { sendWinCertificateEmail } from "@/lib/email";
import {
  DEFAULT_WIN_CERT_TEMPLATE,
  getWinCertificateTemplate,
  WIN_CERT_TEMPLATE_ID,
} from "@/lib/win-certificate-template";
import { persistTaskAttachmentFile } from "@/lib/task-attachment-upload";

const categoryEnum = z.enum(["LEARNING", "OPERATIONS", "SALES", "INNOVATION"]);
const rewardEnum = z.enum(["CASH", "CERTIFICATE", "CASH_AND_CERTIFICATE", "VOUCHER", "SHOUTOUT", "NONE"]);

const celebrateSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  category: categoryEnum,
  rewardType: rewardEnum,
  rewardAmount: z.string().optional(),
  rewardLabel: z.string().max(120).optional(),
  setSpotlight: z.string().optional(),
});

const nominateSchema = celebrateSchema.omit({ setSpotlight: true });

const certSchema = z.object({
  userId: z.string().min(1),
  achievement: z.string().min(5).max(500),
  linkWinId: z.string().optional(),
});

const selfWinSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  tags: z.string().max(200).optional(),
});

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");
  return user;
}

function revalidateWins() {
  revalidatePath("/wins");
  revalidatePath("/home");
  revalidatePath("/journey");
}

export async function createWin(formData: FormData) {
  const user = await requireUser();
  const parsed = selfWinSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    tags: formData.get("tags") || undefined,
  });

  const tags = parsed.tags
    ? parsed.tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 6)
    : [];

  await prisma.$transaction([
    prisma.win.create({
      data: {
        userId: user.id,
        title: parsed.title,
        description: parsed.description,
        tags,
        source: "SELF",
        pointsAwarded: 80,
      },
    }),
    prisma.journeyEvent.create({
      data: {
        userId: user.id,
        type: "WIN",
        title: parsed.title,
        description: parsed.description,
        emoji: "🏆",
      },
    }),
  ]);

  revalidateWins();
}

export async function celebrateWin(formData: FormData) {
  const actor = await requireUser();
  if (!canAwardWins(actor.role)) throw new Error("Not allowed to celebrate wins");

  const parsed = celebrateSchema.parse({
    userId: formData.get("userId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category"),
    rewardType: formData.get("rewardType") || "NONE",
    rewardAmount: formData.get("rewardAmount") || undefined,
    rewardLabel: formData.get("rewardLabel") || undefined,
    setSpotlight: formData.get("setSpotlight") || undefined,
  });

  const rewardType = parsed.rewardType as WinRewardType;
  const amountPaise = parseRewardAmountToPaise(parsed.rewardAmount);
  const rewardLabel = buildRewardLabel(rewardType, amountPaise, parsed.rewardLabel);
  const spotlightMonth =
    parsed.setSpotlight === "on" ? currentSpotlightMonth() : undefined;

  if (spotlightMonth) {
    await prisma.win.updateMany({
      where: { spotlightMonth },
      data: { spotlightMonth: null },
    });
  }

  const win = await prisma.win.create({
    data: {
      userId: parsed.userId,
      celebratedById: actor.id,
      title: parsed.title,
      description: parsed.description,
      category: parsed.category as WinCategory,
      rewardType,
      rewardAmountPaise: amountPaise,
      rewardLabel,
      source: "CELEBRATION",
      pointsAwarded: pointsForCelebration(rewardType),
      spotlightMonth,
    },
  });

  if (rewardType === "CERTIFICATE" || rewardType === "CASH_AND_CERTIFICATE") {
    const certNumber = await nextWinCertNumber();
    await prisma.winCertificate.create({
      data: {
        userId: parsed.userId,
        issuedById: actor.id,
        winId: win.id,
        achievement: parsed.title,
        certNumber,
      },
    });
  }

  await prisma.journeyEvent.create({
    data: {
      userId: parsed.userId,
      type: "WIN",
      title: parsed.title,
      description: parsed.description,
      emoji: "🏆",
    },
  });

  revalidateWins();
}

export async function nominateWin(formData: FormData) {
  const actor = await requireUser();
  const parsed = nominateSchema.parse({
    userId: formData.get("userId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category"),
    rewardType: formData.get("rewardType") || "NONE",
    rewardAmount: formData.get("rewardAmount") || undefined,
    rewardLabel: formData.get("rewardLabel") || undefined,
  });

  const rewardType = parsed.rewardType as WinRewardType;
  const amountPaise = parseRewardAmountToPaise(parsed.rewardAmount);
  const rewardLabel = buildRewardLabel(rewardType, amountPaise, parsed.rewardLabel);

  await prisma.win.create({
    data: {
      userId: parsed.userId,
      celebratedById: actor.id,
      title: parsed.title,
      description: parsed.description,
      category: parsed.category as WinCategory,
      rewardType,
      rewardAmountPaise: amountPaise,
      rewardLabel,
      source: "NOMINATION",
      pointsAwarded: pointsForCelebration(rewardType) - 50,
    },
  });

  revalidateWins();
}

export async function issueCertificate(formData: FormData) {
  const actor = await requireUser();
  if (!canAwardWins(actor.role)) throw new Error("Not allowed to issue certificates");

  const parsed = certSchema.parse({
    userId: formData.get("userId"),
    achievement: formData.get("achievement"),
    linkWinId: formData.get("linkWinId") || undefined,
  });

  const certNumber = await nextWinCertNumber();
  await prisma.winCertificate.create({
    data: {
      userId: parsed.userId,
      issuedById: actor.id,
      winId: parsed.linkWinId || null,
      achievement: parsed.achievement,
      certNumber,
    },
  });

  revalidateWins();
}

export async function toggleReaction(winId: string, kind: WinReactionKind) {
  const user = await requireUser();

  const existing = await prisma.winReaction.findUnique({
    where: { winId_userId_kind: { winId, userId: user.id, kind } },
  });

  if (existing) {
    await prisma.winReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.winReaction.create({ data: { winId, userId: user.id, kind } });
  }
  revalidateWins();
}

/** @deprecated Use toggleReaction(winId, "CLAP") */
export async function toggleClap(winId: string) {
  return toggleReaction(winId, "CLAP");
}

const templateSchema = z.object({
  title: z.string().min(2).max(120),
  subtitle: z.string().min(2).max(160),
  introText: z.string().min(5).max(300),
  recognitionPrefix: z.string().min(2).max(120),
  signatoryName: z.string().min(2).max(120),
  signatoryTitle: z.string().min(2).max(120),
});

const MAX_CERT_BG_BYTES = 5 * 1024 * 1024;
const CERT_BG_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type WinCertTemplateSaveResult =
  | { ok: true; saved?: boolean }
  | { ok: false; error: string };

export async function saveWinCertificateTemplate(
  _prev: WinCertTemplateSaveResult,
  formData: FormData,
): Promise<WinCertTemplateSaveResult> {
  const actor = await requireUser();
  if (!canAwardWins(actor.role)) {
    return { ok: false, error: "Only managers and HR can customize the certificate template." };
  }

  const parsed = templateSchema.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle"),
    introText: formData.get("introText"),
    recognitionPrefix: formData.get("recognitionPrefix"),
    signatoryName: formData.get("signatoryName"),
    signatoryTitle: formData.get("signatoryTitle"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Please check all template fields." };
  }

  const existing = await getWinCertificateTemplate();
  let backgroundImageUrl = existing.backgroundImageUrl;

  const removeBg = formData.get("removeBackground") === "on";
  const file = formData.get("background");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CERT_BG_BYTES) {
      return { ok: false, error: "Background image is too large (max 5 MB)." };
    }
    const mime = (file.type || "").toLowerCase();
    if (!CERT_BG_MIMES.has(mime)) {
      return { ok: false, error: "Use a PNG, JPEG, WebP, or GIF image." };
    }
    const uploaded = await persistTaskAttachmentFile(file);
    if (!uploaded.ok) {
      const msg =
        uploaded.code === "STORAGE"
          ? "Could not save image — check storage configuration (R2 or Vercel Blob)."
          : uploaded.code === "TOO_LARGE"
            ? "Background image is too large."
            : "Unsupported image type.";
      return { ok: false, error: msg };
    }
    backgroundImageUrl = uploaded.url;
  } else if (removeBg) {
    backgroundImageUrl = null;
  }

  await prisma.winCertificateTemplate.upsert({
    where: { id: WIN_CERT_TEMPLATE_ID },
    create: {
      id: WIN_CERT_TEMPLATE_ID,
      ...DEFAULT_WIN_CERT_TEMPLATE,
      ...parsed.data,
      backgroundImageUrl,
    },
    update: { ...parsed.data, backgroundImageUrl },
  });

  revalidateWins();
  return { ok: true, saved: true };
}

export type WinCertActionResult =
  | { ok: true; message?: string; alreadyShared?: boolean }
  | { ok: false; error: string };

async function loadCertForAction(certId: string) {
  return prisma.winCertificate.findUnique({
    where: { id: certId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      win: { select: { id: true } },
    },
  });
}

export async function emailWinCertificate(
  _prev: WinCertActionResult,
  formData: FormData,
): Promise<WinCertActionResult> {
  const actor = await requireUser();
  if (!canAwardWins(actor.role)) {
    return { ok: false, error: "Only managers and HR can email certificates." };
  }

  const certId = String(formData.get("certId") ?? "").trim();
  if (!certId) return { ok: false, error: "No certificate selected." };

  const cert = await loadCertForAction(certId);
  if (!cert) return { ok: false, error: "Certificate not found." };
  if (!cert.user.email) {
    return { ok: false, error: "Recipient has no email on file." };
  }

  const issuedLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(cert.issuedAt);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://humansofsib.com").replace(/\/$/, "");

  try {
    await sendWinCertificateEmail({
      to: cert.user.email,
      recipientName: cert.user.name ?? "Team member",
      achievement: cert.achievement,
      certNumber: cert.certNumber,
      issuedLabel,
      viewUrl: `${baseUrl}/wins?tab=certificates`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not send email.";
    if (msg.includes("RESEND_API_KEY") || msg.includes("BREVO_API_KEY")) {
      return {
        ok: false,
        error: "Email is not configured (check RESEND / BREVO API keys).",
      };
    }
    console.error("[Humans of SIB] win certificate email failed", err);
    return { ok: false, error: "Could not send email. Try again later." };
  }

  return { ok: true, message: `Certificate emailed to ${cert.user.email}.` };
}

export async function shareWinCertificateOnWall(
  _prev: WinCertActionResult,
  formData: FormData,
): Promise<WinCertActionResult> {
  const actor = await requireUser();
  if (!canAwardWins(actor.role)) {
    return { ok: false, error: "Only managers and HR can share certificates on the wall." };
  }

  const certId = String(formData.get("certId") ?? "").trim();
  if (!certId) return { ok: false, error: "No certificate selected." };

  const cert = await loadCertForAction(certId);
  if (!cert) return { ok: false, error: "Certificate not found." };

  if (cert.winId) {
    return {
      ok: true,
      alreadyShared: true,
      message: "This certificate is already on the win wall.",
    };
  }

  const title =
    cert.achievement.length > 200 ? `${cert.achievement.slice(0, 197)}…` : cert.achievement;

  await prisma.$transaction(async (tx) => {
    const created = await tx.win.create({
      data: {
        userId: cert.userId,
        celebratedById: actor.id,
        title,
        description: cert.achievement,
        category: "OPERATIONS",
        rewardType: "CERTIFICATE",
        rewardLabel: buildRewardLabel("CERTIFICATE"),
        source: "CELEBRATION",
        pointsAwarded: pointsForCelebration("CERTIFICATE"),
      },
    });
    await tx.winCertificate.update({
      where: { id: certId },
      data: { winId: created.id },
    });
    await tx.journeyEvent.create({
      data: {
        userId: cert.userId,
        type: "WIN",
        title,
        description: cert.achievement,
        emoji: "🏆",
      },
    });
  });

  revalidateWins();
  return { ok: true, message: "Certificate shared on the win wall." };
}
