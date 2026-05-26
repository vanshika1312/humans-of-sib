import assert from "node:assert/strict";
import {
  buildPolicyKeywords,
  inferPolicyCategory,
  orgPolicyArticleSlug,
} from "./lia-policy-ingest";

assert.equal(orgPolicyArticleSlug("doc123"), "org-policy-doc123");

assert.equal(inferPolicyCategory("Leave Policy 2025"), "LEAVE");
assert.equal(inferPolicyCategory("Code of Conduct"), "GENERAL");

const kw = buildPolicyKeywords("Casual Leave Policy");
assert.ok(kw.includes("leave"));
assert.ok(kw.includes("casual"));
assert.ok(kw.includes("policy"));

console.log("lia-policy-ingest.test.ts: ok");
