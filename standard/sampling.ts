import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreateMessageRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CreateMessageResult } from "../spec/current_spec.js";
import { generateDemoSamplingResponse } from "../demo/index.js";
import { logger } from "./logger.js";

/**
 * Standard MCP Sampling Endpoints
 *
 * Implements the core MCP sampling protocol endpoints:
 * - sampling/createMessage: Request LLM sampling from the client
 */

export function registerSamplingEndpoints(server: McpServer) {
  logger.logMethodEntry("registerSamplingEndpoints", { serverType: "McpServer" }, "sampling");
  registerCreateMessage(server);
  logger.info("Sampling endpoints registered successfully", "sampling");
}

/**
 * sampling/createMessage endpoint
 * Requests the client to sample from an LLM with the provided messages
 */
function registerCreateMessage(server: McpServer) {
  logger.logMethodEntry("registerCreateMessage", undefined, "sampling");

  server.server.setRequestHandler(
    CreateMessageRequestSchema,
    async (request, extra): Promise<CreateMessageResult> => {
      const { messages, systemPrompt, modelPreferences, temperature, maxTokens, includeContext } =
        request.params;

      const traceId = await logger.logEndpointEntry("sampling/createMessage", extra.requestId, {
        messageCount: messages.length,
        hasSystemPrompt: !!systemPrompt,
        hasModelPreferences: !!modelPreferences,
        temperature: temperature,
        maxTokens: maxTokens,
        includeContext: includeContext,
      });

      // This is a server-to-client request, so in a real implementation,
      // the server would send this request to the client.
      // For testing purposes, we'll simulate a response.

      // Generate demo sampling response from separated demo data
      const responseText = generateDemoSamplingResponse(messages, systemPrompt, temperature);

      // Simulate different model behaviors based on preferences
      let modelName = "simulated-model-1.0";
      if (modelPreferences?.hints?.length) {
        const hint = modelPreferences.hints[0];
        if (hint.name) {
          modelName = `simulated-${hint.name}`;
        }
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
          requestId: extra.requestId,
          temperature,
          maxTokens,
          includeContext,
          messageCount: messages.length,
          responseLength: responseText.length,
          generatedAt: new Date().toISOString(),
        },
      };

      await logger.logMethodExit(
        "sampling/createMessage",
        {
          requestId: extra.requestId,
          model: modelName,
          responseLength: responseText.length,
          messageCount: messages.length,
          success: true,
        },
        "sampling",
        traceId
      );

      return result;
    }
  );
}
