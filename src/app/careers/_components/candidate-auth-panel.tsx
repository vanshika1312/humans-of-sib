"use client";

import Link from "next/link";
import { loginCandidate, registerCandidate } from "../actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function CandidateAuthPanel({
  callbackUrl,
  mode,
  flashError,
  signInHref,
  signUpHref,
  onSwitchMode,
  chrome = "card",
}: {
  callbackUrl: string;
  mode: "register" | "signin";
  flashError?: string;
  signInHref?: string;
  signUpHref?: string;
  onSwitchMode?: (mode: "register" | "signin") => void;
  chrome?: "card" | "plain";
}) {
  const isSignIn = mode === "signin";

  function switchTo(next: "register" | "signin") {
    if (onSwitchMode) {
      onSwitchMode(next);
      return;
    }
  }

  const switchControl = isSignIn ? (
    onSwitchMode ? (
      <button
        type="button"
        onClick={() => switchTo("register")}
        className="font-semibold text-sky-800 hover:underline"
      >
        Create an account
      </button>
    ) : (
      <Link href={signUpHref ?? "/careers/sign-up"} className="font-semibold text-sky-800 hover:underline">
        Create an account
      </Link>
    )
  ) : onSwitchMode ? (
    <button
      type="button"
      onClick={() => switchTo("signin")}
      className="font-semibold text-sky-800 hover:underline"
    >
      Sign in
    </button>
  ) : (
    <Link href={signInHref ?? "/careers/sign-in"} className="font-semibold text-sky-800 hover:underline">
      Sign in
    </Link>
  );

  return (
    <div
      className={
        chrome === "card"
          ? "space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm"
          : "space-y-4"
      }
    >
      <div>
        <h2 id="candidate-auth-heading" className="text-lg font-semibold text-ink-900">
          {isSignIn ? "Sign in to apply" : "Create an account to apply"}
        </h2>
        <p className="text-sm text-ink-500 mt-1">
          {isSignIn
            ? "Use the email and password from your candidate account."
            : "You’ll continue to your profile to finish this application."}
        </p>
      </div>

      {flashError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(flashError)}
        </div>
      ) : null}

      {isSignIn ? (
        <form action={loginCandidate} className="space-y-4">
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
            Sign in and continue
          </Button>
        </form>
      ) : (
        <form action={registerCandidate} className="space-y-4">
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
            Create account and continue
          </Button>
        </form>
      )}

      <p className="text-sm text-ink-600 text-center">
        {isSignIn ? (
          <>
            New here? {switchControl}
          </>
        ) : (
          <>
            Already registered? {switchControl}
          </>
        )}
      </p>
    </div>
  );
}
