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
import { LiaAppShell } from "@/components/lia/lia-app-shell";
import { isLiaEnabled } from "@/lib/lia-config";
import { isEmployeeProfileComplete } from "@/lib/employee-self-profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/sign-in");

  const user = await requireAppViewer();
  if (!user) redirect("/sign-in?error=not_registered");
  if (!isEmployeeProfileComplete(user)) {
    redirect("/complete-profile");
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  const unreadNotifications = await countUnreadNotifications(user.id);
  const liaEnabled = isLiaEnabled();

  return (
    <div className="min-h-screen flex">
      <GlobalRequestLoader />
      <AppSidebar role={user.role} permissions={user.permissions ?? []} liaEnabled={liaEnabled} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          user={{ name: displayName(user), email: user.email, image: user.image }}
          deptName={user.department?.name}
          cityName={user.city?.name}
          unreadNotifications={unreadNotifications}
          navRole={user.role}
          navPermissions={user.permissions ?? []}
          liaEnabled={liaEnabled}
          signOutAction={signOutAction}
        />
        <main className="flex-1 w-full px-4 md:px-8 2xl:px-12 py-6 md:py-8 max-w-[1400px] 2xl:max-w-[1600px] mx-auto has-[[data-app-fullwidth]]:max-w-none has-[[data-app-fullwidth]]:mx-0 lg:has-[[data-app-fullwidth]]:py-0">
          <Suspense fallback={<RouteLoadingFallback label="Loading page…" />}>{children}</Suspense>
        </main>
        <LiaAppShell />
      </div>
    </div>
  );
}
