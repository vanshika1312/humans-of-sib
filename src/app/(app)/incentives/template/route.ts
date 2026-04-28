import { type NextRequest } from "next/server";

const TEAM_TEMPLATE = [
  ["counsellor_email", "revenue"],
  ["alice@skillinabox.com", "125000"],
  ["bob@skillinabox.com",   "98000"],
  ["carol@skillinabox.com", "210000"],
].map((r) => r.join(",")).join("\n");

export async function GET(_request: NextRequest) {
  return new Response(TEAM_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="incentives-revenue-template.csv"`,
    },
  });
}
