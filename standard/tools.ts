import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult, ContentBlock, ListToolsResult, Tool } from "../spec/current_spec.js";
import { logger } from "./logger.js";

/**
 * Standard MCP Tools Endpoints
 *
 * Implements the core MCP tool management protocol endpoints:
 * - tools/list: List available tools
 * - tools/call: Call a specific tool with arguments
 */

export function registerToolsEndpoints(server: McpServer) {
  logger.logMethodEntry("registerToolsEndpoints", undefined, "tools");
  registerListTools(server);
  registerCallTool(server);
}

/**
 * tools/list endpoint
 * Returns a paginated list of available tools
 */
function registerListTools(server: McpServer) {
  logger.logMethodEntry("registerListTools", undefined, "tools");

  server.server.setRequestHandler(
    ListToolsRequestSchema,
    async (request, extra): Promise<ListToolsResult> => {
      await logger.logEndpointEntry("tools/list", extra.requestId, request.params);

      const { cursor } = request.params || {};

      // Sample tools for demonstration
      const allTools: Tool[] = [
        {
          name: "echo",
          title: "Echo Tool",
          description: "Echoes back the input message",
          inputSchema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The message to echo back",
              },
            },
            required: ["message"],
          },
          annotations: {
            title: "Echo Tool",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        {
          name: "calculator",
          title: "Calculator Tool",
          description: "Performs basic mathematical calculations",
          inputSchema: {
            type: "object",
            properties: {
              operation: {
                type: "string",
                description: "The operation to perform (add, subtract, multiply, divide)",
              },
              a: {
                type: "number",
                description: "First number",
              },
              b: {
                type: "number",
                description: "Second number",
              },
            },
            required: ["operation", "a", "b"],
          },
          outputSchema: {
            type: "object",
            properties: {
              result: {
                type: "number",
                description: "The calculation result",
              },
            },
            required: ["result"],
          },
          annotations: {
            title: "Calculator",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        {
          name: "file-info",
          title: "File Information Tool",
          description: "Gets information about a file",
          inputSchema: {
            type: "object",
            properties: {
              filepath: {
                type: "string",
                description: "Path to the file to analyze",
              },
            },
            required: ["filepath"],
          },
          annotations: {
            title: "File Info",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
          },
        },
        {
          name: "random-number",
          title: "Random Number Generator",
          description: "Generates a random number within a specified range",
          inputSchema: {
            type: "object",
            properties: {
              min: {
                type: "number",
                description: "Minimum value (inclusive)",
              },
              max: {
                type: "number",
                description: "Maximum value (inclusive)",
              },
            },
            required: ["min", "max"],
          },
          outputSchema: {
            type: "object",
            properties: {
              value: {
                type: "number",
                description: "The generated random number",
              },
            },
            required: ["value"],
          },
          annotations: {
            title: "Random Number",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
          },
        },
      ];

      // Simple pagination implementation
      const pageSize = 10;
      let startIndex = 0;

      if (cursor) {
        try {
          startIndex = parseInt(cursor, 10);
        } catch {
          startIndex = 0;
        }
      }

      const endIndex = startIndex + pageSize;
      const tools = allTools.slice(startIndex, endIndex);

      const result: ListToolsResult = {
        tools,
        _meta: {
          totalCount: allTools.length,
          pageSize,
          startIndex,
        },
      };

      // Add pagination cursor if there are more results
      if (endIndex < allTools.length) {
        result.nextCursor = endIndex.toString();
      }

      await logger.logMethodExit("tools/list", { toolCount: tools.length }, "tools");
      return result;
    }
  );
}

/**
 * tools/call endpoint
 * Calls a specific tool by name with provided arguments
 */
function registerCallTool(server: McpServer) {
  logger.logMethodEntry("registerCallTool", undefined, "tools");

  server.server.setRequestHandler(
    CallToolRequestSchema,
    async (request, extra): Promise<CallToolResult> => {
      await logger.logEndpointEntry("tools/call", extra.requestId, {
        name: request.params.name,
        hasArgs: !!request.params.arguments,
      });

      const { name, arguments: args } = request.params;

      try {
        // Handle sample tools
        let content: ContentBlock[];
        let structuredContent: { [key: string]: unknown } | undefined;
        const isError = false;

        if (name === "echo") {
          const message = args?.message;
          if (!message) {
            throw new Error("Message parameter is required");
          }

          content = [
            {
              type: "text",
              text: `Echo: ${message}`,
            },
          ];

          structuredContent = {
            originalMessage: message,
            echoed: true,
            timestamp: new Date().toISOString(),
          };
        } else if (name === "calculator") {
          const { operation, a, b } = args || {};

          if (!operation || typeof a !== "number" || typeof b !== "number") {
            throw new Error("Operation, a, and b parameters are required");
          }

          let result: number;
          switch (operation) {
            case "add":
              result = a + b;
              break;
            case "subtract":
              result = a - b;
              break;
            case "multiply":
              result = a * b;
              break;
            case "divide":
              if (b === 0) {
                throw new Error("Division by zero is not allowed");
              }
              result = a / b;
              break;
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }

          content = [
            {
              type: "text",
              text: `Calculation: ${a} ${operation} ${b} = ${result}`,
            },
          ];

          structuredContent = {
            operation,
            operands: [a, b],
            result,
          };
        } else if (name === "file-info") {
          const { filepath } = args || {};

          if (!filepath) {
            throw new Error("Filepath parameter is required");
          }

          // Simulate file information
          const info = {
            path: filepath,
            size: Math.floor(Math.random() * 10000),
            type: typeof filepath === "string" ? filepath.split(".").pop() || "unknown" : "unknown",
            lastModified: new Date().toISOString(),
            readable: true,
            writable: Math.random() > 0.5,
          };

          content = [
            {
              type: "text",
              text: `File Info for ${filepath}:
Size: ${info.size} bytes
Type: ${info.type}
Last Modified: ${info.lastModified}
Readable: ${info.readable}
Writable: ${info.writable}`,
            },
          ];

          structuredContent = info;
        } else if (name === "random-number") {
          const { min, max } = args || {};

          if (typeof min !== "number" || typeof max !== "number") {
            throw new Error("Min and max parameters are required and must be numbers");
          }

          if (min > max) {
            throw new Error("Min value cannot be greater than max value");
          }

          const value = Math.floor(Math.random() * (max - min + 1)) + min;

          content = [
            {
              type: "text",
              text: `Random number generated: ${value} (range: ${min} to ${max})`,
            },
          ];

          structuredContent = {
            value,
            min,
            max,
            generatedAt: new Date().toISOString(),
          };
        } else {
          const error = new Error(`Tool not found: ${name}`);
          // This will be automatically detected as TOOL_NOT_FOUND by ErrorCodeMapper
          throw error;
        }

        const result: CallToolResult = {
          content,
          isError,
          _meta: {
            toolName: name,
            executedAt: new Date().toISOString(),
            arguments: args,
          },
        };

        if (structuredContent !== undefined) {
          result.structuredContent = structuredContent;
        }

        await logger.logMethodExit("tools/call", { toolName: name, success: true }, "tools");
        return result;
      } catch (error) {
        // Log server error for debugging
        await logger.logServerError(
          error instanceof Error ? error : new Error(String(error)),
          "tools/call",
          { toolName: name, arguments: args }
        );

        // Return error as a tool result, not as a protocol error
        const errorResult = {
          content: [
            {
              type: "text",
              text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
            } as ContentBlock,
          ],
          isError: true,
          _meta: {
            toolName: name,
            executedAt: new Date().toISOString(),
            arguments: args,
            error: error instanceof Error ? error.message : String(error),
          },
        };

        await logger.logMethodExit("tools/call", { toolName: name, success: false }, "tools");
        return errorResult;
      }
    }
  );
}
