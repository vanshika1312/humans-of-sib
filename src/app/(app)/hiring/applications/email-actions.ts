"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendPlainTextEmail } from "@/lib/email";

const HR_GATE = ["CEO", "ADMIN", "HR"];

async function requireHiringEmailUser() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !HR_GATE.includes(me.role)) redirect("/home");
  return me;
}

function applicationPath(applicationId: string, params: Record<string, string>) {
  const q = new URLSearchParams(params);
  return `/hiring/applications/${applicationId}?${q.toString()}#section-emails`;
}

export async function sendHiringApplicationEmail(applicationId: string, formData: FormData) {
  const me = await requireHiringEmailUser();

  const subject = String(formData.get("subject") ?? "").trim().slice(0, 500);
  const body = String(formData.get("body") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "").trim() || null;

  if (!subject) {
    redirect(applicationPath(applicationId, { emailError: encodeURIComponent("Subject is required.") }));
  }
  if (body.length < 5) {
    redirect(applicationPath(applicationId, { emailError: encodeURIComponent("Email body is too short.") }));
  }
  if (body.length > 16000) {
    redirect(applicationPath(applicationId, { emailError: encodeURIComponent("Email body is too long.") }));
  }

  const app = await prisma.hiringApplication.findUnique({
    where: { id: applicationId },
    include: {
      candidate: { select: { email: true, fullName: true } },
      job: { select: { title: true } },
      pipelineStage: { select: { label: true } },
    },
  });
  if (!app) {
    redirect(applicationPath(applicationId, { emailError: encodeURIComponent("Application not found.") }));
  }

  const toEmail = app.candidate.email.trim();
  if (!toEmail) {
    redirect(applicationPath(applicationId, { emailError: encodeURIComponent("Candidate has no email on file.") }));
  }

  try {
    await sendPlainTextEmail({ to: toEmail, subject, text: body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not send email.";
    if (msg.includes("RESEND_API_KEY") || msg.includes("BREVO_API_KEY")) {
      redirect(
        applicationPath(applicationId, {
          emailError: encodeURIComponent("Email is not configured (check RESEND / BREVO API keys)."),
        }),
      );
    }
    console.error("[Humans of SIB] hiring application email failed", err);
    redirect(applicationPath(applicationId, { emailError: encodeURIComponent("Could not send email. Try again later.") }));
  }

  await prisma.$transaction(async (tx) => {
    await tx.hiringApplicationEmail.create({
      data: {
        applicationId,
        templateId,
        toEmail,
        subject,
        body,
        sentById: me.id,
      },
    });
    await tx.hiringActivity.create({
      data: {
        kind: "APPLICATION_EMAIL_SENT",
        applicationId,
        candidateId: app.candidateId,
        summary: `Email sent: ${subject.slice(0, 120)}`,
        payloadJson: JSON.stringify({ toEmail, subject, templateId }),
        actorUserId: me.id,
      },
    });
  });

  revalidatePath(`/hiring/applications/${applicationId}`);
  revalidatePath("/hiring/activity");
  redirect(applicationPath(applicationId, { emailSent: "1" }));
}
