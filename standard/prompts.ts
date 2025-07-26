import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import type { 
  ListPromptsResult,
  GetPromptResult,
  Prompt,
  PromptMessage,
  ContentBlock
} from "../spec/current_spec.js";

/**
 * Standard MCP Prompts Endpoints
 * 
 * Implements the core MCP prompt management protocol endpoints:
 * - prompts/list: List available prompts and prompt templates
 * - prompts/get: Get a specific prompt with optional templating
 */

export function registerPromptsEndpoints(server: McpServer) {
  registerListPrompts(server);
  registerGetPrompt(server);
}

/**
 * prompts/list endpoint
 * Returns a paginated list of available prompts and prompt templates
 */
function registerListPrompts(server: McpServer) {
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
        },
        {
          name: "simple-prompt",
          title: "Simple Prompt",
          description: "A basic prompt without arguments",
        },
        {
          name: "summarize",
          title: "Text Summarization",
          description: "Summarize text content",
          arguments: [
            {
              name: "text",
              title: "Text to Summarize",
              description: "The text content to be summarized",
              required: true,
            },
            {
              name: "length",
              title: "Summary Length",
              description: "Desired length: brief, medium, or detailed",
              required: false,
            }
          ],
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

/**
 * prompts/get endpoint
 * Gets a specific prompt by name with optional templating arguments
 */
function registerGetPrompt(server: McpServer) {
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
              text: `Please review this ${language} code. Context: ${context}

Please check for:
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
      } else if (name === "summarize") {
        const text = args?.text || "[No text provided]";
        const length = args?.length || "medium";
        description = "Text summarization prompt";
        messages = [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please provide a ${length} summary of the following text:

${text}`,
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