import type { Metadata } from "next";
import { CareersChrome } from "./_components/careers-chrome";
import { CareersLandingHero, CareersLifeSection } from "./_components/careers-landing-sections";
import { getCareersLandingContent, listCareersGalleryImages, listCareersTeamVoices } from "@/lib/careers-landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join Skillinabox",
  description: "Life at Skillinabox — join a team building equitable skilling across India.",
};

export default async function CareersPage() {
  const [content, images, voices] = await Promise.all([
    getCareersLandingContent(),
    listCareersGalleryImages({ publishedOnly: true }),
    listCareersTeamVoices({ publishedOnly: true }),
  ]);

  return (
    <CareersChrome active="home" fullBleed>
      <CareersLandingHero content={content} />
      <CareersLifeSection content={content} images={images} voices={voices} />
    </CareersChrome>
  );
}
