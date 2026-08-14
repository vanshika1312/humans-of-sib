import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCandidateSession } from "@/lib/candidate-session";
import { firstSearchParam } from "@/lib/search-param";
import { CareersChrome } from "../../_components/careers-chrome";
import { updateCandidateProfile } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My profile · Skillinabox",
};

type Props = {
  searchParams: Promise<{ error?: string | string[]; saved?: string | string[] }>;
};

export default async function CareersProfilePage(props: Props) {
  const me = await requireCandidateSession({ callbackUrl: "/careers/portal/profile" });
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  const saved = firstSearchParam(searchParams.saved) === "1";

  const candidate = await prisma.hiringCandidate.findUnique({
    where: { id: me.candidateId },
  });
  if (!candidate) {
    return (
      <CareersChrome active="profile">
        <p className="text-sm text-red-700">Profile not found.</p>
      </CareersChrome>
    );
  }

  return (
    <CareersChrome active="profile">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">My profile</h1>
          <p className="text-sm text-ink-500 mt-1">
            Shared across all your applications.{" "}
            <Link href="/careers/portal/applications" className="text-sky-800 underline">
              View applications
            </Link>
          </p>
        </div>

        {saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Profile saved.
          </div>
        ) : null}
        {flashError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {decodeURIComponent(flashError)}
          </div>
        ) : null}

        <form
          action={updateCandidateProfile}
          className="space-y-8 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm"
        >
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Basic details</h2>
              <p className="text-sm text-ink-500 mt-0.5">We&apos;ll use these to reach you about next steps.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" name="fullName" required defaultValue={candidate.fullName} />
              </div>
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input id="email" value={candidate.email} disabled />
              </div>
              <div>
                <Label htmlFor="phone">Phone / WhatsApp number</Label>
                <Input id="phone" name="phone" defaultValue={candidate.phone ?? ""} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="candidateLocation">Current location</Label>
                <Input
                  id="candidateLocation"
                  name="candidateLocation"
                  defaultValue={candidate.candidateLocation ?? ""}
                  placeholder="City / region"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-ink-100 pt-6">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Resume</h2>
              <p className="text-sm text-ink-500 mt-0.5">PDF, DOC, or DOCX. Upload a new file to replace the one on file.</p>
            </div>
            <Label htmlFor="resumeFile" className="sr-only">
              Résumé file
            </Label>
            <Input id="resumeFile" name="resumeFile" type="file" accept=".pdf,.doc,.docx,application/pdf" />
            {candidate.resumeUrl ? (
              <p className="text-xs text-ink-500">
                <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                  View current résumé
                </a>
              </p>
            ) : null}
          </section>

          <section className="space-y-3 border-t border-ink-100 pt-6">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Portfolio</h2>
              <p className="text-sm text-ink-500 mt-0.5">Optional. Leave blank if you don&apos;t have one.</p>
            </div>
            <Label htmlFor="portfolioUrl">Portfolio URL</Label>
            <Input
              id="portfolioUrl"
              name="portfolioUrl"
              type="text"
              inputMode="url"
              defaultValue={candidate.portfolioUrl ?? ""}
              placeholder="https://github.com/… or a personal site"
            />
          </section>

          <Button type="submit" variant="accent" size="md">
            Save profile
          </Button>
        </form>
      </div>
    </CareersChrome>
  );
}
