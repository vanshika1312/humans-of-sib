import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { isEmployeeProfileComplete } from "@/lib/employee-self-profile";

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || "skillinabox.in";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // Adapter typings lag Prisma client extensions; runtime is fine with JWT sessions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: { hd: ALLOWED_DOMAIN, prompt: "select_account" },
      },
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      const email = user.email?.toLowerCase() || "";
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return `/sign-in?error=domain`;
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.uid = user.id;
        // Drop leftover claims from when candidate login shared this cookie.
        delete token.candidateId;
      }
      // Old shared-session candidate JWTs must not unlock the employee app.
      if (token.candidateId && !user) {
        return {};
      }
      if (token.email && (!token.uid || trigger === "update")) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: {
            id: true,
            role: true,
            departmentId: true,
            invitationPending: true,
            personalEmail: true,
            birthday: true,
            gender: true,
            cityId: true,
            residentialAddress: true,
            pan: true,
            aadhar: true,
            fatherName: true,
            motherName: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            emergencyContactRelation: true,
          },
        });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.departmentId = dbUser.departmentId;
          token.approved = isEmployeeProfileComplete(dbUser);
        } else {
          token.approved = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) || session.user.id;
        session.user.role = token.role as string | undefined;
        session.user.departmentId = token.departmentId as string | null | undefined;
        session.user.approved = token.approved as boolean | undefined;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      try {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        const dest = new URL(url);
        if (dest.origin === new URL(baseUrl).origin) return dest.toString();
      } catch {
        /* ignore malformed URLs */
      }
      return baseUrl;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.email) {
        await prisma.user
          .update({
            where: { email: user.email },
            data: { lastSignInAt: new Date() },
          })
          .catch(() => {});
      }
    },
  },
});
