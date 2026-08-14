"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logoutCandidate } from "@/app/careers/actions";
import { cn } from "@/lib/utils";

type Active = "home" | "jobs" | "portal" | "profile" | "applications" | "auth";

function NavLink({
  href,
  children,
  isActive,
  overlay,
}: {
  href: string;
  children: React.ReactNode;
  isActive: boolean;
  overlay: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        overlay
          ? isActive
            ? "bg-white/20 text-white"
            : "text-white/80 hover:bg-white/10 hover:text-white"
          : isActive
            ? "bg-sky-50 text-sky-900"
            : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
      )}
    >
      {children}
    </Link>
  );
}

export function CareersSiteHeader({
  active,
  fullBleed = false,
  isCandidate,
}: {
  active?: Active;
  fullBleed?: boolean;
  isCandidate: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!fullBleed) return;
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [fullBleed]);

  const overlay = Boolean(fullBleed) && !scrolled;

  return (
    <header
      className={cn(
        "z-30 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300",
        fullBleed ? "fixed inset-x-0 top-0" : "sticky top-0",
        overlay
          ? "border-b border-white/10 bg-gradient-to-b from-black/50 to-transparent"
          : "border-b border-ink-100 bg-white/90 shadow-[0_8px_30px_-24px_rgba(0,0,0,0.35)] backdrop-blur-md",
      )}
    >
      <div
        className={cn(
          "mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8",
          fullBleed ? "max-w-6xl" : "max-w-3xl",
        )}
      >
        <Link href="/careers" className="group flex items-center gap-2.5">
          <span className="size-8 rounded-lg brand-gradient shadow-sm" aria-hidden />
          <span
            className={cn(
              "text-lg font-bold tracking-tight transition-colors",
              overlay ? "text-white" : "text-ink-900 group-hover:text-sky-800",
            )}
          >
            Skillinabox
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <NavLink href="/careers" isActive={active === "home"} overlay={overlay}>
            Life @ SIB
          </NavLink>
          <NavLink href="/careers/jobs" isActive={active === "jobs"} overlay={overlay}>
            Open roles
          </NavLink>
          {isCandidate ? (
            <>
              <NavLink
                href="/careers/portal/applications"
                isActive={active === "applications" || active === "portal"}
                overlay={overlay}
              >
                My applications
              </NavLink>
              <NavLink href="/careers/portal/profile" isActive={active === "profile"} overlay={overlay}>
                Profile
              </NavLink>
              <form action={logoutCandidate}>
                <button
                  type="submit"
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    overlay ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
                  )}
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/careers/sign-in"
              className={cn(
                "ml-1 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                overlay
                  ? "border border-white/40 bg-white/10 text-white hover:bg-white/20"
                  : active === "auth"
                    ? "bg-sky-600 text-white hover:bg-sky-700"
                    : "border border-ink-200 bg-white text-ink-800 hover:border-sky-300 hover:text-sky-800",
              )}
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
