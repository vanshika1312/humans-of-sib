"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  CAREERS_LANDING_ID,
  DEFAULT_CAREERS_LANDING,
  clampHeroOverlayOpacity,
  getCareersLandingContent,
  isSafeInternalHref,
} from "@/lib/careers-landing";
import { persistTaskAttachmentFile } from "@/lib/task-attachment-upload";

const HR_GATE = ["CEO", "ADMIN", "HR"] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

async function requireHiringHr() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !(HR_GATE as readonly string[]).includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

function revalidateCareersPublic() {
  revalidatePath("/careers");
  revalidatePath("/careers/jobs");
  revalidatePath("/hiring/careers-landing");
}

const landingSchema = z.object({
  brandLabel: z.string().trim().min(1).max(120),
  heroHeadline: z.string().trim().min(1).max(240),
  heroSubcopy: z.string().trim().min(1).max(2000),
  primaryCtaLabel: z.string().trim().min(1).max(80),
  primaryCtaHref: z.string().trim().min(1).max(500),
  secondaryCtaLabel: z.string().trim().min(1).max(80),
  secondaryCtaHref: z.string().trim().min(1).max(500),
  lifeTitle: z.string().trim().min(1).max(160),
  lifeBody: z.string().trim().min(1).max(4000),
  voicesTitle: z.string().trim().min(1).max(160),
  voicesBody: z.string().trim().min(1).max(4000),
  heroImageUrl: z.string().trim().max(2048).optional(),
  heroOverlayOpacity: z.number().int().min(0).max(100),
  removeHeroImage: z.boolean().optional(),
});

const galleryCreateSchema = z.object({
  imageUrl: z.string().trim().min(1).max(2048),
  section: z.enum(["LIFE", "CULTURE"]),
  caption: z.string().trim().max(240).optional(),
  alt: z.string().trim().max(240).optional(),
  sortOrder: z.number().int().min(0).max(999),
});

const voiceUpsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  quote: z.string().trim().max(2000).optional(),
  promptLabel: z.string().trim().max(80).optional(),
  photoUrl: z.string().trim().max(2048).optional(),
  sortOrder: z.number().int().min(0).max(999),
  published: z.boolean().optional(),
});

export type CareersLandingSaveResult = { ok: true; saved?: true } | { ok: false; error: string };
export type CareersGalleryActionResult = { ok: true } | { ok: false; error: string };
export type CareersImageUploadResult = { ok: true; url: string } | { ok: false; error: string };

/** Base64 string (not a File) so we avoid multipart parse failures in Server Actions / route handlers. */
export async function uploadCareersLandingImage(input: {
  fileBase64: string;
  fileName: string;
  mimeType: string;
}): Promise<CareersImageUploadResult> {
  await requireHiringHr();

  const fileName = (input.fileName || "upload.bin").trim().slice(0, 280) || "upload.bin";
  const lowerName = fileName.toLowerCase();
  let mimeType = (input.mimeType || "").trim().toLowerCase();
  if (mimeType === "image/jpg") mimeType = "image/jpeg";
  if (!IMAGE_MIMES.has(mimeType)) {
    if (lowerName.endsWith(".png")) mimeType = "image/png";
    else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) mimeType = "image/jpeg";
    else if (lowerName.endsWith(".webp")) mimeType = "image/webp";
    else if (lowerName.endsWith(".gif")) mimeType = "image/gif";
  }
  if (mimeType === "image/jpg") mimeType = "image/jpeg";

  const rawBase64 = (input.fileBase64 || "").trim();
  if (!rawBase64) return { ok: false, error: "Choose an image to upload." };
  if (!IMAGE_MIMES.has(mimeType)) {
    return { ok: false, error: "Use a PNG, JPG, JPEG, WebP, or GIF image." };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(rawBase64, "base64");
  } catch {
    return { ok: false, error: "Could not decode image data." };
  }
  if (buf.length <= 0) return { ok: false, error: "Choose an image to upload." };
  if (buf.length > MAX_IMAGE_BYTES) return { ok: false, error: "Image is too large (max 5 MB)." };

  const file = new File([buf], fileName, { type: mimeType });
  const uploaded = await persistTaskAttachmentFile(file);
  if (!uploaded.ok) {
    const error =
      uploaded.code === "STORAGE"
        ? "Could not save image — check storage configuration (R2 or Vercel Blob)."
        : uploaded.code === "TOO_LARGE"
          ? "Image is too large."
          : "Unsupported image type.";
    return { ok: false, error };
  }
  return { ok: true, url: uploaded.url };
}

function normalizeHref(raw: string): string | null {
  const v = raw.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) {
    try {
      // eslint-disable-next-line no-new
      new URL(v);
      return v;
    } catch {
      return null;
    }
  }
  if (!isSafeInternalHref(v)) return null;
  return v;
}

function isAllowedImageUrl(url: string): boolean {
  const v = url.trim();
  if (v.startsWith("/task-uploads/") || v.startsWith("/hiring-uploads/")) return true;
  if (v.startsWith("http://") || v.startsWith("https://")) {
    try {
      // eslint-disable-next-line no-new
      new URL(v);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function saveCareersLandingContent(input: {
  brandLabel: string;
  heroHeadline: string;
  heroSubcopy: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  lifeTitle: string;
  lifeBody: string;
  voicesTitle: string;
  voicesBody: string;
  heroImageUrl?: string | null;
  heroOverlayOpacity: number;
  removeHeroImage?: boolean;
}): Promise<CareersLandingSaveResult> {
  const me = await requireHiringHr();

  const parsed = landingSchema.safeParse({
    ...input,
    heroOverlayOpacity: clampHeroOverlayOpacity(input.heroOverlayOpacity),
    heroImageUrl: input.heroImageUrl ?? undefined,
    removeHeroImage: input.removeHeroImage ?? false,
  });
  if (!parsed.success) {
    return { ok: false, error: "Please check all landing fields." };
  }

  const primaryCtaHref = normalizeHref(parsed.data.primaryCtaHref);
  const secondaryCtaHref = normalizeHref(parsed.data.secondaryCtaHref);
  if (!primaryCtaHref || !secondaryCtaHref) {
    return { ok: false, error: "CTA links must be internal paths (e.g. /careers/jobs) or https URLs." };
  }

  const existing = await getCareersLandingContent();
  let heroImageUrl = existing.heroImageUrl;

  if (parsed.data.removeHeroImage) {
    heroImageUrl = null;
  } else if (parsed.data.heroImageUrl) {
    if (!isAllowedImageUrl(parsed.data.heroImageUrl)) {
      return { ok: false, error: "Invalid hero image URL." };
    }
    heroImageUrl = parsed.data.heroImageUrl;
  }

  await prisma.careersLandingContent.upsert({
    where: { id: CAREERS_LANDING_ID },
    create: {
      id: CAREERS_LANDING_ID,
      ...DEFAULT_CAREERS_LANDING,
      brandLabel: parsed.data.brandLabel,
      heroHeadline: parsed.data.heroHeadline,
      heroSubcopy: parsed.data.heroSubcopy,
      primaryCtaLabel: parsed.data.primaryCtaLabel,
      secondaryCtaLabel: parsed.data.secondaryCtaLabel,
      lifeTitle: parsed.data.lifeTitle,
      lifeBody: parsed.data.lifeBody,
      voicesTitle: parsed.data.voicesTitle,
      voicesBody: parsed.data.voicesBody,
      primaryCtaHref,
      secondaryCtaHref,
      heroImageUrl,
      heroOverlayOpacity: parsed.data.heroOverlayOpacity,
      updatedById: me.id,
    },
    update: {
      brandLabel: parsed.data.brandLabel,
      heroHeadline: parsed.data.heroHeadline,
      heroSubcopy: parsed.data.heroSubcopy,
      primaryCtaLabel: parsed.data.primaryCtaLabel,
      secondaryCtaLabel: parsed.data.secondaryCtaLabel,
      lifeTitle: parsed.data.lifeTitle,
      lifeBody: parsed.data.lifeBody,
      voicesTitle: parsed.data.voicesTitle,
      voicesBody: parsed.data.voicesBody,
      primaryCtaHref,
      secondaryCtaHref,
      heroImageUrl,
      heroOverlayOpacity: parsed.data.heroOverlayOpacity,
      updatedById: me.id,
    },
  });

  revalidateCareersPublic();
  return { ok: true, saved: true };
}

export async function addCareersGalleryImage(input: {
  imageUrl: string;
  section: "LIFE" | "CULTURE";
  caption?: string;
  alt?: string;
  sortOrder: number;
}): Promise<CareersGalleryActionResult> {
  await requireHiringHr();

  const parsed = galleryCreateSchema.safeParse({
    ...input,
    caption: input.caption?.trim() || undefined,
    alt: input.alt?.trim() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Please check the gallery fields." };
  }
  if (!isAllowedImageUrl(parsed.data.imageUrl)) {
    return { ok: false, error: "Invalid image URL." };
  }

  await prisma.careersGalleryImage.create({
    data: {
      imageUrl: parsed.data.imageUrl,
      caption: parsed.data.caption ?? null,
      alt: parsed.data.alt || parsed.data.caption || "Skillinabox team",
      section: parsed.data.section,
      sortOrder: parsed.data.sortOrder,
      published: true,
    },
  });

  revalidateCareersPublic();
  return { ok: true };
}

export async function updateCareersGalleryImage(input: {
  id: string;
  section: "LIFE" | "CULTURE";
  caption?: string;
  alt?: string;
  sortOrder: number;
  published: boolean;
}): Promise<CareersGalleryActionResult> {
  await requireHiringHr();

  const id = input.id.trim();
  if (!id) return { ok: false, error: "Missing image id." };

  const caption = (input.caption ?? "").trim().slice(0, 240) || null;
  const alt = (input.alt ?? "").trim().slice(0, 240);
  const sortOrder = Number.isFinite(input.sortOrder)
    ? Math.max(0, Math.min(999, Math.floor(input.sortOrder)))
    : 0;

  await prisma.careersGalleryImage.update({
    where: { id },
    data: {
      caption,
      alt: alt || caption || "Skillinabox team",
      section: input.section === "CULTURE" ? "CULTURE" : "LIFE",
      sortOrder,
      published: Boolean(input.published),
    },
  });

  revalidateCareersPublic();
  return { ok: true };
}

export async function deleteCareersGalleryImage(id: string): Promise<CareersGalleryActionResult> {
  await requireHiringHr();
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "Missing image id." };
  await prisma.careersGalleryImage.delete({ where: { id: trimmed } }).catch(() => null);
  revalidateCareersPublic();
  return { ok: true };
}

export async function addCareersTeamVoice(input: {
  name: string;
  title: string;
  quote?: string;
  promptLabel?: string;
  photoUrl?: string;
  sortOrder: number;
}): Promise<CareersGalleryActionResult> {
  await requireHiringHr();

  const parsed = voiceUpsertSchema.safeParse({
    ...input,
    quote: input.quote?.trim() || undefined,
    promptLabel: input.promptLabel?.trim() || undefined,
    photoUrl: input.photoUrl?.trim() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Please check the team note fields." };
  }
  if (parsed.data.photoUrl && !isAllowedImageUrl(parsed.data.photoUrl)) {
    return { ok: false, error: "Invalid photo URL." };
  }

  await prisma.careersTeamVoice.create({
    data: {
      name: parsed.data.name,
      title: parsed.data.title,
      quote: parsed.data.quote ?? "",
      promptLabel: parsed.data.promptLabel ?? null,
      photoUrl: parsed.data.photoUrl ?? null,
      sortOrder: parsed.data.sortOrder,
      published: true,
    },
  });

  revalidateCareersPublic();
  return { ok: true };
}

export async function updateCareersTeamVoice(input: {
  id: string;
  name: string;
  title: string;
  quote?: string;
  promptLabel?: string;
  photoUrl?: string | null;
  sortOrder: number;
  published: boolean;
  removePhoto?: boolean;
}): Promise<CareersGalleryActionResult> {
  await requireHiringHr();

  const id = input.id.trim();
  if (!id) return { ok: false, error: "Missing note id." };

  const parsed = voiceUpsertSchema.safeParse({
    name: input.name,
    title: input.title,
    quote: input.quote?.trim() || undefined,
    promptLabel: input.promptLabel?.trim() || undefined,
    photoUrl: input.photoUrl?.trim() || undefined,
    sortOrder: input.sortOrder,
    published: input.published,
  });
  if (!parsed.success) {
    return { ok: false, error: "Please check the team note fields." };
  }
  if (parsed.data.photoUrl && !isAllowedImageUrl(parsed.data.photoUrl)) {
    return { ok: false, error: "Invalid photo URL." };
  }

  const existing = await prisma.careersTeamVoice.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That note was not found." };

  let photoUrl = existing.photoUrl;
  if (input.removePhoto) {
    photoUrl = null;
  } else if (parsed.data.photoUrl) {
    photoUrl = parsed.data.photoUrl;
  }

  await prisma.careersTeamVoice.update({
    where: { id },
    data: {
      name: parsed.data.name,
      title: parsed.data.title,
      quote: parsed.data.quote ?? "",
      promptLabel: parsed.data.promptLabel ?? null,
      photoUrl,
      sortOrder: parsed.data.sortOrder,
      published: Boolean(input.published),
    },
  });

  revalidateCareersPublic();
  return { ok: true };
}

export async function deleteCareersTeamVoice(id: string): Promise<CareersGalleryActionResult> {
  await requireHiringHr();
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "Missing note id." };
  await prisma.careersTeamVoice.delete({ where: { id: trimmed } }).catch(() => null);
  revalidateCareersPublic();
  return { ok: true };
}
