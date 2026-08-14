import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { getCareersLandingContent, listCareersGalleryImages, listCareersTeamVoices } from "@/lib/careers-landing";
import { CareersLandingEditor } from "./_components/careers-landing-editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Careers landing · Hiring",
  description: "Edit the public careers culture page — copy, hero photo, and gallery.",
};

export default async function HiringCareersLandingPage() {
  const [content, gallery, voices] = await Promise.all([
    getCareersLandingContent(),
    listCareersGalleryImages(),
    listCareersTeamVoices(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        emoji="🏡"
        title="Careers landing"
        subtitle="Edit Life @ SIB copy, core-team notes, hero photo, and culture gallery. Candidates see this at /careers — no deploy needed."
        action={
          <Link
            href="/careers"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-10 px-4 rounded-lg border border-ink-200 bg-white text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Preview public page →
          </Link>
        }
      />
      <CareersLandingEditor initial={content} gallery={gallery} voices={voices} />
    </div>
  );
}
