import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ListRootsResult, Root } from "../spec/current_spec.js";

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

    // Simulate typical development environment roots
    const simulatedRoots: Root[] = [
      {
        uri: "file:///Users/developer/projects",
        name: "Projects Directory",
        _meta: {
          description: "Main projects directory",
          simulatedRoot: true,
          type: "directory",
        },
      },
      {
        uri: "file:///Users/developer/documents",
        name: "Documents",
        _meta: {
          description: "User documents directory",
          simulatedRoot: true,
          type: "directory",
        },
      },
      {
        uri: "file:///tmp",
        name: "Temporary Files",
        _meta: {
          description: "System temporary directory",
          simulatedRoot: true,
          type: "directory",
        },
      },
      {
        uri: "file:///var/log",
        name: "System Logs",
        _meta: {
          description: "System log files directory",
          simulatedRoot: true,
          type: "directory",
        },
      },
      {
        uri: "file:///etc/config",
        name: "Configuration Files",
        _meta: {
          description: "System configuration directory",
          simulatedRoot: true,
          type: "directory",
        },
      },
    ];

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
