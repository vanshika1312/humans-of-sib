import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/user-display-name";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { department: true, city: true },
  });

  if (!user) redirect("/sign-in?error=not_registered");
  if (user.invitationPending) {
    redirect("/sign-in?error=pending_onboarding");
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="min-h-screen flex">
      <AppSidebar role={user.role} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          user={{ name: displayName(user), email: user.email, image: user.image }}
          deptName={user.department?.name}
          cityName={user.city?.name}
          signOutAction={signOutAction}
        />
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
