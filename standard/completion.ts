import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CompleteRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  CompleteResult,
  PromptReference,
  ResourceTemplateReference
} from "../spec/current_spec.js";

/**
 * Standard MCP Completion Endpoints
 * 
 * Implements the core MCP completion protocol endpoints:
 * - completion/complete: Provide argument completion suggestions
 */

export function registerCompletionEndpoints(server: McpServer) {
  registerComplete(server);
}

/**
 * completion/complete endpoint
 * Provide completion suggestions for prompt or resource template arguments
 */
function registerComplete(server: McpServer) {
  server.server.setRequestHandler(
    CompleteRequestSchema,
    async (request): Promise<CompleteResult> => {
      const { ref, argument, context } = request.params;
      
      // Generate completion suggestions based on the reference type and argument
      let completionValues: string[] = [];
      
      if (ref.type === "ref/prompt") {
        // Prompt argument completions
        if (argument.name === "name") {
          completionValues = ["John", "Jane", "Alice", "Bob", "Charlie"];
        } else if (argument.name === "language") {
          completionValues = ["JavaScript", "TypeScript", "Python", "Go", "Rust", "Java"];
        } else if (argument.name === "context") {
          completionValues = ["general", "specific", "detailed", "brief"];
        } else if (argument.name === "text") {
          completionValues = ["Sample text", "Lorem ipsum", "Example content"];
        } else if (argument.name === "length") {
          completionValues = ["brief", "medium", "detailed"];
        } else {
          // Generic completions for unknown arguments
          completionValues = [`${argument.value}_option1`, `${argument.value}_option2`, `${argument.value}_option3`];
        }
      } else if (ref.type === "ref/resource") {
        // Resource template argument completions
        const uri = ref.uri;
        
        if (uri.includes("{path}")) {
          completionValues = [
            "/home/user/documents",
            "/tmp/temp-file.txt", 
            "/var/log/app.log",
            "/etc/config.json"
          ];
        } else if (uri.includes("{endpoint}")) {
          completionValues = ["users", "posts", "comments", "products", "orders"];
        } else if (uri.includes("{id}")) {
          completionValues = ["1", "2", "3", "123", "456"];
        } else {
          // Generic resource completions
          completionValues = ["resource1", "resource2", "resource3"];
        }
      }
      
      // Filter completions based on the current argument value
      if (argument.value) {
        completionValues = completionValues.filter(value => 
          value.toLowerCase().includes(argument.value.toLowerCase())
        );
      }
      
      // Limit to 100 items as per spec
      const limitedValues = completionValues.slice(0, 100);
      
      const result: CompleteResult = {
        completion: {
          values: limitedValues,
          total: completionValues.length,
          hasMore: completionValues.length > 100,
        },
        _meta: {
          argumentName: argument.name,
          argumentValue: argument.value,
          referenceType: ref.type,
          context: context,
          generatedAt: new Date().toISOString(),
        },
      };
      
      return result;
    }
  );
}