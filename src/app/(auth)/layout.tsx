import Link from "next/link"
import { redirect } from "next/navigation"
import { Logo } from "@/components/logo"
import { getUser } from "@/server/session"

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getUser()) redirect("/")
  return (
    <div className="grid min-h-svh place-items-center px-4 py-12">
      <div className="grid w-full max-w-sm gap-8">
        <Link href="/login" className="justify-self-center">
          <Logo />
        </Link>
        {children}
      </div>
    </div>
  )
}
