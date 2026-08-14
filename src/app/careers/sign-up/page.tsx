import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { candidateAuth } from "@/auth-candidate";
import { firstSearchParam } from "@/lib/search-param";
import { isCandidatePortalSession, safeCandidateCallbackUrl } from "@/lib/candidate-session";
import { CareersChrome } from "../_components/careers-chrome";
import { registerCandidate } from "../actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create candidate account · Skillinabox",
};

type Props = {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
};

export default async function CareersSignUpPage(props: Props) {
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
          <h1 className="text-2xl font-bold text-ink-900">Create your candidate account</h1>
          <p className="text-sm text-ink-500 mt-1">
            One profile for every Skillinabox application. Email and password only — no work Google account needed.
          </p>
        </div>

        {flashError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {decodeURIComponent(flashError)}
          </div>
        ) : null}

        <form action={registerCandidate} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" required autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" variant="accent" size="md" className="w-full">
            Create account
          </Button>
        </form>

        <p className="text-sm text-ink-600 text-center">
          Already registered?{" "}
          <Link
            href={`/careers/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="font-semibold text-sky-800 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </CareersChrome>
  );
}
