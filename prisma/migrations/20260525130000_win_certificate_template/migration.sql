CREATE TABLE "WinCertificateTemplate" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "title" TEXT NOT NULL DEFAULT 'Certificate of Achievement',
    "subtitle" TEXT NOT NULL DEFAULT 'House of Skillinabox · HoS HRMS',
    "introText" TEXT NOT NULL DEFAULT 'This certificate is proudly awarded to',
    "recognitionPrefix" TEXT NOT NULL DEFAULT 'in recognition of',
    "signatoryName" TEXT NOT NULL DEFAULT 'CEO, Skillinabox',
    "signatoryTitle" TEXT NOT NULL DEFAULT 'Authorised Signatory',
    "backgroundImageUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WinCertificateTemplate_pkey" PRIMARY KEY ("id")
);

INSERT INTO "WinCertificateTemplate" ("id", "updatedAt")
VALUES ('singleton', CURRENT_TIMESTAMP);
