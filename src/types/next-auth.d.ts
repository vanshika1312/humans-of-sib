import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: string;
      departmentId?: string | null;
      approved?: boolean;
      /** Set only on the careers-portal Auth.js session. */
      candidateId?: string;
    };
  }

  interface User {
    candidateId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: string;
    departmentId?: string | null;
    approved?: boolean;
    candidateId?: string;
  }
}
