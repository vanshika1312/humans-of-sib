"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import type { CareersGalleryImageView, CareersLandingView, CareersTeamVoiceView } from "@/lib/careers-landing";
import { clampHeroOverlayOpacity, heroImageFilter } from "@/lib/careers-landing";
import { CareersHeroDarkWash } from "@/app/careers/_components/careers-landing-sections";
import {
  addCareersGalleryImage,
  addCareersTeamVoice,
  deleteCareersGalleryImage,
  deleteCareersTeamVoice,
  saveCareersLandingContent,
  updateCareersGalleryImage,
  updateCareersTeamVoice,
  uploadCareersLandingImage,
} from "../actions";

const fileClassName =
  "block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-900 hover:file:bg-sky-200";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function uploadCareersImage(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: "Image is too large (max 5 MB)." };
    }
    const fileBase64 = await fileToBase64(file);
    return uploadCareersLandingImage({
      fileBase64,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not upload image." };
  }
}

export function CareersLandingEditor({
  initial,
  gallery,
  voices,
}: {
  initial: CareersLandingView;
  gallery: CareersGalleryImageView[];
  voices: CareersTeamVoiceView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [heroOverlayOpacity, setHeroOverlayOpacity] = useState(() =>
    clampHeroOverlayOpacity(initial.heroOverlayOpacity),
  );

  return (
    <div className="space-y-10">
      <form
        className="space-y-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const fileInput = form.elements.namedItem("heroImage") as HTMLInputElement | null;
          const file = fileInput?.files?.[0] ?? null;
          const removeHeroImage = fd.get("removeHeroImage") === "on";

          setMessage(null);
          startTransition(async () => {
            try {
              let heroImageUrl: string | null | undefined;
              if (file && file.size > 0) {
                const uploaded = await uploadCareersImage(file);
                if (!uploaded.ok) {
                  setMessage({ tone: "err", text: uploaded.error });
                  return;
                }
                heroImageUrl = uploaded.url;
              }

              const result = await saveCareersLandingContent({
                brandLabel: String(fd.get("brandLabel") || ""),
                heroHeadline: String(fd.get("heroHeadline") || ""),
                heroSubcopy: String(fd.get("heroSubcopy") || ""),
                primaryCtaLabel: String(fd.get("primaryCtaLabel") || ""),
                primaryCtaHref: String(fd.get("primaryCtaHref") || ""),
                secondaryCtaLabel: String(fd.get("secondaryCtaLabel") || ""),
                secondaryCtaHref: String(fd.get("secondaryCtaHref") || ""),
                lifeTitle: String(fd.get("lifeTitle") || ""),
                lifeBody: String(fd.get("lifeBody") || ""),
                voicesTitle: String(fd.get("voicesTitle") || ""),
                voicesBody: String(fd.get("voicesBody") || ""),
                heroImageUrl,
                heroOverlayOpacity,
                removeHeroImage: removeHeroImage && !heroImageUrl,
              });

              if (!result.ok) {
                setMessage({ tone: "err", text: result.error });
                return;
              }
              setMessage({ tone: "ok", text: "Landing page saved." });
              if (fileInput) fileInput.value = "";
              router.refresh();
            } catch (err) {
              setMessage({
                tone: "err",
                text: err instanceof Error ? err.message : "Something went wrong.",
              });
            }
          });
        }}
      >
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Hero &amp; CTAs</h2>
          <p className="text-sm text-ink-500 mt-1">
            Shown on the public careers landing. Changes go live as soon as you save.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="brandLabel">Brand label</Label>
            <Input id="brandLabel" name="brandLabel" defaultValue={initial.brandLabel} required maxLength={120} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="heroHeadline">Headline</Label>
            <Input
              id="heroHeadline"
              name="heroHeadline"
              defaultValue={initial.heroHeadline}
              required
              maxLength={240}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="heroSubcopy">Supporting line</Label>
            <Textarea id="heroSubcopy" name="heroSubcopy" defaultValue={initial.heroSubcopy} required rows={3} />
          </div>
          <div>
            <Label htmlFor="primaryCtaLabel">Primary CTA label</Label>
            <Input
              id="primaryCtaLabel"
              name="primaryCtaLabel"
              defaultValue={initial.primaryCtaLabel}
              required
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="primaryCtaHref">Primary CTA link</Label>
            <Input
              id="primaryCtaHref"
              name="primaryCtaHref"
              defaultValue={initial.primaryCtaHref}
              required
              maxLength={500}
              placeholder="/careers/sign-up"
            />
          </div>
          <div>
            <Label htmlFor="secondaryCtaLabel">Secondary CTA label</Label>
            <Input
              id="secondaryCtaLabel"
              name="secondaryCtaLabel"
              defaultValue={initial.secondaryCtaLabel}
              required
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="secondaryCtaHref">Secondary CTA link</Label>
            <Input
              id="secondaryCtaHref"
              name="secondaryCtaHref"
              defaultValue={initial.secondaryCtaHref}
              required
              maxLength={500}
              placeholder="/careers/jobs"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="lifeTitle">Life @ SIB title</Label>
            <Input id="lifeTitle" name="lifeTitle" defaultValue={initial.lifeTitle} required maxLength={160} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="lifeBody">Life @ SIB body</Label>
            <Textarea id="lifeBody" name="lifeBody" defaultValue={initial.lifeBody} required rows={4} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="voicesTitle">Core team section title</Label>
            <Input id="voicesTitle" name="voicesTitle" defaultValue={initial.voicesTitle} required maxLength={160} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="voicesBody">Core team section body</Label>
            <Textarea id="voicesBody" name="voicesBody" defaultValue={initial.voicesBody} required rows={3} />
          </div>
        </div>

        <div className="space-y-3 border-t border-ink-100 pt-5">
          <Label htmlFor="heroImage">Hero team photo</Label>
          {initial.heroImageUrl ? (
            <div className="space-y-3">
              <div className="relative max-h-56 w-full max-w-xl overflow-hidden rounded-lg border border-ink-100 bg-ink-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={initial.heroImageUrl}
                  alt="Current hero"
                  className="max-h-56 w-full object-cover"
                  style={{ filter: heroImageFilter(heroOverlayOpacity) }}
                />
                <CareersHeroDarkWash opacity={heroOverlayOpacity} />
              </div>
              <div className="max-w-xl space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="heroOverlayOpacity" className="mb-0">
                    Dark overlay
                  </Label>
                  <span className="text-sm tabular-nums text-ink-600">{heroOverlayOpacity}%</span>
                </div>
                <input
                  id="heroOverlayOpacity"
                  name="heroOverlayOpacity"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={heroOverlayOpacity}
                  onChange={(e) => setHeroOverlayOpacity(Number(e.target.value))}
                  className="w-full accent-sky-600"
                />
                <div className="flex justify-between text-xs text-ink-400">
                  <span>Brighter photo</span>
                  <span>Darker wash</span>
                </div>
                <p className="text-xs text-ink-400">
                  Drag left to show more of the group photo. Save to apply on /careers.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-600">
                <input type="checkbox" name="removeHeroImage" className="rounded border-ink-300" />
                Remove current hero image
              </label>
            </div>
          ) : (
            <p className="text-sm text-ink-400">No hero image yet — brand gradient shows until you upload one.</p>
          )}
          <input
            id="heroImage"
            name="heroImage"
            type="file"
            accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,image/webp,image/gif,.webp,.gif"
            className={fileClassName}
          />
          <p className="text-xs text-ink-400">PNG, JPG, JPEG, WebP, or GIF · max 5 MB</p>
        </div>

        {message ? (
          <p
            className={
              message.tone === "ok"
                ? "text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2"
                : "text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            }
          >
            {message.text}
          </p>
        ) : null}

        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving…" : "Save landing content"}
        </Button>
      </form>

      <section className="space-y-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Core team notes</h2>
          <p className="text-sm text-ink-500 mt-1">
            Shown above Life @ SIB. Starter quotes are in place — replace them with each person&apos;s own words, and
            add a photo if you have one.
          </p>
        </div>

        <form
          className="grid gap-3 sm:grid-cols-2 border border-dashed border-ink-200 rounded-xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            const fileInput = form.elements.namedItem("photo") as HTMLInputElement | null;
            const file = fileInput?.files?.[0] ?? null;

            setMessage(null);
            startTransition(async () => {
              try {
                let photoUrl: string | undefined;
                if (file && file.size > 0) {
                  const uploaded = await uploadCareersImage(file);
                  if (!uploaded.ok) {
                    setMessage({ tone: "err", text: uploaded.error });
                    return;
                  }
                  photoUrl = uploaded.url;
                }
                const result = await addCareersTeamVoice({
                  name: String(fd.get("name") || ""),
                  title: String(fd.get("title") || ""),
                  quote: String(fd.get("quote") || ""),
                  promptLabel: String(fd.get("promptLabel") || ""),
                  photoUrl,
                  sortOrder: Number(fd.get("sortOrder") || voices.length),
                });
                if (!result.ok) {
                  setMessage({ tone: "err", text: result.error });
                  return;
                }
                setMessage({ tone: "ok", text: "Team note added." });
                form.reset();
                router.refresh();
              } catch (err) {
                setMessage({
                  tone: "err",
                  text: err instanceof Error ? err.message : "Could not add note.",
                });
              }
            });
          }}
        >
          <div>
            <Label htmlFor="voiceName">Name</Label>
            <Input id="voiceName" name="name" required maxLength={120} placeholder="e.g. Prateek" />
          </div>
          <div>
            <Label htmlFor="voiceTitle">Title</Label>
            <Input id="voiceTitle" name="title" required maxLength={160} placeholder="e.g. CEO" />
          </div>
          <div>
            <Label htmlFor="voicePrompt">Label (optional)</Label>
            <Input id="voicePrompt" name="promptLabel" maxLength={80} placeholder="e.g. Why this, why now" />
          </div>
          <div>
            <Label htmlFor="voiceSort">Sort order</Label>
            <Input id="voiceSort" name="sortOrder" type="number" min={0} max={999} defaultValue={voices.length} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="voiceQuote">Quote</Label>
            <Textarea id="voiceQuote" name="quote" rows={3} maxLength={2000} placeholder="Their words, 2–4 sentences." />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="voicePhoto">Photo (optional)</Label>
            <input
              id="voicePhoto"
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,image/webp,image/gif,.webp,.gif"
              className={fileClassName}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add team note"}
            </Button>
          </div>
        </form>

        {voices.length === 0 ? (
          <p className="text-sm text-ink-500">No core-team notes yet.</p>
        ) : (
          <ul className="space-y-6">
            {voices.map((voice) => (
              <VoiceRow key={voice.id} voice={voice} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Gallery photos</h2>
          <p className="text-sm text-ink-500 mt-1">
            Life @ SIB images appear in the collage. Culture images show as frames in the strip below.
          </p>
        </div>

        <form
          className="grid gap-3 sm:grid-cols-2 border border-dashed border-ink-200 rounded-xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            const fileInput = form.elements.namedItem("image") as HTMLInputElement | null;
            const file = fileInput?.files?.[0] ?? null;
            if (!file || file.size <= 0) {
              setMessage({ tone: "err", text: "Choose an image to upload." });
              return;
            }

            setMessage(null);
            startTransition(async () => {
              try {
                const uploaded = await uploadCareersImage(file);
                if (!uploaded.ok) {
                  setMessage({ tone: "err", text: uploaded.error });
                  return;
                }
                const result = await addCareersGalleryImage({
                  imageUrl: uploaded.url,
                  section: String(fd.get("section") || "LIFE") === "CULTURE" ? "CULTURE" : "LIFE",
                  caption: String(fd.get("caption") || ""),
                  alt: String(fd.get("alt") || ""),
                  sortOrder: Number(fd.get("sortOrder") || 0),
                });
                if (!result.ok) {
                  setMessage({ tone: "err", text: result.error });
                  return;
                }
                setMessage({ tone: "ok", text: "Photo uploaded." });
                form.reset();
                router.refresh();
              } catch (err) {
                setMessage({
                  tone: "err",
                  text: err instanceof Error ? err.message : "Upload failed.",
                });
              }
            });
          }}
        >
          <div className="sm:col-span-2">
            <Label htmlFor="galleryImage">Add photo</Label>
            <input
              id="galleryImage"
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,image/webp,image/gif,.webp,.gif"
              required
              className={fileClassName}
            />
          </div>
          <div>
            <Label htmlFor="section">Section</Label>
            <Select id="section" name="section" defaultValue="LIFE">
              <option value="LIFE">Life @ SIB</option>
              <option value="CULTURE">Culture</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="sortOrder">Sort order</Label>
            <Input id="sortOrder" name="sortOrder" type="number" min={0} max={999} defaultValue={gallery.length} />
          </div>
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Input id="caption" name="caption" maxLength={240} placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="alt">Alt text</Label>
            <Input id="alt" name="alt" maxLength={240} placeholder="Describe the photo" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading…" : "Upload photo"}
            </Button>
          </div>
        </form>

        {gallery.length === 0 ? (
          <p className="text-sm text-ink-500">No gallery photos yet.</p>
        ) : (
          <ul className="space-y-6">
            {gallery.map((img) => (
              <GalleryRow key={img.id} image={img} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GalleryRow({ image }: { image: CareersGalleryImageView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="grid gap-4 md:grid-cols-[160px_1fr] border border-ink-100 rounded-xl p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.imageUrl} alt={image.alt || ""} className="w-full aspect-[4/3] object-cover rounded-lg bg-ink-50" />
      <div className="space-y-3">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setError(null);
            startTransition(async () => {
              try {
                const result = await updateCareersGalleryImage({
                  id: String(fd.get("id") || ""),
                  section: String(fd.get("section") || "LIFE") === "CULTURE" ? "CULTURE" : "LIFE",
                  caption: String(fd.get("caption") || ""),
                  alt: String(fd.get("alt") || ""),
                  sortOrder: Number(fd.get("sortOrder") || 0),
                  published: fd.get("published") === "on",
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Update failed.");
              }
            });
          }}
        >
          <input type="hidden" name="id" value={image.id} />
          <div>
            <Label htmlFor={`section-${image.id}`}>Section</Label>
            <Select id={`section-${image.id}`} name="section" defaultValue={image.section}>
              <option value="LIFE">Life @ SIB</option>
              <option value="CULTURE">Culture</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={`sort-${image.id}`}>Sort order</Label>
            <Input
              id={`sort-${image.id}`}
              name="sortOrder"
              type="number"
              min={0}
              max={999}
              defaultValue={image.sortOrder}
            />
          </div>
          <div>
            <Label htmlFor={`caption-${image.id}`}>Caption</Label>
            <Input id={`caption-${image.id}`} name="caption" defaultValue={image.caption ?? ""} maxLength={240} />
          </div>
          <div>
            <Label htmlFor={`alt-${image.id}`}>Alt text</Label>
            <Input id={`alt-${image.id}`} name="alt" defaultValue={image.alt} maxLength={240} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-600 sm:col-span-2">
            <input type="checkbox" name="published" defaultChecked={image.published} className="rounded border-ink-300" />
            Published on careers page
          </label>
          {error ? <p className="sm:col-span-2 text-sm text-red-700">{error}</p> : null}
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Update"}
            </Button>
          </div>
        </form>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-red-700 border-red-200 hover:bg-red-50"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const result = await deleteCareersGalleryImage(image.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Delete failed.");
              }
            });
          }}
        >
          Delete photo
        </Button>
      </div>
    </li>
  );
}

function VoiceRow({ voice }: { voice: CareersTeamVoiceView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="grid gap-4 md:grid-cols-[120px_1fr] border border-ink-100 rounded-xl p-4">
      {voice.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={voice.photoUrl}
          alt={voice.name}
          className="w-full aspect-square object-cover rounded-full bg-ink-50"
        />
      ) : (
        <div className="w-full aspect-square rounded-full brand-gradient flex items-center justify-center text-white font-bold text-xl">
          {voice.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="space-y-3">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            const fileInput = form.elements.namedItem("photo") as HTMLInputElement | null;
            const file = fileInput?.files?.[0] ?? null;
            const removePhoto = fd.get("removePhoto") === "on";
            setError(null);
            startTransition(async () => {
              try {
                let photoUrl: string | undefined;
                if (file && file.size > 0) {
                  const uploaded = await uploadCareersImage(file);
                  if (!uploaded.ok) {
                    setError(uploaded.error);
                    return;
                  }
                  photoUrl = uploaded.url;
                }
                const result = await updateCareersTeamVoice({
                  id: String(fd.get("id") || ""),
                  name: String(fd.get("name") || ""),
                  title: String(fd.get("title") || ""),
                  quote: String(fd.get("quote") || ""),
                  promptLabel: String(fd.get("promptLabel") || ""),
                  photoUrl,
                  sortOrder: Number(fd.get("sortOrder") || 0),
                  published: fd.get("published") === "on",
                  removePhoto: removePhoto && !photoUrl,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                if (fileInput) fileInput.value = "";
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Update failed.");
              }
            });
          }}
        >
          <input type="hidden" name="id" value={voice.id} />
          <div>
            <Label htmlFor={`name-${voice.id}`}>Name</Label>
            <Input id={`name-${voice.id}`} name="name" defaultValue={voice.name} required maxLength={120} />
          </div>
          <div>
            <Label htmlFor={`title-${voice.id}`}>Title</Label>
            <Input id={`title-${voice.id}`} name="title" defaultValue={voice.title} required maxLength={160} />
          </div>
          <div>
            <Label htmlFor={`prompt-${voice.id}`}>Label</Label>
            <Input
              id={`prompt-${voice.id}`}
              name="promptLabel"
              defaultValue={voice.promptLabel ?? ""}
              maxLength={80}
              placeholder="e.g. Why now"
            />
          </div>
          <div>
            <Label htmlFor={`sort-${voice.id}`}>Sort order</Label>
            <Input
              id={`sort-${voice.id}`}
              name="sortOrder"
              type="number"
              min={0}
              max={999}
              defaultValue={voice.sortOrder}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={`quote-${voice.id}`}>Quote</Label>
            <Textarea
              id={`quote-${voice.id}`}
              name="quote"
              defaultValue={voice.quote}
              rows={4}
              maxLength={2000}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={`photo-${voice.id}`}>Replace photo</Label>
            <input
              id={`photo-${voice.id}`}
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,image/webp,image/gif,.webp,.gif"
              className={fileClassName}
            />
          </div>
          {voice.photoUrl ? (
            <label className="flex items-center gap-2 text-sm text-ink-600 sm:col-span-2">
              <input type="checkbox" name="removePhoto" className="rounded border-ink-300" />
              Remove current photo
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-ink-600 sm:col-span-2">
            <input type="checkbox" name="published" defaultChecked={voice.published} className="rounded border-ink-300" />
            Published on careers page
          </label>
          {error ? <p className="sm:col-span-2 text-sm text-red-700">{error}</p> : null}
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Update"}
            </Button>
          </div>
        </form>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-red-700 border-red-200 hover:bg-red-50"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const result = await deleteCareersTeamVoice(voice.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Delete failed.");
              }
            });
          }}
        >
          Delete note
        </Button>
      </div>
    </li>
  );
}
