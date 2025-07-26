import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Get Server Info Tool
 * Returns server metadata and status information
 */

export function registerGetServerInfo(server: McpServer) {
  server.registerTool(
    "get_server_info",
    {
      title: "Get Server Info",
      description: "Get comprehensive server information and status",
      inputSchema: {},
    },
    async () => {
      try {
        const serverInfo = {
          name: "MCP SDK Tester",
          version: "1.0.0",
          connected: server.isConnected(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          pid: process.pid,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          timestamp: new Date().toISOString(),
          capabilities: {
            logging: true,
            resources: true,
            tools: true,
            prompts: true,
            notifications: true,
          }
        };

        return {
          content: [
            {
              type: "text" as const,
              text: `Server Information:\n${JSON.stringify(serverInfo, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting server info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}