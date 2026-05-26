import assert from "node:assert/strict";
import { scoreLiaArticle } from "./lia-knowledge";

const leaveArticle = {
  title: "Leave policy overview",
  summary: "Paid leave runs in half-years with casual and sick balances.",
  body: "Casual accrues monthly. Sick is 3 per half.",
  category: "LEAVE",
  keywords: ["leave", "casual", "sick"],
};

assert.ok(scoreLiaArticle(leaveArticle, ["leave", "policy"]) > 0);
assert.ok(
  scoreLiaArticle(leaveArticle, ["leave"]) >
    scoreLiaArticle(
      { ...leaveArticle, title: "Other", keywords: [] },
      ["leave"],
    ),
);
assert.equal(scoreLiaArticle(leaveArticle, ["zzzznoterm"]), 0);

console.log("lia-knowledge: ok");
