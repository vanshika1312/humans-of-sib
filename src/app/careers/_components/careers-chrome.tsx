import { candidateAuth } from "@/auth-candidate";
import { isCandidatePortalSession } from "@/lib/candidate-session";
import { cn } from "@/lib/utils";
import { CareersSiteHeader } from "./careers-site-header";

export async function CareersChrome({
  children,
  active,
  fullBleed = false,
}: {
  children: React.ReactNode;
  active?: "home" | "jobs" | "portal" | "profile" | "applications" | "auth";
  fullBleed?: boolean;
}) {
  const session = await candidateAuth();
  const isCandidate = isCandidatePortalSession(session);

  return (
    <div className={cn("min-h-screen text-ink-800", fullBleed ? "bg-white" : "bg-gradient-to-b from-sky-50/80 to-white")}>
      <CareersSiteHeader active={active} fullBleed={fullBleed} isCandidate={isCandidate} />
      <main className={cn(fullBleed ? "w-full" : "max-w-3xl mx-auto px-4 py-10")}>{children}</main>
    </div>
  );
}
