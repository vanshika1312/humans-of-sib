import { type NextRequest } from "next/server";

// Columns:
//  counsellor_email  – required; must match the user's login email
//  revenue           – required; total adjusted revenue for the month (integer, ≥0)
//  monthly_target    – optional; revenue target set for this counsellor (integer, ≥0)
//  adjustment        – optional; flat ₹ adjustment to the calculated incentive (can be negative for deductions)
//  adjustment_note   – optional; reason for the adjustment (free text)
//  team              – informational only; not imported (city of the counsellor)
//  cluster           – informational only; not imported (department of the counsellor)

const HEADERS = [
  "counsellor_email",
  "revenue",
  "monthly_target",
  "adjustment",
  "adjustment_note",
  "team",
  "cluster",
];

const EXAMPLES = [
  ["alice@skillinabox.in",  "125000", "150000",  "0",      "",                              "Delhi",  "Sales"],
  ["bob@skillinabox.in",    "98000",  "100000",  "-2000",  "Refund – order #1042 reversed", "Mumbai", "Counselling"],
  ["carol@skillinabox.in",  "210000", "200000",  "5000",   "Bonus for referral close",      "Pune",   "Sales"],
  ["dave@skillinabox.in",   "0",      "80000",   "0",      "",                              "Delhi",  "Counselling"],
];

const TEMPLATE = [HEADERS, ...EXAMPLES].map((r) => r.join(",")).join("\n");

export async function GET(_request: NextRequest) {
  return new Response(TEMPLATE, {
    headers: {
      "Content-Type":        "text/csv",
      "Content-Disposition": `attachment; filename="incentives-template.csv"`,
    },
  });
}
