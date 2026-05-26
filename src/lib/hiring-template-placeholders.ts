export const HIRING_TEMPLATE_PLACEHOLDER_HINTS = [
  { token: "{{candidateName}}", desc: "Candidate full name" },
  { token: "{{candidateEmail}}", desc: "Candidate email" },
  { token: "{{jobTitle}}", desc: "Role / job title" },
  { token: "{{stageLabel}}", desc: "Current pipeline stage" },
  { token: "{{recruiterName}}", desc: "Your name (sender)" },
  { token: "{{companyName}}", desc: "Company name (defaults to SIB)" },
] as const;
