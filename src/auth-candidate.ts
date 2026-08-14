import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const CANDIDATE_AUTH_BASE_PATH = "/api/candidate-auth";

function useSecureAuthCookies() {
  return (
    process.env.AUTH_URL?.startsWith("https://") === true ||
    process.env.NEXTAUTH_URL?.startsWith("https://") === true
  );
}

/** Cookie names that never collide with the employee Google session. */
function candidateCookies() {
  const secure = useSecureAuthCookies();
  const prefix = secure ? "__Secure-" : "";
  const base = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure,
  };
  return {
    sessionToken: {
      name: `${prefix}authjs.candidate-session-token`,
      options: base,
    },
    callbackUrl: {
      name: `${prefix}authjs.candidate-callback-url`,
      options: base,
    },
    csrfToken: {
      name: secure ? "__Host-authjs.candidate-csrf-token" : "authjs.candidate-csrf-token",
      options: base,
    },
  };
}

export const {
  handlers: candidateAuthHandlers,
  auth: candidateAuth,
  signIn: candidateSignIn,
  signOut: candidateSignOut,
} = NextAuth({
  trustHost: true,
  basePath: CANDIDATE_AUTH_BASE_PATH,
  cookies: candidateCookies(),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      id: "candidate-credentials",
      name: "Candidate",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        const account = await prisma.hiringCandidatePortalAccount.findUnique({
          where: { email },
          include: {
            candidate: { select: { id: true, fullName: true, email: true } },
          },
        });
        if (!account) return null;

        const ok = await bcrypt.compare(password, account.passwordHash);
        if (!ok) return null;

        return {
          id: account.candidateId,
          email: account.email,
          name: account.candidate.fullName,
          candidateId: account.candidateId,
        };
      },
    }),
  ],
  pages: {
    signIn: "/careers/sign-in",
    error: "/careers/sign-in",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "candidate-credentials") return false;
      return Boolean(user?.id);
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.candidateId = user.candidateId || user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) || session.user.id;
        session.user.candidateId =
          typeof token.candidateId === "string" ? token.candidateId : session.user.id;
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
      return `${baseUrl}/careers`;
    },
  },
});
