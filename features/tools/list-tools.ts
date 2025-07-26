import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { 
  ListToolsRequest, 
  ListToolsResult,
  PaginatedRequest
} from "../../spec/mcp_spec.js";

const ListToolsParamsSchema = z.object({
  cursor: z.string().optional(),
  _meta: z.object({}).passthrough().optional(),
}).optional();

/**
 * Registers the tools/list endpoint handler
 * Returns a list of all available tools from the server
 */
export function registerListTools(server: McpServer) {
  server.request(
    {
      method: "tools/list",
      schema: {
        params: ListToolsParamsSchema,
      },
    },
    async (request): Promise<ListToolsResult> => {
      const { cursor } = request.params || {};
      
      // Get all registered tools from the server
      const allTools = Array.from((server as any)._tools.values());
      
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
        tools: tools.map(tool => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          annotations: tool.annotations,
          _meta: tool._meta,
        })),
      };
      
      // Add pagination cursor if there are more results
      if (endIndex < allTools.length) {
        result.nextCursor = endIndex.toString();
      }
      
      return result;
    }
  );
}