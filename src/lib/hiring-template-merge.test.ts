import assert from "node:assert/strict";
import { mergeHiringTemplate } from "./hiring-template-merge";

const ctx = {
  candidateName: "Alex Rivera",
  candidateEmail: "alex@example.com",
  jobTitle: "Designer",
  stageLabel: "Interview",
  recruiterName: "Sam HR",
};

assert.equal(
  mergeHiringTemplate("Hi {{candidateName}}, role: {{jobTitle}}", ctx),
  "Hi Alex Rivera, role: Designer",
);

assert.equal(
  mergeHiringTemplate("Hi {{NAME}}, from {{CompanyName}}", ctx),
  "Hi Alex Rivera, from SIB",
);

assert.equal(mergeHiringTemplate("Unknown {{foo}} stays", ctx), "Unknown {{foo}} stays");

console.log("hiring-template-merge: ok");
