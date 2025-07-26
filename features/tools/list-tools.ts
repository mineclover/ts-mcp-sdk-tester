import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  ListToolsResult,
  Tool
} from "../../spec/current_spec.js";

/**
 * Registers the tools/list endpoint handler
 * Returns a list of all available tools from the server
 */
export function registerListTools(server: McpServer) {
  server.server.setRequestHandler(
    ListToolsRequestSchema,
    async (request): Promise<ListToolsResult> => {
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
                description: "The message to echo back"
              }
            },
            required: ["message"]
          },
          annotations: {
            title: "Echo Tool",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
          _meta: { created: new Date().toISOString() },
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
                description: "The operation to perform (add, subtract, multiply, divide)"
              },
              a: {
                type: "number",
                description: "First number"
              },
              b: {
                type: "number", 
                description: "Second number"
              }
            },
            required: ["operation", "a", "b"]
          },
          outputSchema: {
            type: "object",
            properties: {
              result: {
                type: "number",
                description: "The calculation result"
              }
            },
            required: ["result"]
          },
          annotations: {
            title: "Calculator",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
          _meta: { created: new Date().toISOString() },
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
                description: "Path to the file to analyze"
              }
            },
            required: ["filepath"]
          },
          annotations: {
            title: "File Info",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
          },
          _meta: { created: new Date().toISOString() },
        },
      ];
      
      // Simple pagination implementation
      const pageSize = 10;
      let startIndex = 0;
      
      if (cursor) {
        try {
          startIndex = parseInt(cursor, 10);
        } catch (e) {
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
      
      return result;
    }
  );
}