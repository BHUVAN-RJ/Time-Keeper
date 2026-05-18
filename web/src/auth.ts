import { EmailSignInError } from "@auth/core/errors";
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
      async sendVerificationRequest({ identifier: to, provider, url }) {
        const { host } = new URL(url);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to,
            subject: `Sign in to ${host}`,
            html: `<p>Sign in to <strong>${host}</strong></p><p><a href="${url}">Sign in</a></p><p>If you did not request this, you can ignore this email.</p>`,
            text: `Sign in to ${host}\n\n${url}\n`,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          const detail = body.message ?? "Resend request failed";
          console.error("[auth] Resend send failed:", body);
          throw new EmailSignInError(detail);
        }
      },
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
