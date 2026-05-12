export function AttendancePersonalSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      <div className="h-52 rounded-xl bg-ink-100" />
      <div className="h-36 rounded-xl bg-ink-100" />
      <div className="h-80 rounded-xl bg-ink-100" />
    </div>
  );
}

export function AttendanceApprovalsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      <div className="h-6 w-28 rounded bg-ink-100" />
      <div className="h-48 rounded-xl bg-ink-100" />
    </div>
  );
}

export function AttendanceTeamSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden>
      <div className="h-6 w-48 rounded bg-ink-100" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="h-40 rounded-xl bg-ink-100" />
        <div className="h-40 rounded-xl bg-ink-100" />
      </div>
      <div className="h-64 rounded-xl bg-ink-100" />
    </div>
  );
}
