import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InitializeRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  InitializeResult,
  ServerCapabilities,
  Implementation
} from "../../spec/current_spec.js";
import { LATEST_PROTOCOL_VERSION } from "../../spec/current_spec.js";

/**
 * Registers the initialize endpoint handler
 * Handles client initialization requests
 */
export function registerInitialize(server: McpServer) {
  server.server.setRequestHandler(
    InitializeRequestSchema,
    async (request): Promise<InitializeResult> => {
      const { protocolVersion, clientInfo } = request.params;
      
      // Validate protocol version compatibility
      const supportedVersions = [
        "2025-06-18",
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
      
      // Define server capabilities
      const serverCapabilities: ServerCapabilities = {
        experimental: {
          "mcp-sdk-tester": {
            version: "1.0.0",
            features: ["comprehensive-testing", "all-endpoints"]
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
        name: "mcp-sdk-tester",
        title: "MCP SDK Comprehensive Tester",
        version: "1.0.0",
      };
      
      // Initialization instructions
      const instructions = `
MCP SDK Comprehensive Tester

This server implements all MCP specification endpoints for testing purposes:

Resources:
- resources/list - List all available resources
- resources/read - Read resource content  
- resources/subscribe - Subscribe to resource updates
- resources/unsubscribe - Unsubscribe from resource updates

Prompts:
- prompts/list - List all available prompts
- prompts/get - Get a specific prompt with arguments

Tools:
- tools/list - List all available tools
- tools/call - Call a specific tool with arguments

Core:
- ping - Health check endpoint
- initialize - Initialization endpoint

Advanced:
- sampling/createMessage - Request LLM sampling from client
- elicitation/create - Request user input from client
- roots/list - Request root directories from client

All endpoints support proper error handling, parameter validation, and return structured responses according to the MCP specification.
      `.trim();
      
      const result: InitializeResult = {
        protocolVersion: negotiatedVersion,
        capabilities: serverCapabilities,
        serverInfo: serverInfo,
        instructions: instructions,
        _meta: {
          initializationTime: new Date().toISOString(),
          clientInfo: clientInfo,
          negotiatedFromVersion: protocolVersion,
        },
      };
      
      return result;
    }
  );
}