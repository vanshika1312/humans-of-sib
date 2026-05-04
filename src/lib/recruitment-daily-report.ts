import { prisma } from "@/lib/prisma";

/** yyyy-mm-dd in UTC (matches HTML `<input type="date">`). */
export function utcCalendarToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Distinct recruiter/location picks from saved reports plus roster helpers. */
export async function getRecruitmentDailyReportSuggestions(): Promise<{
  recruiters: string[];
  locations: string[];
}> {
  const [fromRecruiters, fromLocations, roster, cities] = await Promise.all([
    prisma.recruitmentDailyReport.groupBy({
      by: ["recruiterName"],
      where: { recruiterName: { not: "" } },
    }),
    prisma.recruitmentDailyReport.groupBy({
      by: ["locationName"],
      where: { locationName: { not: "" } },
    }),
    prisma.user.findMany({
      where: {
        role: { in: ["CEO", "ADMIN", "HR"] },
        status: "ACTIVE",
        name: { not: null },
      },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.city.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const recruiters = uniqueSortedStrings([
    ...fromRecruiters.map((r) => r.recruiterName),
    ...roster.map((u) => u.name ?? ""),
  ]);
  const locations = uniqueSortedStrings([
    ...fromLocations.map((r) => r.locationName),
    ...cities.map((c) => c.name),
  ]);

  return { recruiters, locations };
}

function uniqueSortedStrings(values: string[]): string[] {
  const s = new Set<string>();
  for (const raw of values) {
    const t = raw.trim();
    if (t.length > 0) s.add(t);
  }
  return [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
