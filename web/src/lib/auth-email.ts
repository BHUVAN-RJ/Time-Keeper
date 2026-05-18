/** True when using Resend's shared test sender (delivery limited to your Resend account email). */
export function isResendTestSender(): boolean {
  const from = process.env.AUTH_RESEND_FROM ?? "onboarding@resend.dev";
  return from.includes("resend.dev");
}

export function magicLinkErrorMessage(
  error: string | undefined,
  opts: { resendTestMode: boolean },
): string {
  switch (error) {
    case "Configuration":
      return "Sign-in failed unexpectedly. Restart the dev server, then try again. If it persists, check the terminal for [auth] logs.";
    case "AccessDenied":
      return "That email cannot sign in.";
    case "EmailSignin":
    case "EmailSignInError":
      if (opts.resendTestMode) {
        return "Could not send the link. With onboarding@resend.dev, Resend only delivers to the email on your Resend account until you verify a domain.";
      }
      return "Could not send the link. Check the address, try again, or look in spam.";
    default:
      if (error) {
        return "Could not send the sign-in link. Try again in a minute.";
      }
      return "Could not send the sign-in link. Try again.";
  }
}
