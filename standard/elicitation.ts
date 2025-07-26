import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ElicitResult } from "../spec/current_spec.js";

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

    // Simulate user interaction based on the requested schema
    const simulatedContent: { [key: string]: string | number | boolean } = {};

    if (requestedSchema.properties) {
      for (const [key, schema] of Object.entries(requestedSchema.properties)) {
        // Generate simulated values based on schema type
        if (typeof schema === "object" && schema !== null) {
          if (schema.type === "string") {
            if ("enum" in schema && Array.isArray(schema.enum)) {
              simulatedContent[key] = schema.enum[0];
            } else if ("format" in schema) {
              switch (schema.format) {
                case "email":
                  simulatedContent[key] = "test@example.com";
                  break;
                case "uri":
                  simulatedContent[key] = "https://example.com";
                  break;
                case "date":
                  simulatedContent[key] = "2024-01-01";
                  break;
                case "date-time":
                  simulatedContent[key] = "2024-01-01T00:00:00Z";
                  break;
                default:
                  simulatedContent[key] = `simulated_${key}`;
              }
            } else {
              simulatedContent[key] = `simulated_${key}`;
            }
          } else if (schema.type === "number" || schema.type === "integer") {
            const min =
              "minimum" in schema && typeof schema.minimum === "number" ? schema.minimum : 0;
            const max =
              "maximum" in schema && typeof schema.maximum === "number" ? schema.maximum : 100;
            simulatedContent[key] = Math.floor(Math.random() * (max - min + 1)) + min;
          } else if (schema.type === "boolean") {
            simulatedContent[key] =
              "default" in schema && typeof schema.default === "boolean" ? schema.default : true;
          }
        }
      }
    }

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
