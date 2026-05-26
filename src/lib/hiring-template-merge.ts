export type HiringTemplateMergeContext = {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  stageLabel: string;
  recruiterName: string;
  companyName?: string;
};

const TOKEN_MAP: Record<string, keyof HiringTemplateMergeContext> = {
  candidatename: "candidateName",
  name: "candidateName",
  candidateemail: "candidateEmail",
  email: "candidateEmail",
  jobtitle: "jobTitle",
  role: "jobTitle",
  stagelabel: "stageLabel",
  stage: "stageLabel",
  recruitername: "recruiterName",
  recruiter: "recruiterName",
  companyname: "companyName",
  company: "companyName",
};

/**
 * Replaces `{{token}}` placeholders (case-insensitive). Unknown tokens are left as-is.
 */
export function mergeHiringTemplate(template: string, ctx: HiringTemplateMergeContext): string {
  const company = ctx.companyName ?? "SIB";
  const fullCtx: HiringTemplateMergeContext = { ...ctx, companyName: company };

  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (match, rawToken: string) => {
    const key = TOKEN_MAP[rawToken.toLowerCase()];
    if (!key) return match;
    const value = fullCtx[key];
    return value != null && String(value).length > 0 ? String(value) : match;
  });
}
