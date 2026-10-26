import { SignupForm } from "@/components/auth-forms"
import { socialProviders } from "@/lib/auth"

export const metadata = { title: "Sign up" }

export default function SignupPage() {
  return <SignupForm providers={socialProviders} />
}
