import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { isResendTestSender } from "@/lib/auth-email";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/today");
  return <LoginForm resendTestMode={isResendTestSender()} />;
}
