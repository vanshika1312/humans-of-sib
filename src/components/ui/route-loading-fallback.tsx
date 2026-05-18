/** Shared skeleton for App Router `loading.tsx` segments. */
export function RouteLoadingFallback({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="space-y-6 py-2"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-sm text-ink-500">
        <span
          className="inline-block size-5 shrink-0 animate-spin rounded-full border-2 border-ink-200 border-t-sky-600"
          aria-hidden
        />
        <span className="sr-only">{label}</span>
        <span aria-hidden className="font-medium text-ink-600">
          {label}
        </span>
      </div>
      <div className="space-y-6 animate-pulse" aria-hidden>
        <div className="space-y-2">
          <div className="h-9 rounded-lg bg-ink-100 w-56 max-w-full" />
          <div className="h-4 rounded bg-ink-100 w-full max-w-xl" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-9 rounded-lg bg-ink-100 w-28" />
          <div className="h-9 rounded-lg bg-ink-100 w-28" />
        </div>
        <div className="h-72 rounded-xl bg-ink-100" />
      </div>
    </div>
  );
}
