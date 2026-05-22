"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function extFromMime(mimeType?: string | null) {
  const m = (mimeType ?? "").toLowerCase();
  if (!m.includes("/")) return null;
  const [, sub] = m.split("/", 2);
  if (!sub) return null;
  if (sub.includes("jpeg")) return "jpg";
  if (sub.includes("png")) return "png";
  if (sub.includes("webp")) return "webp";
  if (sub.includes("gif")) return "gif";
  if (sub.includes("mp4")) return "mp4";
  if (sub.includes("quicktime")) return "mov";
  if (sub.includes("webm")) return "webm";
  return null;
}

function fileNameFromUrl(url: string) {
  try {
    const u = new URL(url, window.location.href);
    const raw = u.pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(raw);
  } catch {
    const raw = url.split("?")[0]?.split("#")[0]?.split("/").pop() ?? "";
    return raw;
  }
}

function hasExtension(name: string) {
  const base = name.split("/").pop() ?? name;
  return /\.[a-z0-9]{2,6}$/i.test(base);
}

function safeSuggestedName(opts: { url: string; fileName?: string | null; mimeType?: string | null }) {
  const fromMeta = (opts.fileName ?? "").trim();
  const fromUrl = fileNameFromUrl(opts.url).trim();
  const base = (fromMeta || fromUrl || "media").replace(/[^\w.\-() ]+/g, "_").slice(0, 140);
  if (hasExtension(base)) return base;
  const ext = extFromMime(opts.mimeType);
  return ext ? `${base}.${ext}` : base;
}

async function downloadViaFetch(url: string, fileName: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("fetch_failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function HomeFeedPostMedia({
  url,
  mimeType,
  fileName,
  className,
}: {
  url: string;
  mimeType?: string | null;
  fileName?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isVideo = useMemo(() => {
    const m = (mimeType ?? "").toLowerCase();
    if (m.startsWith("video/")) return true;
    if (m.startsWith("image/")) return false;
    return /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
  }, [mimeType, url]);

  const suggestedName = useMemo(() => safeSuggestedName({ url, fileName, mimeType }), [url, fileName, mimeType]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function onDownload() {
    setDownloading(true);
    try {
      await downloadViaFetch(url, suggestedName);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "relative rounded-xl border border-ink-100 overflow-hidden group",
          !isVideo && "cursor-zoom-in",
          className,
        )}
        onClick={!isVideo ? () => setOpen(true) : undefined}
        role={!isVideo ? "button" : undefined}
        aria-label={!isVideo ? "Open media options" : undefined}
        tabIndex={!isVideo ? 0 : undefined}
        onKeyDown={
          !isVideo
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") setOpen(true);
              }
            : undefined
        }
      >
        {isVideo ? (
          <video src={url} controls className="w-full max-h-80 bg-black" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={fileName ?? "Post media"} className="w-full max-h-96 object-cover" loading="lazy" />
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label="Media options"
          className={cn(
            "absolute top-2 right-2 z-10",
            "inline-flex items-center justify-center rounded-lg border border-white/30 bg-ink-900/50 text-white backdrop-blur",
            "size-9 shadow-sm transition-opacity",
            "opacity-100 md:opacity-0 md:group-hover:opacity-100",
          )}
        >
          <span className="text-lg leading-none">⋯</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[70]">
          <button
            aria-hidden
            className="absolute inset-0 bg-ink-900/25 backdrop-blur-md"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Media options"
            className="absolute left-1/2 top-16 w-[min(92vw,720px)] -translate-x-1/2 rounded-2xl border border-white/30 bg-white/90 backdrop-blur-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex items-center gap-3 border-b border-white/30">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink-800 leading-tight truncate">
                  {suggestedName}
                </div>
                <div className="text-xs text-ink-500">Choose an action</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Close"
                  className="size-9 rounded-full inline-flex items-center justify-center hover:bg-white/60 text-ink-700"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="rounded-xl border border-ink-100 overflow-hidden bg-white">
                {isVideo ? (
                  <video src={url} controls className="w-full max-h-[60vh] bg-black" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={fileName ?? "Post media"} className="w-full max-h-[60vh] object-contain bg-ink-50" />
                )}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 flex-wrap">
                <Button
                  variant="outline"
                  disabled={downloading}
                  onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Open
                </Button>
                <Button variant="primary" disabled={downloading} onClick={onDownload}>
                  {downloading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                  {downloading ? "Downloading…" : "Download"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

