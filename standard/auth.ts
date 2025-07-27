import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InitializeRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Implementation, InitializeResult, ServerCapabilities } from "../spec/current_spec.js";
import { LATEST_PROTOCOL_VERSION } from "../spec/current_spec.js";
import { APP_CONFIG } from "./constants.js";
import { logger } from "./logger.js";
import { AUTH_CONFIG } from "./auth-config.js";
import { lifecycleManager, LifecycleState } from "./lifecycle.js";

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
        clientInfo: request.params.clientInfo,
      });

      const { protocolVersion, capabilities, clientInfo } = request.params;

      // Validate protocol version compatibility
      const supportedVersions = AUTH_CONFIG.supportedVersions;

      let negotiatedVersion = LATEST_PROTOCOL_VERSION;
      if (supportedVersions.includes(protocolVersion as any)) {
        negotiatedVersion = protocolVersion;
        logger.info(`Protocol version accepted: ${protocolVersion}`, "auth");
      } else {
        // Use the latest version we support
        negotiatedVersion = LATEST_PROTOCOL_VERSION;
        logger.warning(
          `Unsupported protocol version ${protocolVersion}, using ${negotiatedVersion}`,
          "auth"
        );
      }

      // Log client information for security monitoring
      logger.info(
        {
          message: "Client initialization",
          clientName: clientInfo?.name,
          clientVersion: clientInfo?.version,
          protocolVersion: negotiatedVersion,
          hasCapabilities: !!capabilities,
        },
        "auth"
      );

      // Get server capabilities from configuration
      const serverCapabilities: ServerCapabilities = AUTH_CONFIG.capabilities;

      // Server information from configuration
      const serverInfo: Implementation = AUTH_CONFIG.serverInfo;

      // Initialization instructions from configuration
      const instructions = AUTH_CONFIG.instructions;

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
          lifecycleState: lifecycleManager.getState(),
        },
      };

      // Mark initialization phase as complete
      lifecycleManager.markInitialized();

      await logger.logMethodExit(
        "initialize",
        {
          protocolVersion: negotiatedVersion,
          lifecycleState: lifecycleManager.getState(),
        },
        "auth"
      );

      return result;
    }
  );
}
