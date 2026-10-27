import Link from "next/link"
import { redirect } from "next/navigation"
import { Brain } from "lucide-react"
import { getUser } from "@/server/session"

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getUser()) redirect("/")
  return (
    // Centred on a laptop; on a phone it sits higher, clear of the keyboard.
    <div className="grid min-h-svh place-items-center px-5 py-12 max-sm:place-items-start max-sm:justify-center max-sm:pt-[18svh]">
      <div className="grid w-full max-w-[340px] gap-3.5">
        <Link href="/login" aria-label="Second Brain" className="mb-0.5 grid size-11 place-items-center justify-self-center rounded-[13px] bg-foreground text-background">
          <Brain className="size-6" />
        </Link>
        {children}
      </div>
    </div>
  )
}
