import type { CareersGallerySection } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export const CAREERS_LANDING_ID = "singleton";

/** Default dark-wash strength. Lower = brighter group photo. */
export const DEFAULT_HERO_OVERLAY_OPACITY = 40;

export function clampHeroOverlayOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HERO_OVERLAY_OPACITY;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** CSS filter matching overlay strength (0 = natural, 100 = current dim look). */
export function heroImageFilter(overlayOpacity: number): string {
  const t = clampHeroOverlayOpacity(overlayOpacity) / 100;
  const brightness = 1 - t * 0.28;
  return `brightness(${brightness}) contrast(1.04)`;
}

export type CareersLandingView = {
  brandLabel: string;
  heroHeadline: string;
  heroSubcopy: string;
  heroImageUrl: string | null;
  heroOverlayOpacity: number;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  lifeTitle: string;
  lifeBody: string;
  voicesTitle: string;
  voicesBody: string;
  updatedAt: string;
};

export type CareersGalleryImageView = {
  id: string;
  imageUrl: string;
  caption: string | null;
  alt: string;
  section: CareersGallerySection;
  sortOrder: number;
  published: boolean;
};

export type CareersTeamVoiceView = {
  id: string;
  name: string;
  title: string;
  quote: string;
  promptLabel: string | null;
  photoUrl: string | null;
  sortOrder: number;
  published: boolean;
};

export const DEFAULT_CAREERS_LANDING: Omit<CareersLandingView, "updatedAt"> = {
  brandLabel: "Skillinabox",
  heroHeadline: "Build skills. Change lives.",
  heroSubcopy: "Join a team that believes in equitable skilling across India.",
  heroImageUrl: null,
  heroOverlayOpacity: DEFAULT_HERO_OVERLAY_OPACITY,
  primaryCtaLabel: "Join the team",
  primaryCtaHref: "/careers/sign-up",
  secondaryCtaLabel: "See open roles",
  secondaryCtaHref: "/careers/jobs",
  lifeTitle: "Life @ SIB",
  lifeBody: "We work hard, celebrate loudly, and keep learners at the center of everything we ship.",
  voicesTitle: "Notes from the core team",
  voicesBody: "Straight from the people building this — not a press release.",
};

/** Seeded once if the table is empty. Quotes are starter copy — replace with each person's own words. */
export const DEFAULT_CAREERS_TEAM_VOICES: Array<
  Omit<CareersTeamVoiceView, "id" | "photoUrl" | "published">
> = [
  {
    name: "Prateek",
    title: "CEO",
    promptLabel: "Why this, why now",
    sortOrder: 0,
    quote:
      "India isn't short on talent. It's short on doors. We're building those — for the people the usual system never even sees. If that keeps you up at night too, pull up a chair. We'll save you a seat in the messy middle.",
  },
  {
    name: "Kanisk",
    title: "COO",
    promptLabel: "How the days go",
    sortOrder: 1,
    quote:
      "Nobody here has a spectator job. It's cohorts, partners, last-mile, the whole circus. You keep the machine running. Then you make it kinder. Then you make it faster. That's the work — and it's kind of the best part.",
  },
  {
    name: "Ritvik",
    title: "CPO",
    promptLabel: "What you get to make",
    sortOrder: 2,
    quote:
      "We don't ship features to look busy. You sit with learners, throw out what doesn't help, and build the rest. The product's still being invented. That's not a bug. That's the invitation.",
  },
  {
    name: "Kishlay",
    title: "Head of Sales",
    promptLabel: "If this is you",
    sortOrder: 3,
    quote:
      "We're not selling a logo. We're selling someone a way forward. If you'd rather build relationships with a human on the other end than polish a pitch deck — you'll feel at home.",
  },
  {
    name: "Astha",
    title: "Chief of Staff",
    promptLabel: "Life on the core team",
    sortOrder: 4,
    quote:
      "Core team here means you see everything: the people, the pace, the chaos. High trust. Very little hiding. Your job is to make this place actually work for the humans inside it — and yes, that includes you.",
  },
];

/** Previous starter quotes — refresh in place until someone writes their own. */
const LEGACY_STARTER_QUOTES = new Set([
  "We're building skilling that actually reaches people the usual system leaves out. If you want your work to matter at the scale of India — and you're willing to own the messy middle — this is the team.",
  "The work here is real operations: cohorts, partners, delivery, the last mile. You don't sit on the sidelines. You make the machine run, then you make it kinder and faster.",
  "Product at SIB isn't a feature factory. It's sitting with learners, killing what doesn't help them, and shipping what does. You get to shape the product while it's still being invented.",
  "We don't sell a logo. We sell a chance for someone to skill up and move. If you like building relationships that have a human on the other end, you'll feel at home here.",
  "Core team here means you see the whole board — people, pace, priorities. It's high trust, high context, and you get to make the company actually work for the humans inside it.",
]);

function mapLanding(row: {
  brandLabel: string;
  heroHeadline: string;
  heroSubcopy: string;
  heroImageUrl: string | null;
  heroOverlayOpacity?: number | null;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  lifeTitle: string;
  lifeBody: string;
  voicesTitle?: string;
  voicesBody?: string;
  updatedAt: Date;
}): CareersLandingView {
  return {
    brandLabel: row.brandLabel,
    heroHeadline: row.heroHeadline,
    heroSubcopy: row.heroSubcopy,
    heroImageUrl: row.heroImageUrl,
    heroOverlayOpacity: clampHeroOverlayOpacity(row.heroOverlayOpacity ?? DEFAULT_HERO_OVERLAY_OPACITY),
    primaryCtaLabel: row.primaryCtaLabel,
    primaryCtaHref: row.primaryCtaHref,
    secondaryCtaLabel: row.secondaryCtaLabel,
    secondaryCtaHref: row.secondaryCtaHref,
    lifeTitle: row.lifeTitle,
    lifeBody: row.lifeBody,
    voicesTitle: row.voicesTitle || DEFAULT_CAREERS_LANDING.voicesTitle,
    voicesBody: row.voicesBody || DEFAULT_CAREERS_LANDING.voicesBody,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const LEGACY_VOICES_BODY = "Why we showed up — and why we'd do it again.";

/** Ensures the singleton exists, then returns current careers landing copy. */
export async function getCareersLandingContent(): Promise<CareersLandingView> {
  const row = await prisma.careersLandingContent.upsert({
    where: { id: CAREERS_LANDING_ID },
    create: { id: CAREERS_LANDING_ID },
    update: {},
  });
  if (row.voicesBody.trim() === LEGACY_VOICES_BODY) {
    const updated = await prisma.careersLandingContent.update({
      where: { id: CAREERS_LANDING_ID },
      data: { voicesBody: DEFAULT_CAREERS_LANDING.voicesBody },
    });
    return mapLanding(updated);
  }
  return mapLanding(row);
}

export async function listCareersGalleryImages(opts?: {
  publishedOnly?: boolean;
}): Promise<CareersGalleryImageView[]> {
  const publishedOnly = opts?.publishedOnly ?? false;
  const rows = await prisma.careersGalleryImage.findMany({
    where: publishedOnly ? { published: true } : undefined,
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    imageUrl: r.imageUrl,
    caption: r.caption,
    alt: r.alt,
    section: r.section,
    sortOrder: r.sortOrder,
    published: r.published,
  }));
}

function voiceIdentityKey(name: string, title: string): string {
  return `${name.trim().toLowerCase()}|${title.trim().toLowerCase()}`;
}

/** Seed defaults if empty; drop duplicate name+title rows from a raced first insert. */
async function ensureCareersTeamVoices(): Promise<void> {
  const rows = await prisma.careersTeamVoice.findMany({
    select: { id: true, name: true, title: true, quote: true },
    orderBy: [{ createdAt: "asc" }],
  });

  const seen = new Set<string>();
  const extraIds: string[] = [];
  for (const row of rows) {
    const key = voiceIdentityKey(row.name, row.title);
    if (seen.has(key)) extraIds.push(row.id);
    else seen.add(key);
  }
  if (extraIds.length > 0) {
    await prisma.careersTeamVoice.deleteMany({ where: { id: { in: extraIds } } });
  }

  const remaining = rows.filter((row) => !extraIds.includes(row.id));
  if (remaining.length === 0) {
    await prisma.careersTeamVoice.createMany({
      data: DEFAULT_CAREERS_TEAM_VOICES.map((v) => ({
        name: v.name,
        title: v.title,
        quote: v.quote,
        promptLabel: v.promptLabel,
        sortOrder: v.sortOrder,
        published: true,
      })),
    });
    return;
  }

  const nextByKey = new Map(
    DEFAULT_CAREERS_TEAM_VOICES.map((voice) => [voiceIdentityKey(voice.name, voice.title), voice]),
  );
  await Promise.all(
    remaining.map((row) => {
      if (!LEGACY_STARTER_QUOTES.has(row.quote.trim())) return Promise.resolve();
      const next = nextByKey.get(voiceIdentityKey(row.name, row.title));
      if (!next) return Promise.resolve();
      return prisma.careersTeamVoice.update({
        where: { id: row.id },
        data: { quote: next.quote, promptLabel: next.promptLabel },
      });
    }),
  );
}

export async function listCareersTeamVoices(opts?: {
  publishedOnly?: boolean;
}): Promise<CareersTeamVoiceView[]> {
  const publishedOnly = opts?.publishedOnly ?? false;
  await ensureCareersTeamVoices();

  const rows = await prisma.careersTeamVoice.findMany({
    where: publishedOnly ? { published: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title,
    quote: r.quote,
    promptLabel: r.promptLabel,
    photoUrl: r.photoUrl,
    sortOrder: r.sortOrder,
    published: r.published,
  }));
}

export function isSafeInternalHref(href: string): boolean {
  const v = href.trim();
  if (!v.startsWith("/")) return false;
  if (v.startsWith("//")) return false;
  return true;
}
