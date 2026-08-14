-- Adjustable dark wash over the careers hero group photo (0 = bright, 100 = strongest).

ALTER TABLE "CareersLandingContent" ADD COLUMN "heroOverlayOpacity" INTEGER NOT NULL DEFAULT 40;
