// Second Brain service worker: shows the daily review reminder and opens the app when tapped.

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data && event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Second Brain", {
      body: data.body || "Time for today's review.",
      icon: "/icons/192",
      badge: "/icons/192",
      tag: "daily-review",
      data: { url: data.url || "/review" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin))
      if (open) return open.focus().then((w) => w.navigate(url))
      return self.clients.openWindow(url)
    }),
  )
})
