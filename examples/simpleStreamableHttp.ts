import { randomUUID } from "node:crypto";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { getOAuthProtectedResourceMetadataUrl, mcpAuthMetadataRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { OAuthMetadata } from "@modelcontextprotocol/sdk/shared/auth.js";
import { checkResourceAllowed } from "@modelcontextprotocol/sdk/shared/auth-utils.js";
import {
  type CallToolResult,
  type GetPromptResult,
  isInitializeRequest,
  type PrimitiveSchemaDefinition,
  type ReadResourceResult,
  type ResourceLink,
} from "@modelcontextprotocol/sdk/types.js";
import cors from "cors";
import type { Request, Response } from "express";
import express from "express";
import { z } from "zod";
import { setupAuthServer } from "./shared/demoInMemoryOAuthProvider.js";
import { InMemoryEventStore } from "./shared/inMemoryEventStore.js";

// Check for OAuth flag
const useOAuth = process.argv.includes("--oauth");
const strictOAuth = process.argv.includes("--oauth-strict");


export const registerDemoEndpoints = (server: McpServer) => {
  
  // Register a simple tool that returns a greeting
  server.registerTool(
    "greet",
    {
      title: "Greeting Tool", // Display name for UI
      description: "A simple greeting tool",
      inputSchema: {
        name: z.string().describe("Name to greet"),
      },
    },
    async ({ name }): Promise<CallToolResult> => {
      return {
        content: [
          {
            type: "text",
            text: `Hello, ${name}!`,
          },
        ],
      };
    }
  );

  // Register a tool that sends multiple greetings with notifications (with annotations)
  server.tool(
    "multi-greet",
    "A tool that sends different greetings with delays between them",
    {
      name: z.string().describe("Name to greet"),
    },
    {
      title: "Multiple Greeting Tool",
      readOnlyHint: true,
      openWorldHint: false,
    },
    async ({ name }, { sendNotification }): Promise<CallToolResult> => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      await sendNotification({
        method: "notifications/message",
        params: { level: "debug", data: `Starting multi-greet for ${name}` },
      });

      await sleep(1000); // Wait 1 second before first greeting

      await sendNotification({
        method: "notifications/message",
        params: { level: "info", data: `Sending first greeting to ${name}` },
      });

      await sleep(1000); // Wait another second before second greeting

      await sendNotification({
        method: "notifications/message",
        params: { level: "info", data: `Sending second greeting to ${name}` },
      });

      return {
        content: [
          {
            type: "text",
            text: `Good morning, ${name}!`,
          },
        ],
      };
    }
  );
  // Register a tool that demonstrates elicitation (user input collection)
  // This creates a closure that captures the server instance
  server.tool(
    "collect-user-info",
    "A tool that collects user information through elicitation",
    {
      infoType: z.enum(["contact", "preferences", "feedback"]).describe("Type of information to collect"),
    },
    async ({ infoType }): Promise<CallToolResult> => {
      let message: string;
      let requestedSchema: {
        type: "object";
        properties: Record<string, PrimitiveSchemaDefinition>;
        required?: string[];
      };

      switch (infoType) {
        case "contact":
          message = "Please provide your contact information";
          requestedSchema = {
            type: "object",
            properties: {
              name: {
                type: "string",
                title: "Full Name",
                description: "Your full name",
              },
              email: {
                type: "string",
                title: "Email Address",
                description: "Your email address",
                format: "email",
              },
              phone: {
                type: "string",
                title: "Phone Number",
                description: "Your phone number (optional)",
              },
            },
            required: ["name", "email"],
          };
          break;
        case "preferences":
          message = "Please set your preferences";
          requestedSchema = {
            type: "object",
            properties: {
              theme: {
                type: "string",
                title: "Theme",
                description: "Choose your preferred theme",
                enum: ["light", "dark", "auto"],
                enumNames: ["Light", "Dark", "Auto"],
              },
              notifications: {
                type: "boolean",
                title: "Enable Notifications",
                description: "Would you like to receive notifications?",
                default: true,
              },
              frequency: {
                type: "string",
                title: "Notification Frequency",
                description: "How often would you like notifications?",
                enum: ["daily", "weekly", "monthly"],
                enumNames: ["Daily", "Weekly", "Monthly"],
              },
            },
            required: ["theme"],
          };
          break;
        case "feedback":
          message = "Please provide your feedback";
          requestedSchema = {
            type: "object",
            properties: {
              rating: {
                type: "integer",
                title: "Rating",
                description: "Rate your experience (1-5)",
                minimum: 1,
                maximum: 5,
              },
              comments: {
                type: "string",
                title: "Comments",
                description: "Additional comments (optional)",
                maxLength: 500,
              },
              recommend: {
                type: "boolean",
                title: "Would you recommend this?",
                description: "Would you recommend this to others?",
              },
            },
            required: ["rating", "recommend"],
          };
          break;
        default:
          throw new Error(`Unknown info type: ${infoType}`);
      }

      try {
        // Use the underlying server instance to elicit input from the client
        const result = await server.server.elicitInput({
          message,
          requestedSchema,
        });

        if (result.action === "accept") {
          return {
            content: [
              {
                type: "text",
                text: `Thank you! Collected ${infoType} information: ${JSON.stringify(result.content, null, 2)}`,
              },
            ],
          };
        } else if (result.action === "decline") {
          return {
            content: [
              {
                type: "text",
                text: `No information was collected. User declined ${infoType} information request.`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Information collection was cancelled by the user.`,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error collecting ${infoType} information: ${error}`,
            },
          ],
        };
      }
    }
  );


}

// Create an MCP server with implementation details
const getServer = () => {
  const server = new McpServer(
    {
      name: "simple-streamable-http-server",
      version: "1.0.0",
    },
    { capabilities: { logging: {} } }
  );


  // Register a simple prompt with title
  server.registerPrompt(
    "greeting-template",
    {
      title: "Greeting Template", // Display name for UI
      description: "A simple greeting prompt template",
      argsSchema: {
        name: z.string().describe("Name to include in greeting"),
      },
    },
    async ({ name }): Promise<GetPromptResult> => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please greet ${name} in a friendly manner.`,
            },
          },
        ],
      };
    }
  );

  // Register a tool specifically for testing resumability
  server.tool(
    "start-notification-stream",
    "Starts sending periodic notifications for testing resumability",
    {
      interval: z.number().describe("Interval in milliseconds between notifications").default(100),
      count: z.number().describe("Number of notifications to send (0 for 100)").default(50),
    },
    async ({ interval, count }, { sendNotification }): Promise<CallToolResult> => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      let counter = 0;

      while (count === 0 || counter < count) {
        counter++;
        try {
          await sendNotification({
            method: "notifications/message",
            params: {
              level: "info",
              data: `Periodic notification #${counter} at ${new Date().toISOString()}`,
            },
          });
        } catch (error) {
          console.error("Error sending notification:", error);
        }
        // Wait for the specified interval
        await sleep(interval);
      }

      return {
        content: [
          {
            type: "text",
            text: `Started sending periodic notifications every ${interval}ms`,
          },
        ],
      };
    }
  );

  // Create a simple resource at a fixed URI
  server.registerResource(
    "greeting-resource",
    "https://example.com/greetings/default",
    {
      title: "Default Greeting", // Display name for UI
      description: "A simple greeting resource",
      mimeType: "text/plain",
    },
    async (): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: "https://example.com/greetings/default",
            text: "Hello, world!",
          },
        ],
      };
    }
  );

  // Create additional resources for ResourceLink demonstration
  server.registerResource(
    "example-file-1",
    "file:///example/file1.txt",
    {
      title: "Example File 1",
      description: "First example file for ResourceLink demonstration",
      mimeType: "text/plain",
    },
    async (): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: "file:///example/file1.txt",
            text: "This is the content of file 1",
          },
        ],
      };
    }
  );

  server.registerResource(
    "example-file-2",
    "file:///example/file2.txt",
    {
      title: "Example File 2",
      description: "Second example file for ResourceLink demonstration",
      mimeType: "text/plain",
    },
    async (): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: "file:///example/file2.txt",
            text: "This is the content of file 2",
          },
        ],
      };
    }
  );

  // Register a tool that returns ResourceLinks
  server.registerTool(
    "list-files",
    {
      title: "List Files with ResourceLinks",
      description: "Returns a list of files as ResourceLinks without embedding their content",
      inputSchema: {
        includeDescriptions: z.boolean().optional().describe("Whether to include descriptions in the resource links"),
      },
    },
    async ({ includeDescriptions = true }): Promise<CallToolResult> => {
      const resourceLinks: ResourceLink[] = [
        {
          type: "resource_link",
          uri: "https://example.com/greetings/default",
          name: "Default Greeting",
          mimeType: "text/plain",
          ...(includeDescriptions && { description: "A simple greeting resource" }),
        },
        {
          type: "resource_link",
          uri: "file:///example/file1.txt",
          name: "Example File 1",
          mimeType: "text/plain",
          ...(includeDescriptions && {
            description: "First example file for ResourceLink demonstration",
          }),
        },
        {
          type: "resource_link",
          uri: "file:///example/file2.txt",
          name: "Example File 2",
          mimeType: "text/plain",
          ...(includeDescriptions && {
            description: "Second example file for ResourceLink demonstration",
          }),
        },
      ];

      return {
        content: [
          {
            type: "text",
            text: "Here are the available files as resource links:",
          },
          ...resourceLinks,
          {
            type: "text",
            text: "\nYou can read any of these resources using their URI.",
          },
        ],
      };
    }
  );

  return server;
};

const MCP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3000;
const AUTH_PORT = process.env.MCP_AUTH_PORT ? parseInt(process.env.MCP_AUTH_PORT, 10) : 3001;

const app = express();
app.use(express.json());

// Allow CORS all domains, expose the Mcp-Session-Id header
app.use(
  cors({
    origin: "*", // Allow all origins
    exposedHeaders: ["Mcp-Session-Id"],
  })
);

// Set up OAuth if enabled
let authMiddleware = null;
if (useOAuth) {
  // Create auth middleware for MCP endpoints
  const mcpServerUrl = new URL(`http://localhost:${MCP_PORT}/mcp`);
  const authServerUrl = new URL(`http://localhost:${AUTH_PORT}`);

  const oauthMetadata: OAuthMetadata = setupAuthServer({
    authServerUrl,
    mcpServerUrl,
    strictResource: strictOAuth,
  });

  const tokenVerifier = {
    verifyAccessToken: async (token: string) => {
      const endpoint = oauthMetadata.introspection_endpoint;

      if (!endpoint) {
        throw new Error("No token verification endpoint available in metadata");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          token: token,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Invalid or expired token: ${await response.text()}`);
      }

      const data = await response.json();

      if (strictOAuth) {
        if (!data.aud) {
          throw new Error(`Resource Indicator (RFC8707) missing`);
        }
        if (!checkResourceAllowed({ requestedResource: data.aud, configuredResource: mcpServerUrl })) {
          throw new Error(`Expected resource indicator ${mcpServerUrl}, got: ${data.aud}`);
        }
      }

      // Convert the response to AuthInfo format
      return {
        token,
        clientId: data.client_id,
        scopes: data.scope ? data.scope.split(" ") : [],
        expiresAt: data.exp,
      };
    },
  };
  // Add metadata routes to the main MCP server
  app.use(
    mcpAuthMetadataRouter({
      oauthMetadata,
      resourceServerUrl: mcpServerUrl,
      scopesSupported: ["mcp:tools"],
      resourceName: "MCP Demo Server",
    })
  );

  authMiddleware = requireBearerAuth({
    verifier: tokenVerifier,
    requiredScopes: [],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  });
}

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// MCP POST endpoint with optional auth
const mcpPostHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId) {
    console.log(`Received MCP request for session: ${sessionId}`);
  } else {
    console.log("Request body:", req.body);
  }

  if (useOAuth && req.auth) {
    console.log("Authenticated user:", req.auth);
  }
  try {
    let transport: StreamableHTTPServerTransport;
    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore, // Enable resumability
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID when session is initialized
          // This avoids race conditions where requests might come in before the session is stored
          console.log(`Session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        },
      });

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}, removing from transports map`);
          delete transports[sid];
        }
      };

      // Connect the transport to the MCP server BEFORE handling the request
      // so responses can flow back through the same transport
      const server = getServer();
      await server.connect(transport);

      await transport.handleRequest(req, res, req.body);
      return; // Already handled
    } else {
      // Invalid request - no session ID or not initialization request
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

    // Handle the request with existing transport - no need to reconnect
    // The existing transport is already connected to the server
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
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
};

// Set up routes with conditional auth middleware
if (useOAuth && authMiddleware) {
  app.post("/mcp", authMiddleware, mcpPostHandler);
} else {
  app.post("/mcp", mcpPostHandler);
}

// Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
const mcpGetHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  if (useOAuth && req.auth) {
    console.log("Authenticated SSE connection from user:", req.auth);
  }

  // Check for Last-Event-ID header for resumability
  const lastEventId = req.headers["last-event-id"] as string | undefined;
  if (lastEventId) {
    console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
  } else {
    console.log(`Establishing new SSE stream for session ${sessionId}`);
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

// Set up GET route with conditional auth middleware
if (useOAuth && authMiddleware) {
  app.get("/mcp", authMiddleware, mcpGetHandler);
} else {
  app.get("/mcp", mcpGetHandler);
}

// Handle DELETE requests for session termination (according to MCP spec)
const mcpDeleteHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  console.log(`Received session termination request for session ${sessionId}`);

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("Error handling session termination:", error);
    if (!res.headersSent) {
      res.status(500).send("Error processing session termination");
    }
  }
};

// Set up DELETE route with conditional auth middleware
if (useOAuth && authMiddleware) {
  app.delete("/mcp", authMiddleware, mcpDeleteHandler);
} else {
  app.delete("/mcp", mcpDeleteHandler);
}

app.listen(MCP_PORT, (error) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
  console.log(`MCP Streamable HTTP Server listening on port ${MCP_PORT}`);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  // Close all active transports to properly clean up resources
  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  console.log("Server shutdown complete");
  process.exit(0);
});
