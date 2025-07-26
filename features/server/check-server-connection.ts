import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EmptySchema } from "./schemas.js";

/**
 * Check Server Connection Tool
 * Checks if the MCP server is connected to a transport
 */

export function registerCheckServerConnection(server: McpServer) {
  server.registerTool(
    "check_server_connection",
    {
      title: "Check Server Connection",
      description: "Check if the MCP server is connected to a transport",
      inputSchema: EmptySchema.shape,
    },
    async () => {
      try {
        const isConnected = server.isConnected();
        return {
          content: [
            {
              type: "text" as const,
              text: `Server connection status: ${isConnected ? "Connected" : "Not connected"}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error checking connection: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
