import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registeredTools } from "./register-simple-tool.js";
import { EmptySchema } from "./schemas.js";

/**
 * List Registered Tools
 * Lists all tools registered for testing
 */

export function registerListRegisteredTools(server: McpServer) {
  server.registerTool(
    "list_registered_tools",
    {
      title: "List Registered Tools",
      description: "List all tools registered for testing",
      inputSchema: EmptySchema.shape,
    },
    async () => {
      try {
        const tools = Array.from(registeredTools.entries()).map(([key, value]) => {
          return `${key}: ${JSON.stringify(value)}`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Registered tools:\n${tools.join("\n") || "No tools registered"}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing tools: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
