import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { 
  CreateMessageRequest, 
  CreateMessageResult,
  SamplingMessage,
  ModelPreferences
} from "../../spec/mcp_spec.js";

const CreateMessageParamsSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.any(), // ContentBlock can be text, image, or audio
  })),
  modelPreferences: z.object({
    hints: z.optional(z.array(z.object({
      name: z.optional(z.string()),
    }))),
    costPriority: z.optional(z.number().min(0).max(1)),
    speedPriority: z.optional(z.number().min(0).max(1)),
    intelligencePriority: z.optional(z.number().min(0).max(1)),
  }).optional(),
  systemPrompt: z.string().optional(),
  includeContext: z.enum(["none", "thisServer", "allServers"]).optional(),
  temperature: z.number().optional(),
  maxTokens: z.number(),
  stopSequences: z.array(z.string()).optional(),
  metadata: z.object({}).passthrough().optional(),
  _meta: z.object({}).passthrough().optional(),
});

/**
 * Registers the sampling/createMessage endpoint handler
 * Requests the client to sample from an LLM with the provided messages
 */
export function registerCreateMessage(server: McpServer) {
  server.request(
    {
      method: "sampling/createMessage",
      schema: {
        params: CreateMessageParamsSchema,
      },
    },
    async (request): Promise<CreateMessageResult> => {
      const { 
        messages, 
        modelPreferences, 
        systemPrompt, 
        includeContext, 
        temperature, 
        maxTokens, 
        stopSequences, 
        metadata 
      } = request.params;
      
      // This is a server-to-client request, so in a real implementation,
      // the server would send this request to the client.
      // For testing purposes, we'll simulate a response.
      
      // Simulate LLM response based on the input messages
      let responseText = "This is a simulated LLM response";
      
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.content && typeof lastMessage.content === 'object' && 'text' in lastMessage.content) {
          responseText = `Simulated response to: "${lastMessage.content.text}"`;
        } else if (typeof lastMessage.content === 'string') {
          responseText = `Simulated response to: "${lastMessage.content}"`;
        }
      }
      
      if (systemPrompt) {
        responseText = `[System: ${systemPrompt}] ${responseText}`;
      }
      
      // Create a simulated response
      const result: CreateMessageResult = {
        role: "assistant",
        content: {
          type: "text",
          text: responseText,
        },
        model: "simulated-model-1.0",
        stopReason: "endTurn",
        _meta: {
          simulatedResponse: true,
          requestId: Date.now().toString(),
        },
      };
      
      return result;
    }
  );
}