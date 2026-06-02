"use client";

import Link from "next/link";
import { Camera } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { TaggedFeedPhoto } from "../_data/mockEmployeeData";

type Props = {
  photos: TaggedFeedPhoto[];
};

function hangTilt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return (hash % 7) - 3;
}

function PhotoClip({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 28"
      className={cn("mx-auto h-7 w-5 drop-shadow-sm", className)}
      aria-hidden
    >
      <path
        d="M10 2c-3 0-5 2.2-5 5.5L10 26l5-18.5C15 4.2 13 2 10 2z"
        fill="#b8bcc4"
        stroke="#8b919a"
        strokeWidth="0.6"
      />
      <path
        d="M6 1.5h8"
        fill="none"
        stroke="#9ca3af"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="1.5" r="2.2" fill="none" stroke="#a3a9b2" strokeWidth="1.2" />
    </svg>
  );
}

function HangingPhoto({ photo }: { photo: TaggedFeedPhoto }) {
  const tilt = hangTilt(photo.id);

  return (
    <Link
      href="/home"
      className="group flex shrink-0 flex-col items-center snap-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 rounded-sm"
      title={`Tagged by ${photo.postedByName} · ${formatDate(photo.postedAt)}`}
    >
      <PhotoClip className="transition-transform group-hover:-translate-y-0.5" />
      <figure
        className="w-[88px] sm:w-[100px] bg-white p-1.5 pb-2.5 shadow-md ring-1 ring-ink-100/80 transition-shadow group-hover:shadow-lg"
        style={{ transform: `rotate(${tilt}deg)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl}
          alt={photo.caption ?? `Tagged in a feed photo by ${photo.postedByName}`}
          className="aspect-[3/4] w-full object-cover bg-ink-50"
          loading="lazy"
        />
        <figcaption className="sr-only">
          {photo.caption}. Posted by {photo.postedByName} on {formatDate(photo.postedAt)}.
        </figcaption>
      </figure>
    </Link>
  );
}

export function TaggedMomentsLine({ photos }: Props) {
  return (
    <section
      aria-label="Tagged moments from the company feed"
      className="overflow-hidden rounded-xl border border-ink-100 bg-gradient-to-b from-white via-white to-ink-50/60"
    >
      <div className="border-b border-ink-100/80 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-ink-600">Moments you&apos;re in</h2>
        <p className="mt-0.5 text-sm text-ink-400">
          Photos from the company feed where you&apos;ve been tagged
        </p>
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <Camera className="size-9 text-ink-300" aria-hidden />
          <p className="max-w-sm text-sm text-ink-400">
            When colleagues tag you on a feed photo, those moments will hang here on your
            journey.
          </p>
        </div>
      ) : (
        <div className="relative px-2 pb-5 pt-1 sm:px-4">
          <svg
            className="pointer-events-none absolute inset-x-3 top-3 h-6 w-[calc(100%-1.5rem)] sm:inset-x-6 sm:w-[calc(100%-3rem)]"
            viewBox="0 0 1000 24"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="journey-wire" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#b0b4bc" />
                <stop offset="45%" stopColor="#e2e4e8" />
                <stop offset="100%" stopColor="#9ca3af" />
              </linearGradient>
            </defs>
            <path
              d="M 0 6 Q 500 22 1000 6"
              fill="none"
              stroke="url(#journey-wire)"
              strokeWidth="2.25"
              strokeLinecap="round"
            />
          </svg>

          <div
            className={cn(
              "relative z-10 flex gap-3 overflow-x-auto px-1 pb-1 pt-7 snap-x snap-mandatory",
              "sm:justify-between sm:gap-2 sm:overflow-visible sm:px-2",
            )}
          >
            {photos.map((photo) => (
              <HangingPhoto key={photo.id} photo={photo} />
            ))}
          </div>

          <p className="mt-3 px-3 text-center text-[11px] text-ink-400 sm:px-0">
            Tap a photo to open the company feed · Preview with mock data
          </p>
        </div>
      )}
    </section>
  );
}
