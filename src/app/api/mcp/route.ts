import { withMcpAuth } from "mcp-handler"
import { verifyApiKey } from "@/server/api-keys"
import { mcpHandler } from "@/server/mcp"

// Claude connects with the key from Settings: Authorization: Bearer sb_…
const handler = withMcpAuth(
  mcpHandler,
  async (_req, token) => {
    const userId = token ? await verifyApiKey(token) : null
    if (!userId) return undefined
    return { token: token!, clientId: userId, scopes: [], extra: { userId } }
  },
  { required: true },
)

export { handler as GET, handler as POST, handler as DELETE }
