import { auth } from "@/lib/auth"
import { buildExport } from "@/server/export"

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return new Response("Log in first.", { status: 401 })
  const zip = await buildExport(session.user.id)
  const day = new Date().toISOString().slice(0, 10)
  return new Response(new Blob([zip as BlobPart], { type: "application/zip" }), {
    headers: {
      "Content-Disposition": `attachment; filename="second-brain-${day}.zip"`,
      "Cache-Control": "no-store",
    },
  })
}
