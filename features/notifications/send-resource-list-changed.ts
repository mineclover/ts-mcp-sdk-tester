import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EmptySchema } from "./schemas.js";

/**
 * Send Resource List Changed Tool
 * Tests sending resource list changed notification
 */

export function registerSendResourceListChanged(server: McpServer) {
  server.registerTool(
    "send_resource_list_changed",
    {
      title: "Send Resource List Changed",
      description: "Test sending resource list changed notification",
      inputSchema: EmptySchema.shape,
    },
    async () => {
      try {
        server.sendResourceListChanged();
        return {
          content: [
            {
              type: "text" as const,
              text: "Successfully sent resource list changed notification",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error sending resource list changed notification: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
