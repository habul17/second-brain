import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

/** The signed-in user, or null. Deduped per request. */
export const getUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
})

/** The signed-in user. Sends visitors to the login page. */
export async function requireUser() {
  const user = await getUser()
  if (!user) redirect("/login")
  return user
}
