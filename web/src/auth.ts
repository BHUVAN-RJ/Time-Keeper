import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";
import { ensureDefaultCategories } from "@/lib/ensure-categories";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_RESEND_FROM ?? "onboarding@resend.dev",
    }),
  ],
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  events: {
    createUser: async ({ user }) => {
      await ensureDefaultCategories(user.id!);
    },
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.timezone =
        (user as { timezone?: string }).timezone ?? "America/Los_Angeles";
      return session;
    },
  },
});
