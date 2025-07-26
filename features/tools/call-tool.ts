import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { 
  CallToolRequest, 
  CallToolResult
} from "../../spec/mcp_spec.js";

const CallToolParamsSchema = z.object({
  name: z.string(),
  arguments: z.object({}).passthrough().optional(),
  _meta: z.object({}).passthrough().optional(),
});

/**
 * Registers the tools/call endpoint handler
 * Calls a specific tool by name with optional arguments
 */
export function registerCallTool(server: McpServer) {
  server.request(
    {
      method: "tools/call",
      schema: {
        params: CallToolParamsSchema,
      },
    },
    async (request): Promise<CallToolResult> => {
      const { name, arguments: args } = request.params;
      
      // Find the tool handler in the server
      const toolHandler = (server as any)._tools.get(name);
      
      if (!toolHandler) {
        throw new Error(`Tool not found: ${name}`);
      }
      
      try {
        // Call the tool handler with arguments
        const toolResult = await toolHandler.handler(args || {});
        
        // Ensure the result has the correct structure
        if (!toolResult || typeof toolResult !== 'object') {
          // Handle simple string/primitive results
          return {
            content: [{
              type: 'text',
              text: String(toolResult || 'Tool executed successfully')
            }],
            isError: false,
          };
        }
        
        // Handle different tool result formats
        let content: any[] = [];
        let structuredContent: any = undefined;
        let isError: boolean = false;
        
        if ('isError' in toolResult) {
          isError = Boolean(toolResult.isError);
        }
        
        if ('structuredContent' in toolResult) {
          structuredContent = toolResult.structuredContent;
        }
        
        if ('content' in toolResult && Array.isArray(toolResult.content)) {
          content = toolResult.content;
        } else if ('content' in toolResult) {
          // Single content item
          if (typeof toolResult.content === 'string') {
            content = [{
              type: 'text',
              text: toolResult.content
            }];
          } else {
            content = [toolResult.content];
          }
        } else if ('text' in toolResult) {
          // Direct text result
          content = [{
            type: 'text',
            text: toolResult.text
          }];
        } else if ('result' in toolResult) {
          // Wrapped result
          content = [{
            type: 'text',
            text: JSON.stringify(toolResult.result, null, 2)
          }];
        } else {
          // Default: stringify the entire result
          content = [{
            type: 'text',
            text: JSON.stringify(toolResult, null, 2)
          }];
        }
        
        // Validate content format
        content = content.map(item => {
          if (typeof item === 'string') {
            return {
              type: 'text',
              text: item
            };
          }
          
          if (item && typeof item === 'object') {
            // Ensure type is set
            if (!item.type) {
              if ('text' in item) {
                item.type = 'text';
              } else if ('data' in item && 'mimeType' in item) {
                item.type = 'image'; // or 'audio' based on mimeType
              } else {
                item.type = 'text';
                if (!item.text) {
                  item.text = JSON.stringify(item);
                }
              }
            }
          }
          
          return item;
        });
        
        const result: CallToolResult = {
          content,
          isError,
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
            text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}