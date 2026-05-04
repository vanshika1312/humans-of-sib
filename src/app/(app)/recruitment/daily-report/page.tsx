import { redirect } from "next/navigation";

/** Old URL; forwards query to the overview (form lives on `/recruitment`). */
export default async function RecruitmentDailyReportRedirectPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await props.searchParams;
  const qs = new URLSearchParams();
  if (saved === "1") qs.set("dailyReportSaved", "1");
  if (typeof error === "string" && error.length > 0) {
    qs.set("dailyReportError", error);
  }
  redirect(qs.size > 0 ? `/recruitment?${qs.toString()}` : "/recruitment");
}