"use client";

import Link from "next/link";
import type { CareersGalleryImageView, CareersLandingView, CareersTeamVoiceView } from "@/lib/careers-landing";
import { clampHeroOverlayOpacity, heroImageFilter } from "@/lib/careers-landing";
import { cn } from "@/lib/utils";

/** Dark wash over the hero photo. Opacity 0–100 from the careers landing editor. */
export function CareersHeroDarkWash({ opacity }: { opacity: number }) {
  const t = clampHeroOverlayOpacity(opacity) / 100;
  return (
    <>
      <div className="absolute inset-0 bg-black/30" style={{ opacity: t }} aria-hidden />
      <div
        className="absolute inset-0 bg-gradient-to-tr from-black/80 via-black/45 to-black/10"
        style={{ opacity: t }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
        style={{ opacity: t }}
        aria-hidden
      />
    </>
  );
}

function CtaLink({
  href,
  children,
  variant,
}: {
  href: string;
  children: React.ReactNode;
  variant: "primary" | "secondary" | "primaryLight" | "secondaryLight";
}) {
  const className =
    variant === "primary"
      ? "inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-orange-500 text-white text-sm font-semibold shadow-[0_10px_28px_-10px_rgba(242,101,34,0.85)] hover:bg-orange-600 transition-colors"
      : variant === "secondary"
        ? "inline-flex items-center justify-center h-12 px-7 rounded-full border border-white/70 bg-white/95 text-ink-800 text-sm font-semibold shadow-sm backdrop-blur-sm hover:bg-white transition-colors"
        : variant === "primaryLight"
          ? "inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-white text-ink-900 text-sm font-semibold shadow-sm hover:bg-ink-50 transition-colors"
          : "inline-flex items-center justify-center h-12 px-7 rounded-full border border-white/50 bg-white/10 text-white text-sm font-semibold backdrop-blur-sm hover:bg-white/20 transition-colors";

  if (href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

const CULTURE_TILTS = ["-rotate-2", "rotate-1", "rotate-2", "-rotate-1", "rotate-[1.5deg]"];

function padItems<T>(items: T[], min: number): T[] {
  if (items.length === 0) return [];
  const out = [...items];
  while (out.length < min) out.push(...items);
  return out;
}

function buildLifeMarqueeRows(images: CareersGalleryImageView[]): {
  row1: CareersGalleryImageView[];
  row2: CareersGalleryImageView[];
} {
  const photos = padItems(
    images.filter((image) => Boolean(image?.imageUrl)),
    6,
  );
  const row1: CareersGalleryImageView[] = [];
  const row2: CareersGalleryImageView[] = [];

  photos.forEach((image, i) => {
    (i % 2 === 0 ? row1 : row2).push(image);
  });

  return { row1: padItems(row1, 8), row2: padItems(row2, 8) };
}

export function CareersLandingHero({ content }: { content: CareersLandingView }) {
  return (
    <section className="relative min-h-[100svh] flex items-end overflow-hidden">
      <div className="absolute inset-0 brand-gradient" aria-hidden />
      {content.heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={content.heroImageUrl}
          alt=""
          className="absolute inset-0 size-full object-cover animate-[careers-hero-in_1.1s_ease-out]"
          style={{ filter: heroImageFilter(content.heroOverlayOpacity) }}
        />
      ) : null}
      <CareersHeroDarkWash opacity={content.heroOverlayOpacity} />

      <div className="pointer-events-none absolute -left-24 top-24 size-72 rounded-full bg-sky-500/25 blur-3xl animate-[careers-orb_12s_ease-in-out_infinite]" aria-hidden />
      <div className="pointer-events-none absolute right-0 top-1/3 size-80 rounded-full bg-orange-500/20 blur-3xl animate-[careers-orb_16s_ease-in-out_infinite_reverse]" aria-hidden />
      <div className="pointer-events-none absolute bottom-10 left-1/3 size-48 rounded-full bg-sun-500/20 blur-3xl" aria-hidden />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-8 pb-20 md:pb-28 pt-28">
        <div className="max-w-2xl animate-[careers-fade-up_0.7s_ease-out]">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] md:text-xs font-semibold tracking-[0.2em] uppercase text-white">
            <span className="size-1.5 rounded-full bg-sun-500" aria-hidden />
            {content.brandLabel}
          </p>
          <h1 className="mt-5 text-4xl sm:text-5xl md:text-[3.5rem] font-extrabold tracking-tight text-white leading-[1.05] [text-shadow:0_2px_24px_rgba(0,0,0,0.45)]">
            {content.heroHeadline}
          </h1>
          <span className="mt-5 block h-1.5 w-16 rounded-full bg-gradient-to-r from-orange-500 to-sun-500" aria-hidden />
          <p className="mt-5 max-w-xl text-base md:text-lg text-white/95 leading-relaxed [text-shadow:0_1px_16px_rgba(0,0,0,0.5)]">
            {content.heroSubcopy}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <CtaLink href={content.primaryCtaHref} variant="primary">
              {content.primaryCtaLabel}
              <span aria-hidden>→</span>
            </CtaLink>
            <CtaLink href={content.secondaryCtaHref} variant="secondary">
              {content.secondaryCtaLabel}
            </CtaLink>
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white"
        aria-hidden
      />
    </section>
  );
}

function LifePhotoCard({ image }: { image: CareersGalleryImageView }) {
  return (
    <div className="relative h-52 w-72 shrink-0 overflow-hidden rounded-3xl bg-ink-100 shadow-[0_18px_40px_-28px_rgba(45,45,45,0.55)] md:h-64 md:w-80">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.imageUrl}
        alt={image.alt || image.caption || "Life at Skillinabox"}
        className="size-full object-cover"
        loading="lazy"
      />
      {image.caption ? (
        <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/85 via-ink-900/35 to-transparent px-4 py-3.5 text-sm text-white">
          {image.caption}
        </p>
      ) : null}
    </div>
  );
}

function LifeMarqueeTrack({ items, ariaHidden }: { items: CareersGalleryImageView[]; ariaHidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-stretch gap-4 pr-4" aria-hidden={ariaHidden || undefined}>
      {items.map((image, i) => (
        <li key={`${image.id}-${i}`}>
          <LifePhotoCard image={image} />
        </li>
      ))}
    </ul>
  );
}

function LifePhotoMarquee({ images }: { images: CareersGalleryImageView[] }) {
  const { row1, row2 } = buildLifeMarqueeRows(images);

  return (
    <div className="group/marquee relative">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent md:w-24"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent md:w-24"
        aria-hidden
      />
      <div className="flex flex-col gap-4 overflow-hidden py-1 motion-reduce:overflow-x-auto">
        <div className="flex w-max animate-[careers-marquee_42s_linear_infinite] group-hover/marquee:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:w-auto">
          <LifeMarqueeTrack items={row1} />
          <LifeMarqueeTrack items={row1} ariaHidden />
        </div>
        {row2.length > 0 ? (
          <div className="flex w-max animate-[careers-marquee-reverse_52s_linear_infinite] group-hover/marquee:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:w-auto">
            <LifeMarqueeTrack items={row2} />
            <LifeMarqueeTrack items={row2} ariaHidden />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CareersLifeSection({
  content,
  images,
  voices,
}: {
  content: CareersLandingView;
  images: CareersGalleryImageView[];
  voices: CareersTeamVoiceView[];
}) {
  const life = images.filter((i) => i.section === "LIFE");
  const culture = images.filter((i) => i.section === "CULTURE");

  return (
    <div className="bg-white">
      <CareersTeamVoicesSection content={content} voices={voices} />

      <section className="relative py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">Inside the team</p>
          <div className="mt-3 grid items-start gap-5 lg:grid-cols-12 lg:gap-12">
            <h2 className="text-3xl font-extrabold leading-[1.08] tracking-tight text-ink-900 md:text-5xl lg:col-span-5">
              {content.lifeTitle}
            </h2>
            <p className="text-base leading-relaxed text-ink-500 md:text-lg lg:col-span-7 lg:pt-2">{content.lifeBody}</p>
          </div>
        </div>

        {life.length > 0 ? (
          <div className="mt-12">
            <LifePhotoMarquee images={life} />
          </div>
        ) : (
          <div className="mx-auto mt-12 max-w-6xl px-4 md:px-8">
            <div className="relative max-h-72 overflow-hidden rounded-3xl aspect-[21/9] brand-gradient">
              <div className="absolute inset-0 confetti opacity-40" aria-hidden />
              <p className="relative flex h-full items-center justify-center px-6 text-center text-sm font-medium text-white/90 md:text-base">
                Photos from life at SIB will land here.
              </p>
            </div>
          </div>
        )}
      </section>

      {culture.length > 0 ? (
        <section className="relative overflow-hidden border-y border-ink-100 bg-[linear-gradient(180deg,#fff8e0_0%,#ffffff_42%,#e8f8fd_100%)]">
          <div className="pointer-events-none absolute -left-10 top-8 size-40 rounded-full bg-sun-500/20 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute right-0 bottom-0 size-48 rounded-full bg-sky-500/20 blur-3xl" aria-hidden />
          <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Snapshots</p>
                <h2 className="mt-2 text-2xl md:text-4xl font-extrabold tracking-tight text-ink-900">Culture in frames</h2>
              </div>
              <p className="text-sm md:text-base text-ink-500 max-w-md sm:text-right">
                Moments from the people who make Skillinabox feel like home.
              </p>
            </div>
            <ul className="mt-12 flex gap-6 overflow-x-auto pb-8 pt-4 snap-x snap-mandatory">
              {culture.map((img, idx) => (
                <li
                  key={img.id}
                  className={cn(
                    "snap-start shrink-0 w-[min(78vw,280px)] bg-white p-2.5 pb-8 shadow-[0_16px_40px_-20px_rgba(45,45,45,0.45)] ring-1 ring-ink-100/80 transition-transform duration-300 hover:rotate-0 hover:-translate-y-1",
                    CULTURE_TILTS[idx % CULTURE_TILTS.length],
                  )}
                >
                  <div className="overflow-hidden aspect-[5/4] bg-ink-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.imageUrl}
                      alt={img.alt || img.caption || "Skillinabox culture"}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {img.caption ? (
                    <p className="mt-3 text-sm text-ink-600 px-1 font-medium leading-snug">{img.caption}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="relative overflow-hidden brand-gradient">
        <div className="absolute inset-0 confetti opacity-25" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">We&apos;re hiring</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white tracking-tight">Ready to join?</h2>
            <p className="mt-3 text-sm md:text-base text-white/90 leading-relaxed">
              Create a candidate profile or browse roles open today. Your story starts here.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CtaLink href={content.primaryCtaHref} variant="primaryLight">
              {content.primaryCtaLabel}
              <span aria-hidden>→</span>
            </CtaLink>
            <CtaLink href={content.secondaryCtaHref} variant="secondaryLight">
              {content.secondaryCtaLabel}
            </CtaLink>
          </div>
        </div>
      </section>

      <footer className="px-4 md:px-8 py-6 text-xs text-ink-400 bg-ink-900 text-center">
        <span className="text-ink-300">Made with care by the SIB team</span>
        <span className="mx-2 text-ink-600" aria-hidden>
          ·
        </span>
        Empowering learners across India.
      </footer>
    </div>
  );
}

function voiceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SIB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function VoicePhoto({
  voice,
  size,
}: {
  voice: CareersTeamVoiceView;
  size: "lg" | "md";
}) {
  const dim = size === "lg" ? "size-28 md:size-36" : "size-16 md:size-20";
  const text = size === "lg" ? "text-2xl md:text-3xl" : "text-lg";
  if (voice.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={voice.photoUrl}
        alt={voice.name}
        className={cn(dim, "shrink-0 rounded-full object-cover ring-4 ring-white shadow-md")}
      />
    );
  }
  return (
    <div
      className={cn(
        dim,
        "shrink-0 rounded-full brand-gradient flex items-center justify-center font-extrabold text-white ring-4 ring-white shadow-md",
        text,
      )}
      aria-hidden
    >
      {voiceInitials(voice.name)}
    </div>
  );
}

function VoiceQuote({ quote, className }: { quote: string; className?: string }) {
  const trimmed = quote.trim();
  if (!trimmed) return null;
  return <p className={className}>{trimmed}</p>;
}

export function CareersTeamVoicesSection({
  content,
  voices,
}: {
  content: CareersLandingView;
  voices: CareersTeamVoiceView[];
}) {
  if (voices.length === 0) return null;

  const [featured, ...rest] = voices;

  return (
    <section className="relative overflow-hidden border-y border-ink-100 bg-[linear-gradient(180deg,#ffffff_0%,#fff7eb_38%,#eef9fd_100%)]">
      <div className="pointer-events-none absolute -right-16 top-10 size-56 rounded-full bg-orange-500/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -left-10 bottom-0 size-48 rounded-full bg-sky-500/20 blur-3xl" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">From the core team</p>
        <div className="mt-3 grid items-start gap-5 lg:grid-cols-12 lg:gap-12">
          <h2 className="text-3xl font-extrabold leading-[1.08] tracking-tight text-ink-900 md:text-5xl lg:col-span-5">
            {content.voicesTitle}
          </h2>
          <p className="text-base leading-relaxed text-ink-500 md:text-lg lg:col-span-7 lg:pt-2">{content.voicesBody}</p>
        </div>

        <article className="mt-12 rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-[0_20px_50px_-32px_rgba(45,45,45,0.55)] backdrop-blur-sm md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
            <VoicePhoto voice={featured} size="lg" />
            <div className="min-w-0 flex-1">
              {featured.promptLabel ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">{featured.promptLabel}</p>
              ) : null}
              {featured.quote.trim() ? (
                <p className="mt-2 text-5xl leading-none text-orange-400/70" aria-hidden>
                  “
                </p>
              ) : null}
              <VoiceQuote
                quote={featured.quote}
                className={featured.quote.trim() ? "-mt-2 text-xl font-medium leading-snug tracking-tight text-ink-900 md:text-2xl" : undefined}
              />
              <p className="mt-5 text-sm font-semibold text-ink-900">
                {featured.name}
                <span className="mx-2 font-normal text-ink-300" aria-hidden>
                  ·
                </span>
                <span className="font-medium text-ink-500">{featured.title}</span>
              </p>
            </div>
          </div>
        </article>

        {rest.length > 0 ? (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {rest.map((voice) => (
              <li
                key={voice.id}
                className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_16px_40px_-28px_rgba(45,45,45,0.5)] backdrop-blur-sm md:p-6"
              >
                <div className="flex items-start gap-4">
                  <VoicePhoto voice={voice} size="md" />
                  <div className="min-w-0 pt-0.5">
                    {voice.promptLabel ? (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600">
                        {voice.promptLabel}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm font-semibold text-ink-900">
                      {voice.name}
                      <span className="mx-1.5 font-normal text-ink-300" aria-hidden>
                        ·
                      </span>
                      <span className="font-medium text-ink-500">{voice.title}</span>
                    </p>
                  </div>
                </div>
                <VoiceQuote quote={voice.quote} className="mt-4 text-sm leading-relaxed text-ink-600 md:text-[15px]" />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
