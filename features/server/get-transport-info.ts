import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGetTransportInfo(server: McpServer) {
  server.tool(
    "get_transport_info",
    "Get information about the current transport layer and connection details",
    {
      type: "object",
      properties: {},
    },
    async () => {
      try {
        // Get basic connection information
        const isConnected = server.isConnected();
        
        // Access internal transport information if available
        // Note: This accesses private members, which is not ideal but necessary for testing
        const serverAny = server as any;
        const transport = serverAny._transport;
        
        const transportInfo: any = {
          isConnected,
          transportType: transport?.constructor?.name || "unknown",
          transportAvailable: !!transport,
        };

        // Try to get additional transport details
        if (transport) {
          // Check for common transport properties
          if (typeof transport.name === 'string') {
            transportInfo.name = transport.name;
          }
          if (typeof transport.version === 'string') {
            transportInfo.version = transport.version;
          }
          if (typeof transport.description === 'string') {
            transportInfo.description = transport.description;
          }
          
          // Check for stdio transport specifics
          if (transport.stdin || transport.stdout) {
            transportInfo.isStdioTransport = true;
            transportInfo.hasStdin = !!transport.stdin;
            transportInfo.hasStdout = !!transport.stdout;
          }
          
          // Check for readable/writable streams
          if (transport.readable !== undefined) {
            transportInfo.readable = transport.readable;
          }
          if (transport.writable !== undefined) {
            transportInfo.writable = transport.writable;
          }
        }

        // Get server startup time and runtime info
        const startTime = serverAny._startTime || "unknown";
        const uptime = startTime !== "unknown" ? Date.now() - startTime : "unknown";

        return {
          content: [
            {
              type: "text" as const,
              text: `Transport Information:\n` +
                    `- Connected: ${isConnected}\n` +
                    `- Transport Type: ${transportInfo.transportType}\n` +
                    `- Transport Available: ${transportInfo.transportAvailable}\n` +
                    `- Uptime: ${typeof uptime === 'number' ? `${Math.round(uptime / 1000)}s` : uptime}`,
            },
          ],
          structuredContent: {
            transport: transportInfo,
            runtime: {
              startTime: startTime,
              uptime: uptime,
              uptimeFormatted: typeof uptime === 'number' ? `${Math.round(uptime / 1000)}s` : uptime,
            },
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting transport info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}