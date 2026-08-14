import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { candidateAuth } from "@/auth-candidate";
import { firstSearchParam } from "@/lib/search-param";
import { isCandidatePortalSession, safeCandidateCallbackUrl } from "@/lib/candidate-session";
import { CareersChrome } from "../_components/careers-chrome";
import { loginCandidate } from "../actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Candidate sign-in · Skillinabox",
};

type Props = {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
};

export default async function CareersSignInPage(props: Props) {
  const searchParams = await props.searchParams;
  const callbackUrl = safeCandidateCallbackUrl(firstSearchParam(searchParams.callbackUrl));
  const flashError = firstSearchParam(searchParams.error);

  const session = await candidateAuth();
  if (isCandidatePortalSession(session)) {
    redirect(callbackUrl);
  }

  return (
    <CareersChrome active="auth">
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Candidate sign-in</h1>
          <p className="text-sm text-ink-500 mt-1">
            Track applications and update your profile.
          </p>
        </div>

        {flashError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {decodeURIComponent(flashError)}
          </div>
        ) : null}

        <form action={loginCandidate} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" variant="accent" size="md" className="w-full">
            Sign in
          </Button>
        </form>

        <p className="text-sm text-ink-600 text-center">
          New here?{" "}
          <Link
            href={`/careers/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="font-semibold text-sky-800 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </CareersChrome>
  );
}
