import { type NextRequest } from "next/server";

const COUNSELLOR_TEMPLATE = [
  ["student_name", "course_name", "revenue", "sale_date", "note"],
  ["Priya Sharma", "Full-Stack Bootcamp", "25000", "2026-04-15", "Early bird"],
  ["Rahul Kumar", "Data Science Pro", "30000", "2026-04-20", ""],
].map((r) => r.join(",")).join("\n");

const TEAM_TEMPLATE = [
  ["counsellor_email", "student_name", "course_name", "revenue", "sale_date", "note"],
  ["alice@skillinabox.com", "Priya Sharma", "Full-Stack Bootcamp", "25000", "2026-04-15", "Early bird"],
  ["bob@skillinabox.com", "Rahul Kumar", "Data Science Pro", "30000", "2026-04-20", ""],
].map((r) => r.join(",")).join("\n");

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const csv = type === "team" ? TEAM_TEMPLATE : COUNSELLOR_TEMPLATE;
  const filename = type === "team" ? "incentives-team-template.csv" : "incentives-template.csv";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
