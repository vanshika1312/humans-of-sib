import Link from "next/link";
import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/home");
  const params = await searchParams;
  const error = params.error;
  const callbackUrl = params.callbackUrl || "/home";

  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <section className="relative hidden md:block brand-gradient confetti">
        <div className="absolute inset-0 bg-ink-700/30" />
        <div className="relative h-full p-10 flex flex-col justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-md bg-white/90" />
            <span className="font-bold">Humans of SIB</span>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-bold max-w-md leading-tight">
              &ldquo;We don&apos;t just build a company. We build lives.&rdquo;
            </p>
            <p className="mt-3 text-sm text-white/80">Welcome back, human.</p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="flex md:hidden items-center gap-2 mb-8">
            <div className="size-8 rounded-md brand-gradient" />
            <span className="font-bold text-ink-700">Humans of SIB</span>
          </div>
          <h1 className="text-3xl font-bold text-ink-700">Sign in</h1>
          <p className="text-sm text-ink-400 mt-1.5">
            Use your <span className="font-medium text-ink-600">@skillinabox.in</span> Google account.
          </p>

          {error && (
            <div className="mt-5 rounded-md bg-red-50 text-red-700 text-sm px-4 py-3">
              {error === "domain"
                ? "Only @skillinabox.in emails can access Humans of SIB."
                : error === "not_registered"
                ? "You haven't been added to Humans of SIB yet. Ask HR to set up your account."
                : "Sign-in failed. Please try again."}
            </div>
          )}

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
            className="mt-6"
          >
            <button
              type="submit"
              className="w-full h-12 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 text-ink-600 font-medium flex items-center justify-center gap-3 transition-colors"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </form>

          <p className="mt-6 text-xs text-ink-400">
            Need access?{" "}
            <a className="text-sky-600 hover:underline" href="mailto:hr@skillinabox.in">
              Ping HR
            </a>
            .
          </p>

          <Link href="/" className="mt-8 inline-block text-xs text-ink-400 hover:text-ink-600">
            ← Back
          </Link>
        </div>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.55c2.08-1.92 3.29-4.74 3.29-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.55-2.77c-.98.66-2.24 1.06-3.73 1.06-2.87 0-5.3-1.94-6.17-4.55H2.18v2.86A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.83 14.08A6.6 6.6 0 0 1 5.47 12c0-.72.13-1.42.36-2.08V7.06H2.18a11 11 0 0 0 0 9.88l3.65-2.86z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.65 2.86C6.7 7.3 9.13 5.38 12 5.38z"/>
    </svg>
  );
}
