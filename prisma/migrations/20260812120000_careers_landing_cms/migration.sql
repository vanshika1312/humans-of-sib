-- Careers culture landing CMS (HR-editable copy + gallery)

CREATE TYPE "CareersGallerySection" AS ENUM ('LIFE', 'CULTURE');

CREATE TABLE "CareersLandingContent" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "brandLabel" VARCHAR(120) NOT NULL DEFAULT 'Skillinabox',
    "heroHeadline" VARCHAR(240) NOT NULL DEFAULT 'Build skills. Change lives.',
    "heroSubcopy" TEXT NOT NULL DEFAULT 'Join a team that believes in equitable skilling across India.',
    "heroImageUrl" VARCHAR(2048),
    "primaryCtaLabel" VARCHAR(80) NOT NULL DEFAULT 'Join the team',
    "primaryCtaHref" VARCHAR(500) NOT NULL DEFAULT '/careers/sign-up',
    "secondaryCtaLabel" VARCHAR(80) NOT NULL DEFAULT 'See open roles',
    "secondaryCtaHref" VARCHAR(500) NOT NULL DEFAULT '/careers/jobs',
    "lifeTitle" VARCHAR(160) NOT NULL DEFAULT 'Life @ SIB',
    "lifeBody" TEXT NOT NULL DEFAULT 'We work hard, celebrate loudly, and keep learners at the center of everything we ship.',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareersLandingContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareersGalleryImage" (
    "id" TEXT NOT NULL,
    "imageUrl" VARCHAR(2048) NOT NULL,
    "caption" VARCHAR(240),
    "alt" VARCHAR(240) NOT NULL DEFAULT '',
    "section" "CareersGallerySection" NOT NULL DEFAULT 'LIFE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareersGalleryImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareersGalleryImage_section_published_sortOrder_idx" ON "CareersGalleryImage"("section", "published", "sortOrder");

ALTER TABLE "CareersLandingContent" ADD CONSTRAINT "CareersLandingContent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "CareersLandingContent" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
