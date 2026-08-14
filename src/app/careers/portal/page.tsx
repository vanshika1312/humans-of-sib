import { redirect } from "next/navigation";
import { requireCandidateSession } from "@/lib/candidate-session";

export const dynamic = "force-dynamic";

/** Hub — send candidates to applications list. */
export default async function CareersPortalHome() {
  await requireCandidateSession({ callbackUrl: "/careers/portal" });
  redirect("/careers/portal/applications");
}
