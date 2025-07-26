import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { registerTestTransportCapabilities } from "./test-transport-capabilities.js";

/**
 * Transport Management Features
 * Handles different MCP transport types and server setup with backwards compatibility
 */

export function registerTransportFeatures(server: McpServer) {
  // Register transport testing tools
  registerTestTransportCapabilities(server);
}

export interface TransportOptions {
  port?: number;
  transport?: string;
}

export function setupTransport(server: McpServer, options: TransportOptions = {}) {
  const { port, transport } = options;

  // Determine transport type based on arguments
  const transportType = transport || (port ? "streamable" : "stdio");

  switch (transportType) {
    case "stdio":
      setupStdioTransport(server);
      break;
    default:
      setupStreamableTransport(server, port || 3000);
      break;
  }
}

function setupStdioTransport(server: McpServer) {
  const transport = new StdioServerTransport();
  server.connect(transport);
  console.error("MCP Server running on stdio transport");
}

// Streamable HTTP transport
function setupStreamableTransport(server: McpServer, port: number) {
  const app = express();
  app.use(cors({ origin: "*", exposedHeaders: ["Mcp-Session-Id"] }));
  app.use(express.json());

  // Store transports by session ID
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  // Modern Streamable HTTP endpoint
  app.all("/mcp", async (req: Request, res: Response) => {
    console.error(`Received ${req.method} request to /mcp (Streamable HTTP)`);

    try {
      // Check for existing session ID
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
      } else if (!sessionId && req.method === "POST") {
        // Create new transport for initialization
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            console.error(`Streamable HTTP session initialized: ${sessionId}`);
            transports[sessionId] = transport;
          },
        });

        // Set up onclose handler
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            console.error(`Transport closed for session ${sid}`);
            delete transports[sid];
          }
        };

        // Connect to MCP server
        await server.connect(transport);
      } else {
        // Invalid request
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      // Handle the request with the transport
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling Streamable HTTP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      transport: "streamable-http",
      timestamp: new Date().toISOString(),
      protocol: "2025-03-26",
    });
  });

  // Server info endpoint
  app.get("/info", (_req, res) => {
    res.json({
      name: "MCP SDK Tester",
      version: "1.0.0",
      transport: "streamable-http",
      protocol: "2025-03-26",
      port: port,
      endpoints: {
        mcp: "/mcp",
        health: "/health",
        info: "/info",
      },
      tools: getToolCount(),
    });
  });

  // Root endpoint with server information
  app.get("/", (_req: Request, res: Response) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>MCP SDK Tester</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .modern { color: #28a745; font-weight: bold; }
          .endpoint { background: #f8f9fa; padding: 15px; margin: 15px 0; border-left: 4px solid #007bff; border-radius: 4px; }
          .feature { background: #e3f2fd; padding: 10px; margin: 10px 0; border-radius: 4px; }
          h1 { color: #333; }
          h2 { color: #666; }
          code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
          .tools-count { background: #ffc107; color: #333; padding: 5px 10px; border-radius: 20px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>🚀 MCP SDK Tester</h1>
        <p>Modern MCP server running on port ${port} with <span class="modern">Streamable HTTP Transport</span> (Protocol: 2025-03-26)</p>
        
        <div class="endpoint">
          <h3>🔗 MCP Endpoint</h3>
          <strong>Streamable HTTP Transport</strong><br>
          Endpoint: <code>http://localhost:${port}/mcp</code><br>
          Protocol: 2025-03-26<br>
          Usage: Modern MCP clients and tools
        </div>
        
        <h2>📊 Server Information</h2>
        <ul>
          <li><strong>Health Check:</strong> <a href="/health" target="_blank">/health</a></li>
          <li><strong>Server Info:</strong> <a href="/info" target="_blank">/info</a></li>
          <li><strong>Tools Available:</strong> <span class="tools-count">${getToolCount()} tools</span></li>
        </ul>
        
        <h2>🛠️ Available Features</h2>
        <div class="feature">
          <strong>Server Management</strong><br>
          Connection testing, server information, status monitoring
        </div>
        <div class="feature">
          <strong>Resource Testing</strong><br>
          Simple resources, template resources with autocomplete, rich content types
        </div>
        <div class="feature">
          <strong>Tool Testing</strong><br>
          Simple tools, parameterized tools, advanced tools with annotations, async operations
        </div>
        <div class="feature">
          <strong>Prompt Testing</strong><br>
          Simple prompts, parameterized prompts, conversation flows, dynamic generation
        </div>
        <div class="feature">
          <strong>Content Type Testing</strong><br>
          Text, image, audio, resource content types, mixed content, large content handling
        </div>
        <div class="feature">
          <strong>Notification Testing</strong><br>
          List change notifications, timing tests, registration events
        </div>
        
        <h2>💡 Usage Examples</h2>
        <div class="endpoint">
          <h4>Using MCP Inspector</h4>
          <code>npx @modelcontextprotocol/inspector http://localhost:${port}/mcp</code>
        </div>
        
        <div class="endpoint">
          <h4>Direct HTTP Requests</h4>
          <code>curl -X POST http://localhost:${port}/mcp -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'</code>
        </div>
        
        <p><em>This server provides comprehensive testing capabilities for all MCP SDK features using the modern Streamable HTTP transport.</em></p>
      </body>
      </html>
    `);
  });

  const httpServer = app.listen(port, () => {
    console.error(`MCP Server running on http://localhost:${port} (Streamable HTTP transport)`);
    console.error(`Protocol: 2025-03-26`);
    console.error(`Streamable HTTP endpoint: http://localhost:${port}/mcp`);
    console.error(`Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.error("Shutting down Streamable HTTP server...");
    httpServer.close(() => {
      process.exit(0);
    });
  });
}

// Helper function to get tool count for HTML display
function getToolCount(): number {
  // Return the total number of tools available
  // Based on our comprehensive implementation:
  // Server: 10 tools (check_server_connection, get_server_info, close_server_connection, 
  //                  get_transport_info, get_registry_details, clear_all_registrations,
  //                  validate_registrations, get_performance_metrics, health_check, test_error_handling)
  // Tools: 5 tools (register_simple_tool, register_parameterized_tool, register_advanced_tool, 
  //                 register_async_tool, list_registered_tools)
  // Resources: 4 tools (register_simple_resource, register_template_resource, 
  //                    register_rich_resource, list_registered_resources)
  // Prompts: 5 tools (register_simple_prompt, register_parameterized_prompt, register_dynamic_prompt,
  //                   register_conversation_prompt, list_registered_prompts)
  // Notifications: 6 tools (send_resource_list_changed, send_prompt_list_changed, send_tool_list_changed,
  //                         send_all_list_changed, test_notification_after_registration, test_notification_timing)
  // Content: 6 tools (test_text_content, test_image_content, test_audio_content, 
  //                   test_mixed_content, test_large_content, test_content_metadata)
  // Transports: 1 tool (test_transport_capabilities) - if we add it
  return 37; // Updated based on our comprehensive modular implementation
}

export function parseArguments(): TransportOptions {
  const args = process.argv.slice(2);
  const options: TransportOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--port" && i + 1 < args.length) {
      options.port = parseInt(args[i + 1], 10);
      i++; // Skip next argument as it's the port value
    } else if (arg === "--transport" && i + 1 < args.length) {
      options.transport = args[i + 1];
      i++; // Skip next argument as it's the transport value
    } else if (arg.startsWith("--port=")) {
      options.port = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--transport=")) {
      options.transport = arg.split("=")[1];
    }
  }

  return options;
}
