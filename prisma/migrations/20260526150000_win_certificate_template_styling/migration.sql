-- AlterTable
ALTER TABLE "WinCertificateTemplate" ADD COLUMN "stylePreset" TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE "WinCertificateTemplate" ADD COLUMN "fontFamily" TEXT NOT NULL DEFAULT 'serif';
ALTER TABLE "WinCertificateTemplate" ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#fbbf24';
ALTER TABLE "WinCertificateTemplate" ADD COLUMN "secondaryColor" TEXT NOT NULL DEFAULT '#fde68a';
ALTER TABLE "WinCertificateTemplate" ADD COLUMN "backgroundFrom" TEXT NOT NULL DEFAULT '#1e293b';
ALTER TABLE "WinCertificateTemplate" ADD COLUMN "backgroundTo" TEXT NOT NULL DEFAULT '#0f172a';
ALTER TABLE "WinCertificateTemplate" ADD COLUMN "textColor" TEXT NOT NULL DEFAULT '#e2e8f0';
ALTER TABLE "WinCertificateTemplate" ADD COLUMN "borderColor" TEXT NOT NULL DEFAULT '#fcd34d';
