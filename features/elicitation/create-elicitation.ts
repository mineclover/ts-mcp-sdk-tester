import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { 
  ElicitRequest, 
  ElicitResult,
  PrimitiveSchemaDefinition
} from "../../spec/mcp_spec.js";

const PrimitiveSchemaSchema = z.union([
  z.object({
    type: z.literal("string"),
    title: z.optional(z.string()),
    description: z.optional(z.string()),
    minLength: z.optional(z.number()),
    maxLength: z.optional(z.number()),
    format: z.optional(z.enum(["email", "uri", "date", "date-time"])),
  }),
  z.object({
    type: z.union([z.literal("number"), z.literal("integer")]),
    title: z.optional(z.string()),
    description: z.optional(z.string()),
    minimum: z.optional(z.number()),
    maximum: z.optional(z.number()),
  }),
  z.object({
    type: z.literal("boolean"),
    title: z.optional(z.string()),
    description: z.optional(z.string()),
    default: z.optional(z.boolean()),
  }),
  z.object({
    type: z.literal("string"),
    title: z.optional(z.string()),
    description: z.optional(z.string()),
    enum: z.array(z.string()),
    enumNames: z.optional(z.array(z.string())),
  }),
]);

const ElicitParamsSchema = z.object({
  message: z.string(),
  requestedSchema: z.object({
    type: z.literal("object"),
    properties: z.record(PrimitiveSchemaSchema),
    required: z.optional(z.array(z.string())),
  }),
  _meta: z.object({}).passthrough().optional(),
});

/**
 * Registers the elicitation/create endpoint handler
 * Requests additional information from the user via the client
 */
export function registerCreateElicitation(server: McpServer) {
  server.request(
    {
      method: "elicitation/create",
      schema: {
        params: ElicitParamsSchema,
      },
    },
    async (request): Promise<ElicitResult> => {
      const { message, requestedSchema } = request.params;
      
      // This is a server-to-client request, so in a real implementation,
      // the server would send this request to the client to collect user input.
      // For testing purposes, we'll simulate a response.
      
      // Simulate user interaction based on the requested schema
      const simulatedContent: { [key: string]: string | number | boolean } = {};
      
      if (requestedSchema.properties) {
        for (const [key, schema] of Object.entries(requestedSchema.properties)) {
          // Generate simulated values based on schema type
          if (schema.type === "string") {
            if ('enum' in schema && schema.enum) {
              simulatedContent[key] = schema.enum[0];
            } else if (schema.format === "email") {
              simulatedContent[key] = "test@example.com";
            } else if (schema.format === "uri") {
              simulatedContent[key] = "https://example.com";
            } else if (schema.format === "date") {
              simulatedContent[key] = "2024-01-01";
            } else if (schema.format === "date-time") {
              simulatedContent[key] = "2024-01-01T00:00:00Z";
            } else {
              simulatedContent[key] = `simulated_${key}`;
            }
          } else if (schema.type === "number" || schema.type === "integer") {
            const min = 'minimum' in schema ? (schema.minimum || 0) : 0;
            const max = 'maximum' in schema ? (schema.maximum || 100) : 100;
            simulatedContent[key] = Math.floor(Math.random() * (max - min + 1)) + min;
          } else if (schema.type === "boolean") {
            simulatedContent[key] = 'default' in schema ? (schema.default || false) : true;
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
          },
        };
      }
      
      // Simulate user accepting and providing the information
      const result: ElicitResult = {
        action: "accept",
        content: simulatedContent,
        _meta: {
          simulatedResponse: true,
          message: `Simulated response to: "${message}"`,
          requestId: Date.now().toString(),
        },
      };
      
      return result;
    }
  );
}