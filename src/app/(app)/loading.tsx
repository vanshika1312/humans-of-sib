export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden>
      <div className="space-y-2">
        <div className="h-9 rounded-lg bg-ink-100 w-56 max-w-full" />
        <div className="h-4 rounded bg-ink-100 w-full max-w-xl" />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-9 rounded-lg bg-ink-100 w-28" />
        <div className="h-9 rounded-lg bg-ink-100 w-28" />
      </div>
      <div className="h-11 rounded-xl bg-ink-100 w-full max-w-md" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-xl bg-ink-100" />
        <div className="h-40 rounded-xl bg-ink-100" />
      </div>
      <div className="h-72 rounded-xl bg-ink-100" />
    </div>
  );
}
