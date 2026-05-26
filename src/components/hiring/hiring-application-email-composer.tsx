"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { CopyTextButton } from "@/components/ui/copy-text-button";
import { HIRING_EMAIL_PURPOSE_LABEL, type HiringEmailPurpose } from "@/lib/hiring-email-purpose";
import { mergeHiringTemplate, type HiringTemplateMergeContext } from "@/lib/hiring-template-merge";
import { PlaceholderCheatsheet } from "@/app/(app)/hiring/templates/_components/placeholder-cheatsheet";
import { sendHiringApplicationEmail } from "@/app/(app)/hiring/applications/email-actions";
import { formatDate } from "@/lib/utils";

export type EmailTemplateOption = {
  id: string;
  title: string;
  subject: string;
  body: string;
  emailPurpose: HiringEmailPurpose;
};

type SentEmailRow = {
  id: string;
  subject: string;
  toEmail: string;
  sentAt: Date;
  sentBy: { name: string | null; email: string | null };
};

function sortTemplatesForStage(
  templates: EmailTemplateOption[],
  stage: { isRejected: boolean; isHired: boolean },
): EmailTemplateOption[] {
  const priority: HiringEmailPurpose[] = stage.isRejected
    ? ["REJECTED", "OTHER", "OUTREACH", "INTERVIEW_INVITE", "SHORTLISTED", "OFFER"]
    : stage.isHired
      ? ["OFFER", "SHORTLISTED", "INTERVIEW_INVITE", "OUTREACH", "OTHER", "REJECTED"]
      : ["INTERVIEW_INVITE", "SHORTLISTED", "OUTREACH", "OFFER", "REJECTED", "OTHER"];

  const rank = new Map(priority.map((p, i) => [p, i]));
  return [...templates].sort((a, b) => (rank.get(a.emailPurpose) ?? 99) - (rank.get(b.emailPurpose) ?? 99));
}

export function HiringApplicationEmailComposer({
  applicationId,
  candidateEmail,
  mergeContext,
  templates,
  sentEmails,
  canSend,
  stageFlags,
}: {
  applicationId: string;
  candidateEmail: string;
  mergeContext: HiringTemplateMergeContext;
  templates: EmailTemplateOption[];
  sentEmails: SentEmailRow[];
  canSend: boolean;
  stageFlags: { isRejected: boolean; isHired: boolean };
}) {
  const sorted = useMemo(() => sortTemplatesForStage(templates, stageFlags), [templates, stageFlags]);

  const [templateId, setTemplateId] = useState(sorted[0]?.id ?? "");
  const selected = templates.find((t) => t.id === templateId);

  const merged = useMemo(() => {
    if (!selected) return { subject: "", body: "" };
    return {
      subject: mergeHiringTemplate(selected.subject, mergeContext),
      body: mergeHiringTemplate(selected.body, mergeContext),
    };
  }, [selected, mergeContext]);

  const [subject, setSubject] = useState(merged.subject);
  const [body, setBody] = useState(merged.body);

  const applySelected = () => {
    setSubject(merged.subject);
    setBody(merged.body);
  };

  const mailtoHref =
    subject || body
      ? `mailto:${encodeURIComponent(candidateEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : `mailto:${encodeURIComponent(candidateEmail)}`;

  const sendAction = sendHiringApplicationEmail.bind(null, applicationId);

  return (
    <div className="space-y-6">
      {sentEmails.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Sent from Humans of SIB</p>
          <ul className="space-y-2 text-sm">
            {sentEmails.map((e) => (
              <li key={e.id} className="rounded-lg border border-ink-100 bg-ink-50/50 px-3 py-2">
                <div className="font-medium text-ink-800">{e.subject}</div>
                <div className="text-[11px] text-ink-400 mt-0.5">
                  To {e.toEmail} · {formatDate(e.sentAt)} · {e.sentBy.name ?? e.sentBy.email ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50/50 p-4 text-sm text-ink-600">
          No email templates yet.{" "}
          <Link href="/hiring/templates?tab=email" className="font-semibold text-sky-700 hover:underline">
            Create templates
          </Link>{" "}
          for shortlisted, rejected, and other purposes.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="email-template-select">Email template</Label>
              <Select
                id="email-template-select"
                className="mt-1.5"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {sorted.map((t) => (
                  <option key={t.id} value={t.id}>
                    {HIRING_EMAIL_PURPOSE_LABEL[t.emailPurpose]} — {t.title}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={applySelected}>
              Load into editor
            </Button>
            <Link href="/hiring/templates?tab=email" className="text-xs font-semibold text-sky-700 hover:underline pb-2">
              Manage templates
            </Link>
          </div>

          <PlaceholderCheatsheet className="rounded-lg border border-ink-100 bg-ink-50/40 p-3" />

          <form action={canSend ? sendAction : undefined} className="space-y-4">
            {canSend ? <input type="hidden" name="templateId" value={templateId} /> : null}
            <div className="rounded-xl border border-ink-100 bg-white p-4 space-y-4">
              <div>
                <Label htmlFor="composer-subject">Subject</Label>
                <Input
                  id="composer-subject"
                  name={canSend ? "subject" : undefined}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="composer-body">Body</Label>
                <Textarea
                  id="composer-body"
                  name={canSend ? "body" : undefined}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="mt-1.5 font-mono text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyTextButton label="Copy subject" copiedLabel="Copied!" text={subject} />
                <CopyTextButton label="Copy body" copiedLabel="Copied!" text={body} />
                <CopyTextButton label="Copy both" copiedLabel="Copied!" text={`Subject: ${subject}\n\n${body}`} />
                <Button asChild variant="outline" size="sm" type="button">
                  <a href={mailtoHref}>Open in mail client</a>
                </Button>
              </div>
            </div>

            {canSend ? (
              <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-4 space-y-3">
                <p className="text-sm text-ink-600">
                  Send to <strong>{candidateEmail}</strong> from your configured email provider (Resend / Brevo).
                </p>
                <Button type="submit" variant="accent" size="sm">
                  Send email
                </Button>
              </div>
            ) : (
              <p className="text-xs text-ink-500">Only HR / Admin can send email from the app. You can still copy or use your mail client.</p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
