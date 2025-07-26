import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { 
  GetPromptRequest, 
  GetPromptResult
} from "../../spec/mcp_spec.js";

const GetPromptParamsSchema = z.object({
  name: z.string(),
  arguments: z.object({}).passthrough().optional(),
  _meta: z.object({}).passthrough().optional(),
});

/**
 * Registers the prompts/get endpoint handler
 * Gets a specific prompt by name with optional arguments for templating
 */
export function registerGetPrompt(server: McpServer) {
  server.request(
    {
      method: "prompts/get",
      schema: {
        params: GetPromptParamsSchema,
      },
    },
    async (request): Promise<GetPromptResult> => {
      const { name, arguments: args } = request.params;
      
      // Find the prompt handler in the server
      const promptHandler = (server as any)._prompts.get(name);
      
      if (!promptHandler) {
        throw new Error(`Prompt not found: ${name}`);
      }
      
      try {
        // Call the prompt handler with arguments
        const promptResult = await promptHandler.handler(args || {});
        
        // Ensure the result has the correct structure
        if (!promptResult || typeof promptResult !== 'object') {
          throw new Error(`Invalid prompt result for: ${name}`);
        }
        
        // Handle different prompt result formats
        let description: string | undefined;
        let messages: any[] = [];
        
        if ('description' in promptResult) {
          description = promptResult.description;
        }
        
        if ('messages' in promptResult && Array.isArray(promptResult.messages)) {
          messages = promptResult.messages;
        } else if ('message' in promptResult) {
          // Single message format
          messages = [promptResult.message];
        } else if ('content' in promptResult) {
          // Content format - wrap in a message
          messages = [{
            role: 'user',
            content: promptResult.content
          }];
        } else if (typeof promptResult === 'string') {
          // Plain string format
          messages = [{
            role: 'user',
            content: {
              type: 'text',
              text: promptResult
            }
          }];
        }
        
        // Validate messages format
        messages = messages.map(msg => {
          if (typeof msg === 'string') {
            return {
              role: 'user',
              content: {
                type: 'text',
                text: msg
              }
            };
          }
          
          if (msg && typeof msg === 'object') {
            // Ensure role is set
            if (!msg.role) {
              msg.role = 'user';
            }
            
            // Ensure content is in the correct format
            if (typeof msg.content === 'string') {
              msg.content = {
                type: 'text',
                text: msg.content
              };
            }
          }
          
          return msg;
        });
        
        return {
          description,
          messages,
        };
        
      } catch (error) {
        throw new Error(`Failed to get prompt ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}