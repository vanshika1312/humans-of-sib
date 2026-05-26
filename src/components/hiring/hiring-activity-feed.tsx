import Link from "next/link";
import type { HiringActivityKind } from "@/generated/prisma";
import { formatDate } from "@/lib/utils";
import { HIRING_ACTIVITY_KIND_LABEL } from "@/lib/hiring-activity-kind-copy";
import { HiringActivityPayloadBlock } from "@/components/hiring/hiring-activity-payload";

export type HiringActivityFeedEvent = {
  id: string;
  kind: HiringActivityKind;
  summary: string;
  payloadJson: string | null;
  createdAt: Date;
  candidateId: string | null;
  applicationId: string | null;
  actor: { name: string | null; email: string | null } | null;
  candidate: { id: string; fullName: string; email: string } | null;
  application: {
    id: string;
    job: { id: string; title: string };
  } | null;
};

function jobIdFromPayload(payloadJson: string | null): string | null {
  if (!payloadJson) return null;
  try {
    const o = JSON.parse(payloadJson) as { jobId?: unknown };
    return typeof o.jobId === "string" && o.jobId.trim() ? o.jobId : null;
  } catch {
    return null;
  }
}

function HiringActivityContextLinks({ ev }: { ev: HiringActivityFeedEvent }) {
  const links: { href: string; label: string }[] = [];

  if (ev.application) {
    links.push({
      href: `/hiring/applications/${ev.application.id}`,
      label: ev.application.job.title,
    });
  }
  if (ev.candidate) {
    links.push({
      href: `/hiring/timeline/${ev.candidate.id}`,
      label: ev.candidate.fullName,
    });
  } else if (ev.candidateId) {
    links.push({
      href: `/hiring/timeline/${ev.candidateId}`,
      label: "Candidate profile",
    });
  }

  if (!ev.application && !links.some((l) => l.href.includes("/jobs/"))) {
    const jobId = jobIdFromPayload(ev.payloadJson);
    if (jobId) {
      links.push({ href: `/hiring/jobs/${jobId}`, label: "Job posting" });
    }
  }

  if (links.length === 0) return null;

  return (
    <p className="text-[11px] text-ink-500 mt-2 flex flex-wrap gap-x-2 gap-y-1">
      {links.map((l, i) => (
        <span key={l.href} className="inline-flex items-center gap-2">
          {i > 0 ? <span className="text-ink-300" aria-hidden>·</span> : null}
          <Link href={l.href} className="font-medium text-sky-700 hover:underline">
            {l.label}
          </Link>
        </span>
      ))}
    </p>
  );
}

type HiringActivityFeedProps = {
  events: HiringActivityFeedEvent[];
  emptyMessage?: string;
  /** Timeline tab style: hide raw JSON by default. */
  timelineSurface?: boolean;
};

export function HiringActivityFeed({
  events,
  emptyMessage = "No activity recorded yet.",
  timelineSurface = false,
}: HiringActivityFeedProps) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-500">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-4">
      {events.map((ev) => (
        <li key={ev.id} className="border border-ink-100 rounded-xl p-4 bg-white">
          <div className="flex flex-wrap items-baseline gap-2 gap-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-800">
              {HIRING_ACTIVITY_KIND_LABEL[ev.kind]}
            </span>
            <span className="text-xs text-ink-400">{formatDate(ev.createdAt)}</span>
          </div>
          <p className="text-sm text-ink-700 mt-1.5">{ev.summary}</p>
          {(ev.actor?.name || ev.actor?.email) && (
            <p className="text-[11px] text-ink-400 mt-1">By {ev.actor?.name ?? ev.actor?.email}</p>
          )}
          <HiringActivityContextLinks ev={ev} />
          {ev.payloadJson ? (
            <HiringActivityPayloadBlock
              kind={ev.kind}
              payloadJson={ev.payloadJson}
              timelineSurface={timelineSurface}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
