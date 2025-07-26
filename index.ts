import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Import all modular features
import { registerServerFeatures } from './features/server/index.js';
import { registerResourceFeatures } from './features/resources/index.js';
import { registerToolFeatures } from './features/tools/index.js';
import { registerPromptFeatures } from './features/prompts/index.js';
import { registerContentFeatures } from './features/content/index.js';
import { registerNotificationFeatures } from './features/notifications/index.js';
import { setupTransport, parseArguments } from './features/transports/index.js';

/**
 * MCP SDK Tester - A comprehensive testing server for MCP SDK features
 * 
 * This server exposes all MCP SDK features as tools for testing via MCP.
 * Supports stdio, http+sse, and streamable HTTP transports.
 */

function createServer() {
  const server = new McpServer({
    name: 'MCP SDK Tester',
    version: '1.0.0',
  }, { capabilities: { logging: {} } });

  // Register all modular features
  registerServerFeatures(server);
  registerResourceFeatures(server);
  registerToolFeatures(server);
  registerPromptFeatures(server);
  registerContentFeatures(server);
  registerNotificationFeatures(server);

  // Add comprehensive test tool
  server.registerTool(
    "run_comprehensive_test",
    {
      title: "Run Comprehensive Test",
      description: "Run a comprehensive test of all MCP server features",
      inputSchema: {},
    },
    async () => {
      try {
        const results: string[] = [];
        
        // Test server connection
        results.push(`Server connected: ${server.isConnected()}`);
        
        // Test resource registration
        server.registerResource("test-resource", "test://resource", {
          title: "Test Resource",
          description: "Test resource for comprehensive testing",
        }, async (uri: any) => ({
          contents: [{ uri: uri.href, text: "Test content" }],
        }));
        results.push("✓ Static resource registered");
        
        // Test tool registration
        server.registerTool("test-tool", {
          title: "Test Tool",
          description: "Test tool",
          inputSchema: {},
        }, async () => ({
          content: [{ type: "text" as const, text: "Test tool executed" }],
        }));
        results.push("✓ Tool registered");
        
        // Test prompt registration
        server.registerPrompt("test-prompt", {
          title: "Test Prompt",
          description: "Test prompt",
          argsSchema: {},
        }, () => ({
          messages: [{ role: "user" as const, content: { type: "text" as const, text: "Test prompt" } }],
        }));
        results.push("✓ Prompt registered");
        
        // Test notifications
        server.sendResourceListChanged();
        results.push("✓ Resource list changed notification sent");
        
        server.sendToolListChanged();
        results.push("✓ Tool list changed notification sent");
        
        server.sendPromptListChanged();
        results.push("✓ Prompt list changed notification sent");
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Comprehensive test completed:\n${results.join('\n')}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error running comprehensive test: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );






  return server;
}



// Main function
async function main() {
  const options = parseArguments();
  const server = createServer();
  
  setupTransport(server, options);
}

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});

if (import.meta.main) {
  main().catch(console.error);
}