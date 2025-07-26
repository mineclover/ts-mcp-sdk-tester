import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EmptySchema, SimplePromptRegistrationSchema } from "./schemas.js";

// Store registered prompts for testing
const registeredPrompts = new Map<string, any>();

/**
 * Register Simple Prompt Tool
 * Registers a simple prompt with no arguments for testing
 */

export function registerRegisterSimplePrompt(server: McpServer) {
  server.registerTool(
    "register_simple_prompt",
    {
      title: "Register Simple Prompt",
      description: "Register a simple prompt with no arguments for testing",
      inputSchema: SimplePromptRegistrationSchema.shape,
    },
    async ({ name, description, message }) => {
      try {
        server.registerPrompt(
          name,
          {
            title: name,
            description: description,
            argsSchema: EmptySchema.shape,
          },
          () => ({
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: message,
                },
              },
            ],
          })
        );

        registeredPrompts.set(name, { description, message, hasArgs: false });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered simple prompt: ${name}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error registering prompt: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { registeredPrompts };
