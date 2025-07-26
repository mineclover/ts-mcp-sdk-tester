import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListRegisteredResources } from "./list-registered-resources.js";
import { registerRegisterRichResource } from "./register-rich-resource.js";
// Import individual resource tools
import { registerRegisterSimpleResource } from "./register-simple-resource.js";
import { registerRegisterTemplateResource } from "./register-template-resource.js";
// Import MCP spec endpoint implementations
import { registerListResources } from "./list-resources.js";
import { registerListResourceTemplates } from "./list-resource-templates.js";
import { registerReadResource } from "./read-resource.js";
import { registerSubscribeResource } from "./subscribe-resource.js";
import { registerUnsubscribeResource } from "./unsubscribe-resource.js";

/**
 * Resource Management Features
 * Tests static resources, templates, and resource lifecycle
 */

export function registerResourceFeatures(server: McpServer) {
  // Register all resource management tools
  registerRegisterSimpleResource(server);
  registerRegisterTemplateResource(server);
  registerRegisterRichResource(server);
  registerListRegisteredResources(server);
  
  // Register MCP spec endpoint implementations
  registerListResources(server);
  registerListResourceTemplates(server);
  registerReadResource(server);
  registerSubscribeResource(server);
  registerUnsubscribeResource(server);
}

// Re-export shared state for cross-tool access
export { registeredResources } from "./register-simple-resource.js";
