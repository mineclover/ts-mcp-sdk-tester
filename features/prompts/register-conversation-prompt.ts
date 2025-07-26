import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registeredPrompts } from './register-simple-prompt.js';

/**
 * Register Conversation Prompt Tool
 * Registers a prompt that generates a conversation sequence
 */

export function registerRegisterConversationPrompt(server: McpServer) {
  server.registerTool(
    "register_conversation_prompt",
    {
      title: "Register Conversation Prompt",
      description: "Register a prompt that generates a conversation sequence",
      inputSchema: {
        name: z.string().describe("Name of the conversation prompt to register"),
        description: z.string().describe("Description of the prompt"),
        systemMessage: z.string().describe("System message for the conversation"),
        userMessage: z.string().describe("User message template"),
      },
    },
    async ({ name, description, systemMessage, userMessage }) => {
      try {
        server.registerPrompt(name, {
          title: name,
          description: description,
          argsSchema: {
            topic: z.string().describe("Topic for the conversation"),
            context: z.string().optional().describe("Additional context"),
          },
        }, (args: any) => ({
          messages: [
            {
              role: "system" as const,
              content: {
                type: "text" as const,
                text: systemMessage,
              },
            },
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: userMessage.replace("{topic}", args.topic).replace("{context}", args.context || ""),
              },
            },
          ],
        }));

        registeredPrompts.set(name, { 
          description, 
          systemMessage, 
          userMessage, 
          hasArgs: true, 
          isConversation: true 
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered conversation prompt: ${name}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error registering conversation prompt: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}