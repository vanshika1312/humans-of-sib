import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createCandidate } from "../../actions";
import { firstSearchParam } from "@/lib/search-param";
import { HIRING_ACTIVITY_KIND_LABEL } from "@/lib/hiring-activity-kind-copy";
import { HiringActivityPayloadBlock } from "@/components/hiring/hiring-activity-payload";
import type { HiringActivityKind } from "@/generated/prisma";
import { formatDate } from "@/lib/utils";

type Props = {
  searchParams: Promise<{
    error?: string | string[];
    saved?: string | string[];
    focus?: string | string[];
    notice?: string | string[];
  }>;
};

export default async function AddCandidatePage(props: Props) {
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  const flashSaved = firstSearchParam(searchParams.saved) === "1";
  const focusId = firstSearchParam(searchParams.focus);
  const dupNotice = firstSearchParam(searchParams.notice) === "duplicate";

  const openJobs = await prisma.hiringJob.findMany({
    where: { status: "OPEN" },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  let focusCandidate: { id: string; fullName: string; email: string } | null = null;
  let focusEvents: {
    id: string;
    kind: HiringActivityKind;
    summary: string;
    payloadJson: string | null;
    createdAt: Date;
  }[] = [];

  if (focusId) {
    const c = await prisma.hiringCandidate.findUnique({
      where: { id: focusId },
      select: { id: true, fullName: true, email: true },
    });
    if (c) {
      focusCandidate = c;
      focusEvents = await prisma.hiringActivity.findMany({
        where: { candidateId: c.id },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { id: true, kind: true, summary: true, payloadJson: true, createdAt: true },
      });
    }
  }

  return (
    <div className="space-y-8 max-w-2xl pb-10">
      <PageHeader
        title="Add candidate"
        emoji="👤"
        subtitle="Collect the profile details recruiters need before attaching someone to an opening."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/hiring/jobs">
              <Button variant="outline" size="md">
                Job openings →
              </Button>
            </Link>
            <Link href="/hiring/applications">
              <Button variant="ghost" size="md">
                Applications →
              </Button>
            </Link>
          </div>
        }
      />

      {dupNotice && focusCandidate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>We already have this email</strong> ({focusCandidate.email}). The latest form you submitted is stored
          below as a timeline event so nothing is lost — the primary profile is still{" "}
          <strong>{focusCandidate.fullName}</strong>. Open the full record to edit or review history.
        </div>
      )}

      {focusCandidate && (
        <Card className="border-sky-100/80">
          <CardHeader className="border-b border-ink-100 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Profile &amp; timeline</CardTitle>
                <p className="text-sm text-ink-600 mt-1">{focusCandidate.fullName}</p>
              </div>
              <Link href={`/hiring/timeline/${focusCandidate.id}`} className="text-sm font-semibold text-sky-700 hover:underline shrink-0">
                Open timeline &amp; edit profile →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4 max-h-[420px] overflow-y-auto">
            {focusEvents.length === 0 ? (
              <p className="text-sm text-ink-500">No timeline events recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {focusEvents.map((ev) => (
                  <li key={ev.id} className="rounded-lg border border-ink-100 bg-ink-50/40 p-3 text-sm">
                    <div className="flex flex-wrap gap-2 gap-y-1 items-baseline">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-900">
                        {HIRING_ACTIVITY_KIND_LABEL[ev.kind]}
                      </span>
                      <span className="text-[10px] text-ink-400">{formatDate(ev.createdAt)}</span>
                    </div>
                    <p className="text-ink-700 mt-1">{ev.summary}</p>
                    {ev.payloadJson ? <HiringActivityPayloadBlock kind={ev.kind} payloadJson={ev.payloadJson} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {flashSaved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Candidate saved. Open <strong>Applications</strong> to see everyone tied to postings, or use{" "}
          <strong>Job role applied</strong> next time to file them straight into a funnel.
        </div>
      )}
      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(flashError)}
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-ink-100 bg-ink-50/60">
          <CardTitle>New intake</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form action={createCandidate} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" required className="mt-1.5" placeholder="Jordan Smith" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required className="mt-1.5" placeholder="jordan@example.com" />
            </div>
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" name="phone" className="mt-1.5" placeholder="+91 …" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="targetJobId">Job role applied</Label>
              <Select id="targetJobId" name="targetJobId" defaultValue="" className="mt-1.5">
                <option value="">Optional — add profile only</option>
                {openJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-ink-400 mt-1 leading-relaxed">
                Open postings only — creates their application immediately when combined with Save.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="candidateLocation">Candidate location</Label>
              <Input
                id="candidateLocation"
                name="candidateLocation"
                className="mt-1.5"
                placeholder="City / region where they live"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="source">Source</Label>
              <Input id="source" name="source" className="mt-1.5" placeholder="LinkedIn referral, Careers page, Campus…" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="resumeDriveUrl">Résumé link (e.g. Google Drive)</Label>
              <Input
                id="resumeDriveUrl"
                name="resumeDriveUrl"
                className="mt-1.5"
                placeholder="Paste a Drive / Dropbox / https URL, or skip if you upload a file"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="resumeFile">Résumé file (PDF, Word)</Label>
              <Input
                id="resumeFile"
                name="resumeFile"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="mt-1.5 h-auto py-2 cursor-pointer"
              />
              <p className="text-xs text-ink-400 mt-1 leading-relaxed">
                If you attach a file, it replaces the pasted link for storage.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} placeholder="Brief context for the recruiting team." className="mt-1.5" />
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-3">
              <Button type="submit" variant="accent">
                Save candidate
              </Button>
              <Link href="/hiring">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
