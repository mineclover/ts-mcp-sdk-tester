import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registeredResources } from './register-simple-resource.js';

/**
 * List Registered Resources Tool
 * Lists all resources registered for testing
 */

export function registerListRegisteredResources(server: McpServer) {
  server.registerTool(
    "list_registered_resources",
    {
      title: "List Registered Resources",
      description: "List all resources registered for testing",
      inputSchema: {},
    },
    async () => {
      try {
        const resources = Array.from(registeredResources.entries()).map(([key, value]) => {
          return `${key}: ${JSON.stringify(value)}`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Registered resources:\n${resources.join('\n') || 'No resources registered'}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing resources: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}