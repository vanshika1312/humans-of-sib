import { redirect } from "next/navigation";

/** Legacy route — profiles are captured only via Add candidate form. */
export default function HiringCandidatesLegacyRedirectPage() {
  redirect("/hiring/candidates/new");
}
