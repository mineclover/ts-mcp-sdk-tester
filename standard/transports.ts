import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { APP_CONFIG, TRANSPORT_CONFIG } from "./constants.js";
import { logger, ErrorType, ErrorCodeMapper } from "./logger.js";
/**
 * Transport Management Features
 * Handles different MCP transport types and server setup
 */

export interface TransportOptions {
  port?: number;
  transport?: string;
}

export function setupTransport(server: McpServer, options: TransportOptions = {}) {
  logger.logMethodEntry("setupTransport", options, "transport");
  
  const { port, transport } = options;

  // Determine transport type based on arguments
  const transportType = transport || (port ? "streamable" : "stdio");
  
  logger.info(`Setting up ${transportType} transport`, "transport");

  switch (transportType) {
    case "stdio":
      setupStdioTransport(server);
      break;
    default:
      setupStreamableTransport(server, port || TRANSPORT_CONFIG.defaultPort);
      break;
  }
}

function setupStdioTransport(server: McpServer) {
  logger.logMethodEntry("setupStdioTransport", undefined, "transport");
  
  try {
    const transport = new StdioServerTransport();
    server.connect(transport);
    logger.info("MCP Server running on stdio transport", "transport");
  } catch (error) {
    logger.logServerError(error instanceof Error ? error : new Error(String(error)), 
      "setupStdioTransport");
    throw error;
  }
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
    logger.debug(`Received ${req.method} request to /mcp (Streamable HTTP)`, "transport");

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
            logger.info(`Streamable HTTP session initialized: ${sessionId}`, "transport");
            transports[sessionId] = transport;
          },
        });

        // Set up onclose handler
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            logger.info(`Transport closed for session ${sid}`, "transport");
            delete transports[sid];
          }
        };

        // Connect to MCP server
        await server.connect(transport);
      } else {
        // Invalid request
        const errorCode = ErrorCodeMapper.getErrorCode(ErrorType.INVALID_REQUEST);
        res.status(400).json({
          jsonrpc: APP_CONFIG.jsonrpc,
          error: {
            code: errorCode,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      // Handle the request with the transport
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.logServerError(error instanceof Error ? error : new Error(String(error)), 
        "HTTP request handling", { 
          method: req.method, 
          url: req.url,
          sessionId: req.headers["mcp-session-id"]
        });
      if (!res.headersSent) {
        const errorCode = ErrorCodeMapper.getErrorCode(ErrorType.INTERNAL_ERROR);
        res.status(500).json({
          jsonrpc: APP_CONFIG.jsonrpc,
          error: {
            code: errorCode,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      transport: "streamable-http",
      timestamp: new Date().toISOString(),
      protocol: APP_CONFIG.protocol,
    });
  });

  // Server info endpoint
  app.get("/info", (_req: Request, res: Response) => {
    res.json({
      name: APP_CONFIG.displayName,
      version: APP_CONFIG.version,
      transport: "streamable-http",
      protocol: APP_CONFIG.protocol,
      port: port,
      endpoints: TRANSPORT_CONFIG.endpoints,
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
        <title>${APP_CONFIG.displayName}</title>
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
        <h1>${APP_CONFIG.displayName}</h1>
        <p>Modern MCP server running on port ${port} with <span class="modern">Streamable HTTP Transport</span> (Protocol: ${APP_CONFIG.protocol})</p>
        
        <div class="endpoint">
          <h3>MCP Endpoint</h3>
          <strong>Streamable HTTP Transport</strong><br>
          Endpoint: <code>http://localhost:${port}/mcp</code><br>
          Protocol: ${APP_CONFIG.protocol}<br>
          Usage: Modern MCP clients and tools
        </div>
        
        <h2>Server Information</h2>
        <ul>
          <li><strong>Health Check:</strong> <a href="/health" target="_blank">/health</a></li>
          <li><strong>Server Info:</strong> <a href="/info" target="_blank">/info</a></li>
          <li><strong>Tools Available:</strong> <span class="tools-count">${getToolCount()} tools</span></li>
        </ul>
        
        <h2>Available Features</h2>
        <div class="feature">
          <strong>Standard MCP Protocol</strong><br>
          Full MCP specification compliance with tools, resources, prompts, and advanced features
        </div>
        <div class="feature">
          <strong>Multi-Transport Support</strong><br>
          Stdio and Streamable HTTP transports for flexible integration
        </div>
        <div class="feature">
          <strong>Environment Setup</strong><br>
          Clean MCP server implementation for testing and development
        </div>
        
        <h2>Usage Examples</h2>
        <div class="endpoint">
          <h4>Using MCP Inspector</h4>
          <code>npx @modelcontextprotocol/inspector http://localhost:${port}/mcp</code>
        </div>
        
        <div class="endpoint">
          <h4>Direct HTTP Requests</h4>
          <code>curl -X POST http://localhost:${port}/mcp -H "Content-Type: application/json" -d '{"jsonrpc": "${APP_CONFIG.jsonrpc}", "id": 1, "method": "tools/list"}'</code>
        </div>
        
        <p><em>This server provides a clean MCP implementation with standard protocol compliance for testing and development.</em></p>
      </body>
      </html>
    `);
  });

  const httpServer = app.listen(port, () => {
    logger.info(`MCP Server running on http://localhost:${port} (Streamable HTTP transport)`, "transport");
    logger.info(`Protocol: ${APP_CONFIG.protocol}`, "transport");
    logger.info(`Streamable HTTP endpoint: http://localhost:${port}/mcp`, "transport");
    logger.info(`Health check: http://localhost:${port}/health`, "transport");
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    logger.info("Shutting down Streamable HTTP server...", "transport");
    httpServer.close(() => {
      process.exit(0);
    });
  });
}

// Helper function to get tool count for HTML display
function getToolCount(): number {
  // No tools are registered anymore - only standard MCP endpoints
  return 0;
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
