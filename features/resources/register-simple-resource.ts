import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Store registered resources for testing
const registeredResources = new Map<string, any>();

/**
 * Register Simple Resource Tool
 * Registers a simple static resource for testing
 */

export function registerRegisterSimpleResource(server: McpServer) {
  server.registerTool(
    "register_simple_resource",
    {
      title: "Register Simple Resource",
      description: "Register a simple static resource for testing",
      inputSchema: {
        uri: z.string().describe("The URI for the resource"),
        name: z.string().describe("Name of the resource"),
        description: z.string().optional().describe("Description of the resource"),
        content: z.string().describe("Text content for the resource"),
      },
    },
    async ({ uri, name, description, content }) => {
      try {
        server.registerResource(name, uri, {
          title: name,
          description: description || `Resource: ${name}`,
        }, async (uri: any) => ({
          contents: [
            {
              uri: uri.href,
              text: content,
              mimeType: "text/plain",
            },
          ],
        }));

        registeredResources.set(uri, { name, description, content });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered simple resource: ${uri}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error registering resource: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { registeredResources };