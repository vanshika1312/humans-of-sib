import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || "skillinabox.in";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
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
      }
      if (token.email && (!token.uid || trigger === "update")) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true, departmentId: true, invitationPending: true },
        });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.departmentId = dbUser.departmentId;
          token.approved = !dbUser.invitationPending;
        } else {
          token.approved = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) || session.user.id;
        (session.user as any).role = token.role;
        (session.user as any).departmentId = token.departmentId;
        (session.user as any).approved = token.approved;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.email) {
        await prisma.user.update({
          where: { email: user.email },
          data: { lastSignInAt: new Date() },
        }).catch(() => {});
      }
    },
  },
});
