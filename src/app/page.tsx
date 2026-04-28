import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/home");

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md brand-gradient" />
          <span className="font-bold text-ink-700">Humans of SIB</span>
        </div>
        <Link
          href="/sign-in"
          className="text-sm font-medium text-ink-600 hover:text-sky-600"
        >
          Sign in →
        </Link>
      </header>

      <section className="flex-1 flex items-center px-6 md:px-10">
        <div className="max-w-5xl mx-auto w-full grid md:grid-cols-2 gap-10 items-center py-12">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-sky-700 bg-sky-50 px-3 py-1 rounded-full">
              ✨ Internal · Skillinabox team
            </span>
            <h1 className="mt-5 text-4xl md:text-6xl font-extrabold tracking-tight text-ink-700 leading-[1.05]">
              The home of every
              <br />
              <span className="brand-text-gradient">human at Skillinabox.</span>
            </h1>
            <p className="mt-5 text-base md:text-lg text-ink-400 max-w-lg">
              Your journey, your wins, your growth — all in one place. Log attendance,
              ship feedback to the CEO, celebrate teammates, track OKRs, and see the
              lives you&apos;ve touched.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 shadow-sm"
              >
                Sign in with Google
              </Link>
              <span className="text-xs text-ink-400">Only @skillinabox.in emails</span>
            </div>
          </div>

          <div className="relative aspect-[4/3] rounded-2xl brand-gradient confetti overflow-hidden hairline">
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />
            <div className="relative h-full p-6 md:p-8 flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-md brand-gradient" />
                <span className="font-bold text-ink-700 text-sm">Humans of SIB</span>
              </div>
              <ul className="space-y-2.5 text-sm">
                {[
                  ["🎯", "Personal Journey — your story at SIB"],
                  ["🏆", "Wins Wall — celebrate teammates"],
                  ["📣", "Direct to CEO — ideas, concerns, kudos"],
                  ["🟢", "Attendance — one-tap check-in"],
                  ["🎓", "Internal trainings + certificates"],
                  ["📊", "OKRs, pulse, 1-on-1s and more"],
                ].map(([e, t]) => (
                  <li key={t} className="flex items-center gap-3 bg-white/90 hairline rounded-lg px-3 py-2">
                    <span>{e}</span>
                    <span className="text-ink-600 font-medium">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-6 md:px-10 py-6 text-xs text-ink-400 border-t">
        Made with ❤️ by the SIB team · Empowering women across India.
      </footer>
    </main>
  );
}
