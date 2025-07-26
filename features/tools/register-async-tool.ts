import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registeredTools } from './register-simple-tool.js';

/**
 * Register Async Tool
 * Registers a tool that performs async operations for testing
 */

export function registerRegisterAsyncTool(server: McpServer) {
  server.registerTool(
    "register_async_tool",
    {
      title: "Register Async Tool",
      description: "Register a tool that performs async operations for testing",
      inputSchema: {
        name: z.string().describe("Name of the async tool to register"),
        description: z.string().describe("Description of the tool"),
        delay: z.number().min(0).max(5000).describe("Delay in milliseconds (0-5000)"),
      },
    },
    async ({ name, description, delay }) => {
      try {
        server.registerTool(name, {
          title: name,
          description: description,
          inputSchema: {
            message: z.string().describe("Message to process after delay"),
          },
        }, async (params: any) => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return {
            content: [
              {
                type: "text" as const,
                text: `Async tool ${name} processed after ${delay}ms: ${params.message}`,
              },
            ],
          };
        });

        registeredTools.set(name, { description, delay, isAsync: true });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered async tool: ${name} (${delay}ms delay)`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error registering async tool: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}