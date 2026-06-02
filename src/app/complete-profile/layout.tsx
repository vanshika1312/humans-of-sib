import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function CompleteProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/sign-in");

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 md:p-10 bg-ink-50/80">
      {children}
    </div>
  );
}
