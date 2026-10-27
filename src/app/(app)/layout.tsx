import { RegisterServiceWorker } from "@/components/pwa"
import { TimezoneSync } from "@/components/timezone-sync"
import { TopBar } from "@/components/top-bar"
import { todayPlan } from "@/server/review"
import { requireUser } from "@/server/session"
import { getSettings } from "@/server/settings"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser()
  const settings = await getSettings(user.id)
  const plan = await todayPlan(user.id, settings.dailyMinutes)
  return (
    <div className="min-h-svh">
      <TopBar user={{ name: user.name, email: user.email, image: user.image ?? null }} due={plan.count} />
      {/* Pages marked data-full (the note page with its sidebar) use the whole width. */}
      <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12 has-[[data-full]]:max-w-none has-[[data-full]]:p-0">
        {children}
      </main>
      <TimezoneSync saved={settings.timezone} />
      <RegisterServiceWorker />
    </div>
  )
}
