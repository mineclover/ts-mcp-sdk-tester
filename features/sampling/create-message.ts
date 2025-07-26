import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreateMessageRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  CreateMessageResult,
  SamplingMessage,
  ModelPreferences
} from "../../spec/current_spec.js";

/**
 * Registers the sampling/createMessage endpoint handler
 * Requests the client to sample from an LLM with the provided messages
 */
export function registerCreateMessage(server: McpServer) {
  server.server.setRequestHandler(
    CreateMessageRequestSchema,
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