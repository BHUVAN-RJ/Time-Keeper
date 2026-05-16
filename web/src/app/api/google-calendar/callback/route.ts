import { db } from "@/db";
import { googleCalendarAccounts } from "@/db/schema";
import {
  exchangeCodeForTokens,
  fetchGoogleEmail,
} from "@/lib/google-calendar/api";
import { googleCalendarConfigured } from "@/lib/google-calendar/config";
import { encryptSecret } from "@/lib/token-crypto";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  if (!googleCalendarConfigured()) {
    redirect("/settings?gcal=not_configured");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    redirect(`/settings?gcal=denied`);
  }

  const jar = await cookies();
  const expectedState = jar.get("gcal_oauth_state")?.value;
  const userId = jar.get("gcal_oauth_uid")?.value;

  jar.delete("gcal_oauth_state");
  jar.delete("gcal_oauth_uid");

  if (!code || !state || !expectedState || state !== expectedState || !userId) {
    redirect("/settings?gcal=invalid_state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      redirect("/settings?gcal=no_refresh");
    }

    const email = await fetchGoogleEmail(tokens.access_token);
    const now = new Date();
    const refreshTokenEnc = encryptSecret(tokens.refresh_token);

    const [existing] = await db
      .select({ id: googleCalendarAccounts.id })
      .from(googleCalendarAccounts)
      .where(
        and(
          eq(googleCalendarAccounts.userId, userId),
          eq(googleCalendarAccounts.googleEmail, email),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(googleCalendarAccounts)
        .set({ refreshTokenEnc, updatedAt: now })
        .where(eq(googleCalendarAccounts.id, existing.id));
    } else {
      await db.insert(googleCalendarAccounts).values({
        userId,
        googleEmail: email,
        refreshTokenEnc,
        createdAt: now,
        updatedAt: now,
      });
    }

    redirect("/settings?gcal=connected");
  } catch {
    redirect("/settings?gcal=error");
  }
}
