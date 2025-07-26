import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  GetPromptResult,
  PromptMessage,
  ContentBlock
} from "../../spec/current_spec.js";

/**
 * Registers the prompts/get endpoint handler
 * Gets a specific prompt by name with optional arguments for templating
 */
export function registerGetPrompt(server: McpServer) {
  server.server.setRequestHandler(
    GetPromptRequestSchema,
    async (request): Promise<GetPromptResult> => {
      const { name, arguments: args } = request.params;
      
      // Sample prompt templates
      let description: string;
      let messages: PromptMessage[];
      
      if (name === "greeting") {
        const nameArg = args?.name || "World";
        description = "A friendly greeting prompt";
        messages = [
          {
            role: "user",
            content: {
              type: "text",
              text: `Hello, ${nameArg}! How are you today?`,
            } as ContentBlock,
          }
        ];
      } else if (name === "code-review") {
        const language = args?.language || "JavaScript";
        const context = args?.context || "general code review";
        description = "A code review prompt template";
        messages = [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please review this ${language} code. Context: ${context}\n\nPlease check for:
- Code quality and best practices
- Potential bugs or issues  
- Performance considerations
- Security concerns
- Documentation completeness`,
            } as ContentBlock,
          }
        ];
      } else if (name === "simple-prompt") {
        description = "A simple static prompt";
        messages = [
          {
            role: "user",
            content: {
              type: "text",
              text: "This is a simple prompt without any templating.",
            } as ContentBlock,
          }
        ];
      } else {
        throw new Error(`Prompt not found: ${name}`);
      }
      
      const result: GetPromptResult = {
        description,
        messages,
        _meta: {
          promptName: name,
          generatedAt: new Date().toISOString(),
          arguments: args,
        },
      };
      
      return result;
    }
  );
}