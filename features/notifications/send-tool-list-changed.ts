import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EmptySchema } from "./schemas.js";

/**
 * Send Tool List Changed Tool
 * Tests sending tool list changed notification
 */

export function registerSendToolListChanged(server: McpServer) {
  server.registerTool(
    "send_tool_list_changed",
    {
      title: "Send Tool List Changed",
      description: "Test sending tool list changed notification",
      inputSchema: EmptySchema.shape,
    },
    async () => {
      try {
        server.sendToolListChanged();
        return {
          content: [
            {
              type: "text" as const,
              text: "Successfully sent tool list changed notification",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error sending tool list changed notification: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
