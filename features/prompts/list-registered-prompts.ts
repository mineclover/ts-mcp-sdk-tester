import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registeredPrompts } from './register-simple-prompt.js';

/**
 * List Registered Prompts Tool
 * Lists all prompts registered for testing
 */

export function registerListRegisteredPrompts(server: McpServer) {
  server.registerTool(
    "list_registered_prompts",
    {
      title: "List Registered Prompts",
      description: "List all prompts registered for testing",
      inputSchema: {},
    },
    async () => {
      try {
        const prompts = Array.from(registeredPrompts.entries()).map(([key, value]) => {
          return `${key}: ${JSON.stringify(value)}`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Registered prompts:\n${prompts.join('\n') || 'No prompts registered'}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing prompts: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}