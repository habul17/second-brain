import { RegisterServiceWorker } from "@/components/pwa"
import { TimezoneSync } from "@/components/timezone-sync"
import { TopBar } from "@/components/top-bar"
import { countDue } from "@/server/sections"
import { requireUser } from "@/server/session"
import { getSettings } from "@/server/settings"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser()
  const [due, settings] = await Promise.all([countDue(user.id), getSettings(user.id)])
  return (
    <div className="min-h-svh">
      <TopBar user={{ name: user.name, email: user.email, image: user.image ?? null }} due={due} />
      <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">{children}</main>
      <TimezoneSync saved={settings.timezone} />
      <RegisterServiceWorker />
    </div>
  )
}
