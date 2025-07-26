import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const CloseServerConnectionSchema = z.object({
  graceful: z.boolean().default(true).describe("Whether to close gracefully"),
  reason: z.string().optional().describe("Optional reason for closing"),
});

export function registerCloseServerConnection(server: McpServer) {
  server.tool(
    "close_server_connection",
    "Close the MCP server connection for testing server shutdown behavior",
    {
      type: "object",
      properties: {
        graceful: {
          type: "boolean",
          description: "Whether to close gracefully",
          default: true,
        },
        reason: {
          type: "string",
          description: "Optional reason for closing",
        },
      },
    },
    async (args) => {
      try {
        const params = CloseServerConnectionSchema.parse(args);
        
        // Get connection status before closing
        const wasConnected = server.isConnected();
        
        if (!wasConnected) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Server was already disconnected",
              },
            ],
          };
        }

        // Attempt to close the server
        try {
          await server.close();
          
          return {
            content: [
              {
                type: "text" as const,
                text: `Server connection closed ${params.graceful ? 'gracefully' : 'forcefully'}` +
                      (params.reason ? ` (reason: ${params.reason})` : ''),
              },
            ],
            structuredContent: {
              wasConnected,
              graceful: params.graceful,
              reason: params.reason,
              closedAt: new Date().toISOString(),
            },
          };
        } catch (closeError) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to close server connection: ${closeError instanceof Error ? closeError.message : String(closeError)}`,
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error in close_server_connection: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}