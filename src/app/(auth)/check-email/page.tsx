import { Suspense } from "react"
import { CheckEmail } from "@/components/auth-forms"

export const metadata = { title: "Check your inbox" }

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmail />
    </Suspense>
  )
}
