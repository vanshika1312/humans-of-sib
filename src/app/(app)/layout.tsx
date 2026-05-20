import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { displayName } from "@/lib/user-display-name";
import { requireAppViewer } from "@/lib/app-viewer";
import { countUnreadNotifications } from "@/lib/notifications";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { Topbar } from "@/components/shell/topbar";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { GlobalRequestLoader } from "@/components/ui/global-request-loader";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/sign-in");

  const user = await requireAppViewer();
  if (!user) redirect("/sign-in?error=not_registered");
  if (user.invitationPending) {
    redirect("/sign-in?error=pending_onboarding");
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  const unreadNotifications = await countUnreadNotifications(user.id);

  return (
    <div className="min-h-screen flex">
      <GlobalRequestLoader />
      <AppSidebar role={user.role} permissions={user.permissions ?? []} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          user={{ name: displayName(user), email: user.email, image: user.image }}
          deptName={user.department?.name}
          cityName={user.city?.name}
          unreadNotifications={unreadNotifications}
          navRole={user.role}
          navPermissions={user.permissions ?? []}
          signOutAction={signOutAction}
        />
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-6xl w-full mx-auto">
          <Suspense fallback={<RouteLoadingFallback label="Loading page…" />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
