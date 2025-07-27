/**
 * Demo Elicitation Data
 *
 * Sample elicitation responses for testing and demonstration purposes.
 * This file contains demo data that can be easily removed or modified.
 */

interface SchemaProperty {
  type?: string;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

interface RequestedSchema {
  properties?: { [key: string]: SchemaProperty };
  required?: string[];
}

export function generateDemoElicitationContent(requestedSchema: RequestedSchema): {
  [key: string]: string | number | boolean;
} {
  const simulatedContent: { [key: string]: string | number | boolean } = {};

  if (requestedSchema.properties) {
    for (const [key, schema] of Object.entries(requestedSchema.properties)) {
      // Generate simulated values based on schema type
      if (typeof schema === "object" && schema !== null && schema.type) {
        if (schema.type === "string") {
          if (schema.enum && Array.isArray(schema.enum)) {
            simulatedContent[key] = schema.enum[0];
          } else if (schema.format) {
            switch (schema.format) {
              case "email":
                simulatedContent[key] = "demo@example.com";
                break;
              case "uri":
                simulatedContent[key] = "https://demo.example.com";
                break;
              case "date":
                simulatedContent[key] = "2024-01-01";
                break;
              case "date-time":
                simulatedContent[key] = "2024-01-01T00:00:00Z";
                break;
              default:
                simulatedContent[key] = `demo_${key}`;
            }
          } else {
            simulatedContent[key] = `demo_${key}`;
          }
        } else if (schema.type === "number" || schema.type === "integer") {
          const min = typeof schema.minimum === "number" ? schema.minimum : 0;
          const max = typeof schema.maximum === "number" ? schema.maximum : 100;

          if (schema.type === "integer") {
            simulatedContent[key] = Math.floor(Math.random() * (max - min + 1)) + min;
          } else {
            simulatedContent[key] = Math.random() * (max - min) + min;
          }
        } else if (schema.type === "boolean") {
          simulatedContent[key] = Math.random() > 0.5;
        }
      }
    }
  }

  return simulatedContent;
}
