import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { createCandidate } from "../actions";
import { firstSearchParam } from "@/lib/search-param";

type Props = {
  searchParams: Promise<{ error?: string | string[]; saved?: string | string[] }>;
};

export default async function HiringCandidatesPage(props: Props) {
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  const flashSaved = firstSearchParam(searchParams.saved) === "1";

  const candidates = await prisma.hiringCandidate.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      _count: { select: { applications: true } },
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Candidate pool"
        emoji="👤"
        subtitle="Central profiles you attach to postings — analogous to candidates in Zoho Recruit."
        action={
          <Link href="/hiring/jobs">
            <Button variant="outline" size="md">
              Job openings →
            </Button>
          </Link>
        }
      />

      {flashSaved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Candidate profile saved — you can attach them from any job&apos;s funnel.
        </div>
      )}
      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(flashError)}
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-ink-100 bg-ink-50/60">
          <CardTitle>Add candidate</CardTitle>
          <CardDescription>Capture contact info fast; deepen notes as screens progress.</CardDescription>
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
              <Label htmlFor="source">Source (optional)</Label>
              <Input id="source" name="source" className="mt-1.5" placeholder="LinkedIn referral, Careers page, Campus…" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="resumeUrl">Resume link (optional)</Label>
              <Input id="resumeUrl" name="resumeUrl" className="mt-1.5" placeholder="https://drive.google.com/…" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} placeholder="Brief context for the recruiting team." className="mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="accent">
                Save candidate
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-ink-100">
          <CardTitle>Profiles</CardTitle>
          <CardDescription>{candidates.length} people in Pool</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3 text-right">Openings</th>
                  <th className="px-5 py-3">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-ink-500">
                      No profiles yet — use the form above.
                    </td>
                  </tr>
                ) : (
                  candidates.map((c) => (
                    <tr key={c.id} className="hover:bg-ink-50/30">
                      <td className="px-5 py-3 font-medium text-ink-700">{c.fullName}</td>
                      <td className="px-5 py-3 text-ink-600">{c.email}</td>
                      <td className="px-5 py-3 text-ink-500">{c.source ?? "—"}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{c._count.applications}</td>
                      <td className="px-5 py-3 text-ink-400 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
