import { redirect } from "next/navigation";
import { firstSearchParam } from "@/lib/search-param";
import { safeCandidateCallbackUrl } from "@/lib/candidate-session";

/** Auth.js default path is `/signin`; keep that from 404ing. */
export default async function AuthJsSignInAlias({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>;
}) {
  const sp = await searchParams;
  const callbackUrl = firstSearchParam(sp.callbackUrl) || "";
  const error = firstSearchParam(sp.error);
  const qs = new URLSearchParams();
  if (error) qs.set("error", error);

  if (callbackUrl.startsWith("/careers")) {
    qs.set("callbackUrl", safeCandidateCallbackUrl(callbackUrl));
    const tail = qs.toString();
    redirect(tail ? `/careers/sign-in?${tail}` : "/careers/sign-in");
  }

  if (callbackUrl) qs.set("callbackUrl", callbackUrl);
  const tail = qs.toString();
  redirect(tail ? `/sign-in?${tail}` : "/sign-in");
}
