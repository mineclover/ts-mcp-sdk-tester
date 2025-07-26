import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registeredPrompts } from './register-simple-prompt.js';
import { ParameterizedPromptRegistrationSchema } from './schemas.js';

/**
 * Register Parameterized Prompt Tool
 * Registers a prompt with arguments for testing
 */

export function registerRegisterParameterizedPrompt(server: McpServer) {
  server.registerTool(
    "register_parameterized_prompt",
    {
      title: "Register Parameterized Prompt",
      description: "Register a prompt with arguments for testing",
      inputSchema: ParameterizedPromptRegistrationSchema.shape,
    },
    async ({ name, description, argName, argDescription, messageTemplate }) => {
      try {
        const argsSchema: any = {};
        argsSchema[argName] = z.string().describe(argDescription);

        server.registerPrompt(name, {
          title: name,
          description: description,
          argsSchema: argsSchema,
        }, (args: any) => ({
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: messageTemplate.replace(`{${argName}}`, args[argName]),
              },
            },
          ],
        }));

        registeredPrompts.set(name, { description, argName, argDescription, messageTemplate, hasArgs: true });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered parameterized prompt: ${name}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error registering parameterized prompt: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}