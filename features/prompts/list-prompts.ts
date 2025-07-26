import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  ListPromptsResult,
  Prompt
} from "../../spec/current_spec.js";

/**
 * Registers the prompts/list endpoint handler
 * Returns a list of all available prompts from the server
 */
export function registerListPrompts(server: McpServer) {
  server.server.setRequestHandler(
    ListPromptsRequestSchema,
    async (request): Promise<ListPromptsResult> => {
      const { cursor } = request.params || {};
      
      // Sample prompts for demonstration
      const allPrompts: Prompt[] = [
        {
          name: "greeting",
          title: "Greeting Prompt",
          description: "A simple greeting prompt template",
          arguments: [
            {
              name: "name",
              title: "Name",
              description: "The name to greet",
              required: true,
            }
          ],
          _meta: { created: new Date().toISOString() },
        },
        {
          name: "code-review",
          title: "Code Review Prompt",
          description: "Prompt for reviewing code changes",
          arguments: [
            {
              name: "language",
              title: "Programming Language",
              description: "The programming language of the code",
              required: true,
            },
            {
              name: "context",
              title: "Context",
              description: "Additional context for the review",
              required: false,
            }
          ],
          _meta: { created: new Date().toISOString() },
        },
        {
          name: "simple-prompt",
          title: "Simple Prompt",
          description: "A basic prompt without arguments",
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
      const prompts = allPrompts.slice(startIndex, endIndex);
      
      const result: ListPromptsResult = {
        prompts,
        _meta: {
          totalCount: allPrompts.length,
          pageSize,
          startIndex,
        },
      };
      
      // Add pagination cursor if there are more results
      if (endIndex < allPrompts.length) {
        result.nextCursor = endIndex.toString();
      }
      
      return result;
    }
  );
}