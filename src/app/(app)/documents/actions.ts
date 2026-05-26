"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { canUploadDocument } from "@/lib/member-documents";
import { persistLiaPolicyDocumentFile } from "@/lib/lia-document-upload";
import { ingestOrgPolicyDocument } from "@/lib/lia-policy-ingest";

const documentTypes = [
  "OFFER_LETTER",
  "APPOINTMENT_LETTER",
  "APPRECIATION",
  "PAYSLIP",
  "FORM_16",
  "ID_PROOF",
  "ADDRESS_PROOF",
  "NDA",
  "ESOP",
  "POLICY",
  "CERTIFICATE",
  "OTHER",
] as const;

const uploadSchema = z.object({
  scope: z.enum(["PERSONAL", "FOR_ALL"]),
  targetUserId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(280),
  type: z.enum(documentTypes),
});

export async function uploadMemberDocument(formData: FormData) {
  const me = await requireAppViewer();
  if (!me) redirect("/login");

  const parsed = uploadSchema.safeParse({
    scope: String(formData.get("scope") ?? ""),
    targetUserId: String(formData.get("targetUserId") ?? "").trim() || undefined,
    title: String(formData.get("title") ?? ""),
    type: String(formData.get("type") ?? ""),
  });

  if (!parsed.success) redirect("/documents?error=invalid");

  const { scope, title, type } = parsed.data;
  const targetUserId = scope === "PERSONAL" ? (parsed.data.targetUserId ?? me.id) : me.id;

  if (!canUploadDocument(me, { scope, targetUserId })) {
    redirect("/documents?error=forbidden");
  }

  if (scope === "PERSONAL") {
    const owner = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, status: true },
    });
    if (!owner || owner.status !== "ACTIVE") redirect("/documents?error=invalid-member");
  }

  const file = formData.get("file");
  const uploaded = await persistLiaPolicyDocumentFile(file);
  if (!uploaded.ok) {
    if (uploaded.code === "TOO_LARGE") redirect("/documents?error=upload-too-large");
    if (uploaded.code === "EMPTY") redirect("/documents?error=upload-empty");
    redirect("/documents?error=upload-unsupported");
  }

  const sizeBytes = file instanceof File ? file.size : undefined;
  const mimeType = file instanceof File && file.type ? file.type.slice(0, 120) : undefined;
  const fileName = file instanceof File ? file.name : "policy.pdf";

  const doc = await prisma.document.create({
    data: {
      scope,
      userId: scope === "PERSONAL" ? targetUserId : null,
      uploadedById: me.id,
      type,
      title,
      url: uploaded.url,
      sizeBytes,
      mimeType,
    },
  });

  let liaWarn: string | undefined;
  if (scope === "FOR_ALL" && type === "POLICY" && file instanceof File) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ingested = await ingestOrgPolicyDocument({
      documentId: doc.id,
      title,
      detailUrl: uploaded.url,
      updatedById: me.id,
      buffer,
      fileName,
    });
    if (ingested.ok && ingested.extractionWarning) {
      liaWarn = "lia-no-text";
    }
    revalidatePath("/admin/lia");
  }

  revalidatePath("/documents");
  const qs = new URLSearchParams({ uploaded: "1" });
  if (liaWarn) qs.set("warn", liaWarn);
  redirect(`/documents?${qs.toString()}`);
}
