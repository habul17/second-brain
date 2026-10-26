import { LoginForm } from "@/components/auth-forms"
import { socialProviders } from "@/lib/auth"
import { canSendEmail } from "@/lib/email"

export const metadata = { title: "Log in" }

export default function LoginPage() {
  return <LoginForm providers={socialProviders} canReset={canSendEmail} />
}
