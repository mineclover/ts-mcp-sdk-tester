import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registeredTools } from './register-simple-tool.js';
import { AdvancedToolRegistrationSchema } from './schemas.js';

/**
 * Register Advanced Tool
 * Registers a tool with annotations, output schema, and advanced features
 */

export function registerRegisterAdvancedTool(server: McpServer) {
  server.registerTool(
    "register_advanced_tool",
    {
      title: "Register Advanced Tool",
      description: "Register a tool with annotations, output schema, and advanced features",
      inputSchema: AdvancedToolRegistrationSchema.shape,
    },
    async ({ name, description, destructiveHint, idempotentHint }) => {
      try {
        server.registerTool(name, {
          title: name,
          description: description,
          inputSchema: {
            input: z.string().describe("Input text to process"),
          },
          outputSchema: {
            result: z.string().describe("Processed result"),
            metadata: z.object({
              timestamp: z.string(),
              processingTime: z.number(),
            }).describe("Processing metadata"),
          },
          annotations: {
            destructiveHint: destructiveHint || false,
            idempotentHint: idempotentHint || true,
          },
        }, async (params: any) => ({
          content: [
            {
              type: "text" as const,
              text: `Advanced tool ${name} processed: ${params.input}`,
            },
            {
              type: "resource" as const,
              resource: {
                uri: `result://advanced-${name}`,
                text: `Processed result: ${params.input.toUpperCase()}`,
                mimeType: "text/plain",
              },
            },
          ],
        }));

        registeredTools.set(name, { 
          description, 
          hasParams: true, 
          advanced: true, 
          destructiveHint, 
          idempotentHint 
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered advanced tool: ${name}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error registering advanced tool: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}