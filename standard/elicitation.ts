import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ElicitResult } from "../spec/current_spec.js";
import { generateDemoElicitationContent } from "../demo/index.js";

/**
 * Standard MCP Elicitation Endpoints
 *
 * Implements the core MCP elicitation protocol endpoints:
 * - elicitation/create: Request additional information from user via client
 */

export function registerElicitationEndpoints(server: McpServer) {
  registerCreateElicitation(server);
}

/**
 * elicitation/create endpoint
 * Requests additional information from the user via the client
 */
function registerCreateElicitation(server: McpServer) {
  server.server.setRequestHandler(ElicitRequestSchema, async (request): Promise<ElicitResult> => {
    const { message, requestedSchema } = request.params;

    // This is a server-to-client request, so in a real implementation,
    // the server would send this request to the client to collect user input.
    // For testing purposes, we'll simulate a response.

    // Generate demo elicitation content from separated demo data
    const simulatedContent = generateDemoElicitationContent(requestedSchema);

    // Check required fields
    const missingRequired: string[] = [];
    if (requestedSchema.required) {
      for (const required of requestedSchema.required) {
        if (!(required in simulatedContent)) {
          missingRequired.push(required);
        }
      }
    }

    if (missingRequired.length > 0) {
      // Simulate declined action due to missing required fields
      return {
        action: "decline",
        _meta: {
          simulatedResponse: true,
          missingFields: missingRequired,
          requestId: Date.now().toString(),
          reason: `Missing required fields: ${missingRequired.join(", ")}`,
        },
      };
    }

    // Simulate random user actions (accept most of the time)
    const actions: ("accept" | "decline" | "cancel")[] = [
      "accept",
      "accept",
      "accept",
      "decline",
      "cancel",
    ];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];

    if (randomAction === "accept") {
      return {
        action: "accept",
        content: simulatedContent,
        _meta: {
          simulatedResponse: true,
          message: `Simulated response to: "${message}"`,
          requestId: Date.now().toString(),
          fieldsProvided: Object.keys(simulatedContent),
        },
      };
    } else {
      return {
        action: randomAction,
        _meta: {
          simulatedResponse: true,
          message: `User ${randomAction}ed the elicitation request`,
          requestId: Date.now().toString(),
          originalMessage: message,
        },
      };
    }
  });
}
