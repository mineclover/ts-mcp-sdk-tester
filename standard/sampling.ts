import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreateMessageRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  CreateMessageResult,
  SamplingMessage,
  ModelPreferences
} from "../spec/current_spec.js";

/**
 * Standard MCP Sampling Endpoints
 * 
 * Implements the core MCP sampling protocol endpoints:
 * - sampling/createMessage: Request LLM sampling from the client
 */

export function registerSamplingEndpoints(server: McpServer) {
  registerCreateMessage(server);
}

/**
 * sampling/createMessage endpoint
 * Requests the client to sample from an LLM with the provided messages
 */
function registerCreateMessage(server: McpServer) {
  server.server.setRequestHandler(
    CreateMessageRequestSchema,
    async (request): Promise<CreateMessageResult> => {
      const { 
        messages, 
        systemPrompt, 
        modelPreferences,
        temperature,
        maxTokens,
        stopSequences,
        includeContext,
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
      
      // Simulate different model behaviors based on preferences
      let modelName = "simulated-model-1.0";
      if (modelPreferences?.hints?.length) {
        const hint = modelPreferences.hints[0];
        if (hint.name) {
          modelName = `simulated-${hint.name}`;
        }
      }
      
      // Simulate temperature effects
      if (temperature && temperature > 0.8) {
        responseText += " (high creativity mode)";
      } else if (temperature && temperature < 0.3) {
        responseText += " (focused mode)";
      }
      
      // Create a simulated response
      const result: CreateMessageResult = {
        role: "assistant",
        content: {
          type: "text",
          text: responseText,
        },
        model: modelName,
        stopReason: "endTurn",
        _meta: {
          simulatedResponse: true,
          requestId: Date.now().toString(),
          temperature,
          maxTokens,
          includeContext,
          messageCount: messages.length,
        },
      };
      
      return result;
    }
  );
}