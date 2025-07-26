import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerStandardEndpoints, parseArguments, setupTransport } from "./standard/index.js";
import { APP_CONFIG } from "./standard/constants.js";
import { logger } from "./standard/logger.js";

/**
 * MCP SDK Tester - A comprehensive testing server for MCP SDK features
 *
 * This server exposes all MCP SDK features as tools for testing via MCP.
 * Supports stdio, and streamable HTTP transports.
 */

function createServer() {
  const server = new McpServer(
    {
      name: APP_CONFIG.displayName,
      version: APP_CONFIG.version,
    },
    { 
      capabilities: { 
        logging: {},
        completions: {},
        resources: {
          subscribe: true,
          listChanged: true,
        },
        prompts: {
          listChanged: true,
        },
        tools: {
          listChanged: true,
        },
        sampling: {},
        roots: {
          listChanged: true,
        },
      } 
    }
  );

  // Register standard MCP protocol endpoints
  registerStandardEndpoints(server);


  return server;
}

// Main function
async function main() {
  const options = parseArguments();
  const server = createServer();

  setupTransport(server, options);
}

// Handle server shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down server...", "main");
  process.exit(0);
});

if (import.meta.main) {
  main().catch((error) => {
    logger.error(`Main process error: ${error}`, "main");
    console.error(error); // Keep console.error for critical startup errors
  });
}
