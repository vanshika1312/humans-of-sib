import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export default function Loading() {
  return (
    <div className="space-y-6">
      <RouteLoadingFallback label="Loading your tasks board…" />

      <div className="space-y-6 animate-pulse" aria-hidden>
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <div className="h-5 w-36 rounded bg-ink-100" />
            <div className="h-4 w-full max-w-xl rounded bg-ink-100" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="h-20 rounded-xl bg-ink-100" />
            <div className="h-20 rounded-xl bg-ink-100" />
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <div className="h-5 w-28 rounded bg-ink-100" />
            <div className="h-4 w-full max-w-2xl rounded bg-ink-100" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="h-28 rounded-xl bg-ink-100" />
            <div className="h-28 rounded-xl bg-ink-100" />
            <div className="h-28 rounded-xl bg-ink-100" />
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <div className="h-5 w-24 rounded bg-ink-100" />
            <div className="h-4 w-full max-w-lg rounded bg-ink-100" />
          </div>
          <div className="mt-4 h-72 rounded-xl bg-ink-100" />
        </section>
      </div>
    </div>
  );
}

