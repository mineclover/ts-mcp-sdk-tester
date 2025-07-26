import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  CallToolResult,
  ContentBlock
} from "../../spec/current_spec.js";

/**
 * Registers the tools/call endpoint handler
 * Calls a specific tool by name with optional arguments
 */
export function registerCallTool(server: McpServer) {
  server.server.setRequestHandler(
    CallToolRequestSchema,
    async (request): Promise<CallToolResult> => {
      const { name, arguments: args } = request.params;
      
      try {
        // Handle sample tools
        let content: ContentBlock[];
        let structuredContent: { [key: string]: unknown } | undefined;
        let isError = false;
        
        if (name === "echo") {
          const message = args?.message;
          if (!message) {
            throw new Error("Message parameter is required");
          }
          
          content = [{
            type: "text",
            text: `Echo: ${message}`,
          }];
          
          structuredContent = {
            originalMessage: message,
            echoed: true,
            timestamp: new Date().toISOString(),
          };
          
        } else if (name === "calculator") {
          const { operation, a, b } = args || {};
          
          if (!operation || typeof a !== 'number' || typeof b !== 'number') {
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
          
          content = [{
            type: "text",
            text: `Calculation: ${a} ${operation} ${b} = ${result}`,
          }];
          
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
            type: typeof filepath === 'string' ? filepath.split('.').pop() || 'unknown' : 'unknown',
            lastModified: new Date().toISOString(),
            readable: true,
            writable: Math.random() > 0.5,
          };
          
          content = [{
            type: "text",
            text: `File Info for ${filepath}:\n` +
                 `Size: ${info.size} bytes\n` +
                 `Type: ${info.type}\n` +
                 `Last Modified: ${info.lastModified}\n` +
                 `Readable: ${info.readable}\n` +
                 `Writable: ${info.writable}`,
          }];
          
          structuredContent = info;
          
        } else {
          throw new Error(`Tool not found: ${name}`);
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
        
        return result;
        
      } catch (error) {
        // Return error as a tool result, not as a protocol error
        return {
          content: [{
            type: 'text',
            text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
          } as ContentBlock],
          isError: true,
          _meta: {
            toolName: name,
            executedAt: new Date().toISOString(),
            arguments: args,
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }
  );
}