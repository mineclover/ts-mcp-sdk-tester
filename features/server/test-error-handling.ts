import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const TestErrorHandlingSchema = z.object({
  errorType: z.enum([
    "validation_error",
    "runtime_error", 
    "timeout_simulation",
    "memory_error",
    "null_reference",
    "async_error",
    "json_parse_error",
    "custom_error"
  ]).describe("Type of error to simulate"),
  severity: z.enum(["low", "medium", "high"]).default("medium").describe("Error severity level"),
  includeStackTrace: z.boolean().default(true).describe("Include stack trace in error response"),
  customMessage: z.string().optional().describe("Custom error message for custom_error type"),
});

export function registerTestErrorHandling(server: McpServer) {
  server.tool(
    "test_error_handling",
    "Test various error conditions and server error handling capabilities",
    {
      type: "object",
      properties: {
        errorType: {
          type: "string",
          enum: [
            "validation_error",
            "runtime_error", 
            "timeout_simulation",
            "memory_error",
            "null_reference",
            "async_error",
            "json_parse_error",
            "custom_error"
          ],
          description: "Type of error to simulate",
        },
        severity: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Error severity level",
          default: "medium",
        },
        includeStackTrace: {
          type: "boolean",
          description: "Include stack trace in error response",
          default: true,
        },
        customMessage: {
          type: "string",
          description: "Custom error message for custom_error type",
        },
      },
      required: ["errorType"],
    },
    async (args) => {
      try {
        const params = TestErrorHandlingSchema.parse(args);
        
        const errorInfo = {
          timestamp: new Date().toISOString(),
          errorType: params.errorType,
          severity: params.severity,
          includeStackTrace: params.includeStackTrace,
        };

        // Simulate different types of errors
        switch (params.errorType) {
          case "validation_error":
            // Simulate a validation error
            throw new Error("Validation failed: Required field 'username' is missing");

          case "runtime_error":
            // Simulate a runtime error
            const undefinedObj: any = undefined;
            return undefinedObj.someProperty; // This will throw

          case "timeout_simulation":
            // Simulate a timeout scenario
            await new Promise(resolve => setTimeout(resolve, 100));
            throw new Error("Operation timed out after 100ms");

          case "memory_error":
            // Simulate memory-related error
            if (params.severity === "high") {
              // Don't actually create a memory leak, just simulate
              throw new Error("OutOfMemoryError: Heap exhausted - unable to allocate memory");
            } else {
              throw new Error("Memory warning: High memory usage detected");
            }

          case "null_reference":
            // Simulate null reference error
            const nullValue: any = null;
            return nullValue.toString(); // This will throw

          case "async_error":
            // Simulate an async operation error
            await new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error("Async operation failed: Database connection lost"));
              }, 50);
            });
            break;

          case "json_parse_error":
            // Simulate JSON parsing error
            const invalidJson = '{"invalid": json syntax}';
            JSON.parse(invalidJson);
            break;

          case "custom_error":
            // Simulate custom error with user message
            const message = params.customMessage || "Custom error condition triggered";
            const error = new Error(message);
            error.name = "CustomTestError";
            throw error;

          default:
            throw new Error(`Unknown error type: ${params.errorType}`);
        }

        // This should not be reached due to errors above
        return {
          content: [
            {
              type: "text" as const,
              text: "Error simulation completed unexpectedly without throwing an error",
            },
          ],
          structuredContent: {
            ...errorInfo,
            unexpectedSuccess: true,
          },
          isError: true,
        };

      } catch (simulatedError) {
        // This is the expected path - we want to catch and report the simulated error
        const errorDetails: any = {
          timestamp: new Date().toISOString(),
          errorType: args?.errorType || "unknown",
          severity: args?.severity || "medium",
          errorName: simulatedError instanceof Error ? simulatedError.name : "UnknownError",
          errorMessage: simulatedError instanceof Error ? simulatedError.message : String(simulatedError),
          wasSimulated: true,
        };

        if (args?.includeStackTrace !== false && simulatedError instanceof Error) {
          errorDetails.stackTrace = simulatedError.stack;
        }

        // Add severity-specific handling
        if (args?.severity === "high") {
          errorDetails.requiresImmedateAttention = true;
          errorDetails.suggestedAction = "Check server logs and restart if necessary";
        } else if (args?.severity === "medium") {
          errorDetails.suggestedAction = "Monitor for recurring issues";
        } else {
          errorDetails.suggestedAction = "Log for debugging purposes";
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully simulated ${args?.errorType || "unknown"} error:\n` +
                    `- Error: ${errorDetails.errorName}\n` +
                    `- Message: ${errorDetails.errorMessage}\n` +
                    `- Severity: ${errorDetails.severity}\n` +
                    `- Suggested Action: ${errorDetails.suggestedAction}`,
            },
          ],
          structuredContent: errorDetails,
          // Note: We don't set isError: true here because this is a successful test of error handling
        };
      }
    }
  );
}