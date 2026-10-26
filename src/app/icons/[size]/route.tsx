import { ImageResponse } from "next/og"
import { BrandIcon } from "@/lib/brand-icon"

const SIZES = [192, 512]

/** PNG icons for the installed app: /icons/192, /icons/512 and /icons/512?maskable */
export async function GET(request: Request, { params }: RouteContext<"/icons/[size]">) {
  const size = Number((await params).size)
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 })
  const padded = new URL(request.url).searchParams.has("maskable")
  return new ImageResponse(<BrandIcon size={size} padded={padded} />, {
    width: size,
    height: size,
    headers: { "Cache-Control": "public, max-age=604800, immutable" },
  })
}
