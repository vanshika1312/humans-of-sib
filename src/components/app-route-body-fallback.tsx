/** Fallback for Suspense boundaries wrapping async route bodies under `(app)`. */
export function RouteBodyFallback() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden>
      <div className="space-y-2">
        <div className="h-9 rounded-lg bg-ink-100 w-52 max-w-full" />
        <div className="h-4 rounded bg-ink-100 w-full max-w-md" />
      </div>
      <div className="h-40 rounded-xl bg-ink-100" />
      <div className="h-56 rounded-xl bg-ink-100" />
    </div>
  );
}
