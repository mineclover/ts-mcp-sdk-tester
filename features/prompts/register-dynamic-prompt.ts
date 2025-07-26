import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registeredPrompts } from './register-simple-prompt.js';

/**
 * Register Dynamic Prompt Tool
 * Registers a prompt that dynamically generates content based on type
 */

export function registerRegisterDynamicPrompt(server: McpServer) {
  server.registerTool(
    "register_dynamic_prompt",
    {
      title: "Register Dynamic Prompt",
      description: "Register a prompt that dynamically generates content based on type",
      inputSchema: {
        name: z.string().describe("Name of the dynamic prompt to register"),
        description: z.string().describe("Description of the prompt"),
      },
    },
    async ({ name, description }) => {
      try {
        server.registerPrompt(name, {
          title: name,
          description: description,
          argsSchema: {
            type: z.enum(["creative", "analytical", "technical", "casual"]).describe("Type of prompt to generate"),
            subject: z.string().describe("Subject matter"),
          },
        }, (args: any) => {
          const templates = {
            creative: `Write a creative and imaginative piece about ${args.subject}. Use vivid descriptions and storytelling techniques.`,
            analytical: `Provide a detailed analytical breakdown of ${args.subject}. Include data, facts, and logical reasoning.`,
            technical: `Explain the technical aspects of ${args.subject}. Focus on implementation details and best practices.`,
            casual: `Tell me about ${args.subject} in a casual, conversational way. Keep it simple and friendly.`
          };

          return {
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: templates[args.type as keyof typeof templates],
                },
              },
            ],
          };
        });

        registeredPrompts.set(name, { 
          description, 
          hasArgs: true, 
          isDynamic: true,
          supportedTypes: ["creative", "analytical", "technical", "casual"]
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered dynamic prompt: ${name}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error registering dynamic prompt: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}