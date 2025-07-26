import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { APP_CONFIG, TRANSPORT_CONFIG } from "./constants.js";
import { ErrorType, getErrorCode, logger } from "./logger.js";
import { lifecycleManager, getServerStatus } from "./lifecycle.js";
import { createAuthMiddleware, logAuthEvent } from "./authorization.js";
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
    
    // Setup transport-specific shutdown handling
    lifecycleManager.onShutdown(async () => {
      logger.info("Closing stdio transport...", "transport");
      transport.close();
    });
    
    server.connect(transport);
    logger.info("MCP Server running on stdio transport", "transport");
  } catch (error) {
    logger.logServerError(
      error instanceof Error ? error : new Error(String(error)),
      "setupStdioTransport"
    );
    throw error;
  }
}

// Streamable HTTP transport
function setupStreamableTransport(server: McpServer, port: number) {
  const app = express();
  
  // Security: Restrict CORS to localhost for safety
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    // Allow MCP Inspector and development tools
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ];
  
  app.use(cors({ 
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      logger.warning(`Blocked request from unauthorized origin: ${origin}`, "transport");
      callback(new Error('Not allowed by CORS'));
    },
    exposedHeaders: ["Mcp-Session-Id"],
    credentials: true,
  }));
  
  app.use(express.json({ limit: '10mb' })); // Limit request size
  
  // Apply authorization and security middleware
  const envType = (process.env.NODE_ENV as 'development' | 'production' | 'testing') || 'development';
  const authMiddleware = createAuthMiddleware({
    environment: envType,
    apiKeys: process.env.MCP_API_KEYS?.split(',').filter(Boolean),
    customRateLimit: {
      maxRequests: parseInt(process.env.MCP_RATE_LIMIT || '100'),
      windowMs: parseInt(process.env.MCP_RATE_WINDOW || '60000'),
    },
  });
  
  authMiddleware.forEach(middleware => app.use(middleware));

  // Store transports by session ID
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  // Modern Streamable HTTP endpoint
  app.all("/mcp", async (req: Request, res: Response) => {
    logger.debug(`Received ${req.method} request to /mcp (Streamable HTTP)`, "transport");
    
    // Log authentication event for audit
    logAuthEvent(req, 'mcp_request', {
      method: req.method,
      sessionId: req.headers["mcp-session-id"],
    });
    
    // Auth middleware guarantees req.auth exists after middleware chain
    // TypeScript will recognize this after auth middleware has run
    if (req.auth) {
      logger.debug(`MCP request from ${req.auth.authMethod} client (authenticated: ${req.auth.isAuthenticated})`, "transport");
    }

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
        const errorCode = getErrorCode(ErrorType.INVALID_REQUEST);
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
      // Type cast to resolve AuthInfo vs AuthContext incompatibility
      await transport.handleRequest(req as any, res, req.body);
    } catch (error) {
      logger.logServerError(
        error instanceof Error ? error : new Error(String(error)),
        "HTTP request handling",
        {
          method: req.method,
          url: req.url,
          sessionId: req.headers["mcp-session-id"],
        }
      );
      if (!res.headersSent) {
        const errorCode = getErrorCode(ErrorType.INTERNAL_ERROR);
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

  // Health check endpoint with lifecycle status
  app.get("/health", (_req: Request, res: Response) => {
    const serverStatus = getServerStatus();
    res.json({
      status: serverStatus.isOperational ? "ok" : "initializing",
      transport: "streamable-http",
      timestamp: new Date().toISOString(),
      protocol: APP_CONFIG.protocol,
      lifecycle: serverStatus,
    });
  });

  // Server info endpoint with lifecycle information
  app.get("/info", (_req: Request, res: Response) => {
    const serverStatus = getServerStatus();
    res.json({
      name: APP_CONFIG.displayName,
      version: APP_CONFIG.version,
      transport: "streamable-http",
      protocol: APP_CONFIG.protocol,
      port: port,
      endpoints: TRANSPORT_CONFIG.endpoints,
      lifecycle: serverStatus,
      security: {
        corsEnabled: true,
        allowedOrigins: 'localhost only',
        requestSizeLimit: '10mb',
      },
    });
  });

  // Root endpoint with server information
  app.get("/", (_req: Request, res: Response) => {
    const serverStatus = getServerStatus();
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
        <p><strong>Server Status:</strong> ${serverStatus.state} | <strong>Uptime:</strong> ${serverStatus.uptime.toFixed(1)}s</p>
        
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
          <li><strong>Status:</strong> <span class="tools-count">${serverStatus.isOperational ? 'Operational' : 'Initializing'}</span></li>
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

  const httpServer = app.listen(port, '127.0.0.1', () => {
    logger.info(
      `MCP Server running on http://localhost:${port} (Streamable HTTP transport)`,
      "transport"
    );
    logger.info(`Protocol: ${APP_CONFIG.protocol}`, "transport");
    logger.info(`Streamable HTTP endpoint: http://localhost:${port}/mcp`, "transport");
    logger.info(`Health check: http://localhost:${port}/health`, "transport");
    logger.info("Server bound to localhost for security", "transport");
  });

  // Integrate with lifecycle management for graceful shutdown
  lifecycleManager.onShutdown(async () => {
    logger.info("Shutting down Streamable HTTP server...", "transport");
    
    // Close all active transports
    Object.values(transports).forEach(transport => {
      try {
        transport.close();
      } catch (error) {
        logger.warning(`Error closing transport: ${error}`, "transport");
      }
    });
    
    // Close HTTP server
    return new Promise<void>((resolve) => {
      httpServer.close((error) => {
        if (error) {
          logger.error(`Error closing HTTP server: ${error}`, "transport");
        } else {
          logger.info("HTTP server closed successfully", "transport");
        }
        resolve();
      });
    });
  });
}

// Removed getToolCount function as it's no longer used

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
