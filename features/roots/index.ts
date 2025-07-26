import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListRoots } from "./list-roots.js";

/**
 * Roots Features
 * Tests root directory listing capabilities
 */

export function registerRootsFeatures(server: McpServer) {
  // Register roots endpoints
  registerListRoots(server);
}