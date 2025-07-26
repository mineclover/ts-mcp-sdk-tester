import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListRegisteredTools } from "./list-registered-tools.js";
import { registerRegisterAdvancedTool } from "./register-advanced-tool.js";
import { registerRegisterAsyncTool } from "./register-async-tool.js";
import { registerRegisterParameterizedTool } from "./register-parameterized-tool.js";
// Import individual tool management tools
import { registerRegisterSimpleTool } from "./register-simple-tool.js";

/**
 * Tool Management Features
 * Tests simple tools, parameterized tools, and advanced tool features
 */

export function registerToolFeatures(server: McpServer) {
  // Register all tool management tools
  registerRegisterSimpleTool(server);
  registerRegisterParameterizedTool(server);
  registerRegisterAdvancedTool(server);
  registerRegisterAsyncTool(server);
  registerListRegisteredTools(server);
}

// Re-export shared state for cross-tool access
export { registeredTools } from "./register-simple-tool.js";
