"use server";

import { signIn, signOut } from "@/auth";
import {
  isResendTestSender,
  magicLinkErrorMessage,
} from "@/lib/auth-email";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function requestMagicLinkAction(
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    return {
      ok: false,
      message:
        "Email sign-in is not configured (RESEND_API_KEY missing on the server).",
    };
  }
  if (!process.env.AUTH_SECRET?.trim()) {
    return {
      ok: false,
      message:
        "Email sign-in is not configured (AUTH_SECRET missing on the server).",
    };
  }

  const resendTestMode = isResendTestSender();

  try {
    const result = await signIn("resend", {
      email: normalized,
      redirect: false,
      redirectTo: "/today",
    });

    const url = typeof result === "string" ? result : "";
    if (url.includes("error=")) {
      const parsed = new URL(
        url,
        process.env.AUTH_URL ?? "http://localhost:3000",
      );
      const code = parsed.searchParams.get("error") ?? undefined;
      return {
        ok: false,
        message: magicLinkErrorMessage(code, { resendTestMode }),
      };
    }

    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error && e.message
        ? e.message
        : "Could not send the sign-in link.";
    if (
      resendTestMode &&
      message.toLowerCase().includes("only send testing emails")
    ) {
      return {
        ok: false,
        message: magicLinkErrorMessage("EmailSignin", { resendTestMode }),
      };
    }
    return { ok: false, message };
  }
}
