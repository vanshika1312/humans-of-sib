"use client";

import { useEffect, useMemo, useState } from "react";

function getUrlString(input: RequestInfo | URL): string | null {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return null;
}

function shouldTrackRequest(url: string, init?: RequestInit): boolean {
  // Ignore obvious non-HTTP(S) fetches.
  if (
    url.startsWith("blob:") ||
    url.startsWith("data:") ||
    url.startsWith("chrome-extension:") ||
    url.startsWith("capacitor:") ||
    url.startsWith("file:")
  ) {
    return false;
  }

  // Normalize to absolute URL for consistent checks.
  let u: URL;
  try {
    u = new URL(url, window.location.origin);
  } catch {
    return false;
  }

  // Only track same-origin calls (keeps 3P calls from causing surprise loaders).
  if (u.origin !== window.location.origin) return false;

  // Ignore Next internal asset/data fetches to avoid loader flicker during prefetching.
  if (u.pathname.startsWith("/_next/")) return false;

  const method = (init?.method || "GET").toUpperCase();

  // Always track API requests; for non-API, only track mutating methods.
  if (u.pathname.startsWith("/api/")) return true;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") return true;

  return false;
}

type InFlightListener = (count: number) => void;

const inFlightListeners = new Set<InFlightListener>();
let inFlightCount = 0;

function setInFlightCount(next: number) {
  inFlightCount = Math.max(0, next);
  for (const listener of inFlightListeners) listener(inFlightCount);
}

function ensureFetchPatched() {
  if (typeof window === "undefined") return;

  const w = window as typeof window & {
    __hosibFetchPatched?: boolean;
    __hosibOriginalFetch?: typeof window.fetch;
  };

  if (w.__hosibFetchPatched) return;

  w.__hosibFetchPatched = true;
  w.__hosibOriginalFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getUrlString(input);
    const track = Boolean(url && shouldTrackRequest(url, init));

    if (track) setInFlightCount(inFlightCount + 1);

    try {
      return await w.__hosibOriginalFetch!(input as never, init);
    } finally {
      if (track) setInFlightCount(inFlightCount - 1);
    }
  }) as typeof window.fetch;
}

/**
 * Renders a global "request in progress" indicator and automatically tracks
 * in-flight `fetch()` calls in the browser.
 */
export function GlobalRequestLoader() {
  const [inFlight, setInFlight] = useState(0);

  useEffect(() => {
    ensureFetchPatched();
    const listener: InFlightListener = (count) => setInFlight(count);
    inFlightListeners.add(listener);
    listener(inFlightCount);
    return () => {
      inFlightListeners.delete(listener);
    };
  }, []);

  const active = inFlight > 0;
  const label = useMemo(() => (inFlight > 1 ? `Working… (${inFlight})` : "Working…"), [inFlight]);

  if (!active) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60]">
      <div className="h-0.5 w-full bg-ink-100">
        <div className="h-0.5 w-1/3 animate-pulse bg-sky-600" />
      </div>

      <div
        className="pointer-events-none absolute right-3 top-2 flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-ink-600 shadow-sm ring-1 ring-ink-100 backdrop-blur"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="inline-block size-3 animate-spin rounded-full border-2 border-ink-200 border-t-sky-600" aria-hidden />
        <span>{label}</span>
      </div>
    </div>
  );
}
