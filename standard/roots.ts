import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ListRootsResult, Root } from "../spec/current_spec.js";
import { DEMO_ROOTS } from "../demo/index.js";

/**
 * Standard MCP Roots Endpoints
 *
 * Implements the core MCP roots protocol endpoints:
 * - roots/list: Request list of root URIs from client
 */

export function registerRootsEndpoints(server: McpServer) {
  registerListRoots(server);
}

/**
 * roots/list endpoint
 * Requests a list of root URIs from the client
 */
function registerListRoots(server: McpServer) {
  server.server.setRequestHandler(ListRootsRequestSchema, async (): Promise<ListRootsResult> => {
    // This is a server-to-client request, so in a real implementation,
    // the server would send this request to the client to get available roots.
    // For testing purposes, we'll simulate a response.

    // Get demo roots from separated demo data
    const simulatedRoots: Root[] = DEMO_ROOTS.map(root => ({
      ...root,
      _meta: {
        ...root._meta,
        simulatedRoot: true,
        requestedAt: new Date().toISOString(),
      },
    }));

    const result: ListRootsResult = {
      roots: simulatedRoots,
      _meta: {
        simulatedResponse: true,
        requestId: Date.now().toString(),
        totalRoots: simulatedRoots.length,
        platform: process.platform,
      },
    };

    return result;
  });
}
