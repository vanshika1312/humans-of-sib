import type { LiaKnowledgeCategory } from "@/generated/prisma";

export type LiaCoreDocumentDef = {
  slug: string;
  title: string;
  category: LiaKnowledgeCategory;
  sortOrder: number;
  keywords: string[];
  detailHref?: string;
  /** Short HR-facing note on the admin list */
  adminHint: string;
  summary: string;
  body: string;
};

export const LIA_CORE_DOCUMENTS: readonly LiaCoreDocumentDef[] = [
  {
    slug: "leave-policy-overview",
    title: "Leave policy overview",
    category: "LEAVE",
    sortOrder: 10,
    keywords: ["leave", "casual", "sick", "probation", "half-year", "balance", "paid leave"],
    detailHref: "/attendance?tab=requests",
    adminHint: "Half-year casual/sick rules, probation, and how to apply leave.",
    summary:
      "Paid leave runs in half-years (Jan–Jun and Jul–Dec). On probation you cannot use paid casual or sick until probation ends. After confirmation you accrue 1 casual day per calendar month of service within the half (unused casual rolls within the half). Sick leave is 3 days per half. Balances reset after 30 June and 31 December.",
    body: `Half-year periods:
- H1: January through June (resets after 30 June)
- H2: July through December (resets after 31 December)

Casual leave:
- Accrues 1 day per calendar month you are in service during the half (max 6 per half)
- Unused casual within a half carries forward within that half only
- Not available during probation

Sick leave:
- 3 days per half-year for confirmed employees
- Not available during probation

Applying leave:
- Use Attendance → Requests tab to submit casual, sick, unpaid, or half-day leave
- Your manager approves; paid days deduct from your leave bank for weekdays in the range
- HR sets your probation end date on your profile`,
  },
  {
    slug: "sick-leave-medical-proof",
    title: "Sick leave — when medical proof is required",
    category: "LEAVE",
    sortOrder: 20,
    keywords: ["sick", "medical", "certificate", "proof", "doctor"],
    detailHref: "/attendance?tab=requests",
    adminHint: "When members must attach medical proof on sick leave requests.",
    summary:
      "Sick leave may require a medical document link when the booking spans 2 or more working days, or when it immediately follows another approved sick spell without a working day in between.",
    body: `Medical proof rules:
- Required when sick leave covers 2+ working days in one request
- Also required when your new sick start date is the working day right after a prior approved sick spell ended (chained sick)

How to submit:
- Apply for sick leave on Attendance → Requests
- If proof is required, add a Drive or document link in the medical proof field before your manager can approve`,
  },
  {
    slug: "attendance-check-in",
    title: "Attendance check-in and working days",
    category: "ATTENDANCE",
    sortOrder: 30,
    keywords: ["attendance", "check-in", "check-out", "wfh", "office", "biometric", "late"],
    detailHref: "/attendance",
    adminHint: "Check-in, WFH, working days, lateness, and regularisation.",
    summary:
      "Check in from Attendance with Office or WFH mode. Working days are Monday–Saturday; Sunday is off. Late arrival is flagged when first check-in is after 10:10 IST. Biometric punches can sync via a secure webhook configured by HR/IT.",
    body: `Daily attendance:
- Check in and check out from the Attendance page
- Modes: Office or Work from home (WFH)
- Optional note on check-in

Calendar rules (payroll-aligned):
- Mon–Sat are working days; Sunday is off
- Late: first check-in after 10:10 IST
- Half-day may apply when worked hours fall between policy thresholds

Regularisation:
- Use the regularisation flow if you missed a punch or need a correction

Biometric:
- Office hardware can push punches via webhook when configured`,
  },
  {
    slug: "pulse-weekly-check-in",
    title: "Pulse — weekly check-in",
    category: "PULSE",
    sortOrder: 40,
    keywords: ["pulse", "weekly", "mood", "check-in", "survey"],
    detailHref: "/pulse",
    adminHint: "How Pulse works and what members should expect each week.",
    summary:
      "Pulse is a short weekly check-in on the Pulse page. Submit your response before the week closes; scores roll up for leadership trends only — individual comments stay private.",
    body: `Weekly Pulse:
- Open Pulse from the sidebar each week when the form is open
- Answer the question and optional follow-ups honestly
- Submissions close at the end of the pulse week (IST)

Privacy:
- Aggregated scores may appear in admin trends
- Free-text comments are not shown to managers in admin reports

Tips:
- If you miss a week, you can still participate when the next week opens`,
  },
  {
    slug: "benefits-overview",
    title: "Benefits overview",
    category: "BENEFITS",
    sortOrder: 50,
    keywords: ["benefits", "insurance", "health", "esop", "perks"],
    adminHint: "High-level benefits pointers; link out to full policy docs.",
    summary:
      "Skillinabox benefits include health coverage and other perks as communicated by HR. For personal enrollment status or letters, check My Documents or email hr@skillinabox.in.",
    body: `Benefits on HoS:
- Offer letters, payslips, and tax forms live under My Documents when HR uploads them
- ESOP or grant details appear when shared to your profile

Questions:
- Enrollment changes, dependents, or exceptions: contact HR at hr@skillinabox.in
- Add an external benefits handbook URL below so LIA can link members to the full guide`,
  },
  {
    slug: "code-of-conduct",
    title: "Code of conduct",
    category: "CULTURE",
    sortOrder: 60,
    keywords: ["conduct", "coc", "ethics", "harassment", "policy", "workplace", "behavior"],
    adminHint: "Org-wide CoC — upload the signed PDF and keep the summary aligned with it.",
    summary:
      "Skillinabox’s code of conduct sets expectations for professional behavior, respect, and compliance. All members are expected to follow it. Upload the official PDF below; LIA will link members to the full document.",
    body: `Code of conduct:
- Applies to all employees and contractors while representing Skillinabox
- Covers respectful workplace behavior, conflicts of interest, confidentiality, and anti-harassment expectations
- Violations should be reported to HR or your manager

For members:
- Read the full code of conduct using the document link LIA provides
- Questions or concerns: contact HR at hr@skillinabox.in`,
  },
] as const;

export const LIA_CORE_DOCUMENT_SLUGS = new Set(LIA_CORE_DOCUMENTS.map((d) => d.slug));

export function getLiaCoreDocument(slug: string): LiaCoreDocumentDef | undefined {
  return LIA_CORE_DOCUMENTS.find((d) => d.slug === slug);
}
