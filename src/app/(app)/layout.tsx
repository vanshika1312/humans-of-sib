import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/sign-in");

  // Block users not pre-approved in the DB
  if ((session.user as any).approved === false) {
    redirect("/sign-in?error=not_registered");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { department: true, city: true },
  });

  if (!user) redirect("/sign-in?error=not_registered");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:block w-64 shrink-0 border-r border-ink-100 bg-white">
        <Sidebar role={user.role} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          user={{ name: user.name, email: user.email, image: user.image }}
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
