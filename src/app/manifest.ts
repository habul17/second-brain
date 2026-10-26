import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Second Brain",
    short_name: "Brain",
    description: "Everything you learn, saved, searchable, and reviewed so you never forget it.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#111111",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512?maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Start review", url: "/review" }],
  }
}
