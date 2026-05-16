import { auth } from "@/auth";
import { googleAuthUrl, googleCalendarConfigured } from "@/lib/google-calendar/config";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function GET() {
  if (!googleCalendarConfigured()) {
    redirect("/settings?gcal=not_configured");
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const state = crypto.randomUUID();
  const jar = await cookies();
  jar.set("gcal_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  jar.set("gcal_oauth_uid", session.user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  redirect(googleAuthUrl(state));
}
