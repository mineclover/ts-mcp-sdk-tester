import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Store registered tools for testing
const registeredTools = new Map<string, any>();

/**
 * Register Simple Tool
 * Registers a simple tool with no parameters for testing
 */

export function registerRegisterSimpleTool(server: McpServer) {
  server.registerTool(
    "register_simple_tool",
    {
      title: "Register Simple Tool",
      description: "Register a simple tool with no parameters for testing",
      inputSchema: {
        name: z.string().describe("Name of the tool to register"),
        description: z.string().describe("Description of the tool"),
        response: z.string().describe("Response text the tool should return"),
      },
    },
    async ({ name, description, response }) => {
      try {
        server.registerTool(name, {
          title: name,
          description: description,
          inputSchema: {},
        }, async () => ({
          content: [
            {
              type: "text" as const,
              text: response,
            },
          ],
        }));

        registeredTools.set(name, { description, response, hasParams: false });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered simple tool: ${name}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error registering tool: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { registeredTools };