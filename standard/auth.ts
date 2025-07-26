import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InitializeRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  InitializeResult,
  ServerCapabilities,
  Implementation
} from "../spec/current_spec.js";
import { LATEST_PROTOCOL_VERSION } from "../spec/current_spec.js";
import { APP_CONFIG } from "./constants.js";
import { logger } from "./logger.js";

/**
 * Standard MCP Authentication & Initialization Endpoints
 * 
 * Implements the core MCP authentication protocol endpoints:
 * - initialize: Handle client initialization and capability negotiation
 */

export function registerAuthEndpoints(server: McpServer) {
  logger.logMethodEntry("registerAuthEndpoints", { serverName: APP_CONFIG.name }, "auth");
  registerInitialize(server);
}

/**
 * initialize endpoint
 * Handles client initialization requests and capability negotiation
 */
function registerInitialize(server: McpServer) {
  logger.logMethodEntry("registerInitialize", undefined, "auth");
  
  server.server.setRequestHandler(
    InitializeRequestSchema,
    async (request, extra): Promise<InitializeResult> => {
      await logger.logEndpointEntry("initialize", extra.requestId, {
        protocolVersion: request.params.protocolVersion,
        clientInfo: request.params.clientInfo
      });
      
      const { protocolVersion, capabilities, clientInfo } = request.params;
      
      // Validate protocol version compatibility
      const supportedVersions = [
        APP_CONFIG.protocol,
        "2025-03-26", 
        "2024-11-05",
        "2024-10-07"
      ];
      
      let negotiatedVersion = LATEST_PROTOCOL_VERSION;
      if (supportedVersions.includes(protocolVersion)) {
        negotiatedVersion = protocolVersion;
      } else {
        // Use the latest version we support
        negotiatedVersion = LATEST_PROTOCOL_VERSION;
      }
      
      // Define server capabilities based on what we implement
      const serverCapabilities: ServerCapabilities = {
        experimental: {
          "mcp-sdk-tester": {
            version: APP_CONFIG.version,
            features: ["comprehensive-testing", "all-endpoints", "standard-protocol"]
          }
        },
        logging: {},
        completions: {},
        prompts: {
          listChanged: true,
        },
        resources: {
          subscribe: true,
          listChanged: true,
        },
        tools: {
          listChanged: true,
        },
      };
      
      // Server information
      const serverInfo: Implementation = {
        name: APP_CONFIG.name,
        title: APP_CONFIG.displayName,
        version: APP_CONFIG.version,
      };
      
      // Initialization instructions for the client/LLM
      const instructions = `
${APP_CONFIG.displayName} - Standard Protocol Implementation

This server implements all standard MCP specification endpoints:

Core Protocol:
- ping: Health check and connectivity test
- initialize: Client initialization and capability negotiation

Resources Management:
- resources/list: List all available resources with pagination
- resources/templates/list: List resource URI templates
- resources/read: Read content of specific resources
- resources/subscribe: Subscribe to resource update notifications
- resources/unsubscribe: Unsubscribe from resource updates

Prompts Management:
- prompts/list: List available prompts and templates
- prompts/get: Get specific prompt with argument templating

Tools Management:
- tools/list: List available tools with input/output schemas
- tools/call: Execute tools with proper error handling

Advanced Protocol Features:
- sampling/createMessage: Request LLM sampling from client
- elicitation/create: Request structured user input
- roots/list: Request available root directories

All endpoints follow MCP specification standards with:
- Proper error handling and validation
- Structured response formats
- Pagination support where applicable
- Type-safe parameter and result handling
- Comprehensive metadata in responses
      `.trim();
      
      const result: InitializeResult = {
        protocolVersion: negotiatedVersion,
        capabilities: serverCapabilities,
        serverInfo: serverInfo,
        instructions: instructions,
        _meta: {
          initializationTime: new Date().toISOString(),
          clientInfo: clientInfo,
          clientCapabilities: capabilities,
          negotiatedFromVersion: protocolVersion,
          supportedVersions,
        },
      };
      
      await logger.logMethodExit("initialize", { protocolVersion: negotiatedVersion }, "auth");
      return result;
    }
  );
}