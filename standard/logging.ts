import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { EmptyResult } from "../spec/current_spec.js";
import { logger } from "./logger.js";

/**
 * Standard MCP Logging Endpoints
 *
 * Implements the core MCP logging protocol endpoints:
 * - logging/setLevel: Set the logging level for server messages
 * - logging/config: Configure logging settings (custom endpoint)
 */

// Custom schema for logging configuration
const LoggingConfigRequestSchema = z.object({
  method: z.literal("logging/config"),
  params: z
    .object({
      sensitiveDataFilter: z.boolean().optional(),
      rateLimiting: z.boolean().optional(),
    })
    .optional(),
});

export function registerLoggingEndpoints(server: McpServer) {
  // Initialize logger with MCP server for client notifications
  logger.initialize(server);

  registerSetLevel(server);
  registerLoggingConfig(server);

  logger.info("Logging endpoints registered successfully", "logging");
}

/**
 * logging/setLevel endpoint
 * Set the logging level that the client wants to receive from the server
 */
function registerSetLevel(server: McpServer) {
  logger.logMethodEntry("registerSetLevel", undefined, "logging");

  server.server.setRequestHandler(
    SetLevelRequestSchema,
    async (request, extra): Promise<EmptyResult> => {
      const { level } = request.params;

      await logger.logEndpointEntry("logging/setLevel", extra.requestId, { level });

      try {
        const previousLevel = logger.getLevel();

        // Actually configure the logging level
        logger.setLevel(level);

        const result: EmptyResult = {
          _meta: {
            loggingLevel: level,
            levelSetAt: new Date().toISOString(),
            message: `Logging level set to: ${level}`,
            previousLevel,
            requestId: extra.requestId,
            severityLevels: [
              "debug",
              "info",
              "notice",
              "warning",
              "error",
              "critical",
              "alert",
              "emergency",
            ],
          },
        };

        await logger.logMethodExit(
          "logging/setLevel",
          {
            requestId: extra.requestId,
            level,
            previousLevel,
          },
          "logging"
        );

        return result;
      } catch (error) {
        await logger.logServerError(
          error instanceof Error ? error : new Error(String(error)),
          "logging/setLevel",
          { requestId: extra.requestId, level }
        );
        throw error;
      }
    }
  );
}

/**
 * logging/config endpoint (custom)
 * Configure additional logging settings
 */
function registerLoggingConfig(server: McpServer) {
  logger.logMethodEntry("registerLoggingConfig", undefined, "logging");

  // Custom logging configuration endpoint
  server.server.setRequestHandler(
    LoggingConfigRequestSchema,
    async (request, extra): Promise<EmptyResult> => {
      const { sensitiveDataFilter, rateLimiting } = request.params || {};

      await logger.logEndpointEntry("logging/config", extra.requestId, {
        sensitiveDataFilter,
        rateLimiting,
      });

      try {
        const config: any = {};

        if (typeof sensitiveDataFilter === "boolean") {
          logger.setSensitiveDataFilter(sensitiveDataFilter);
          config.sensitiveDataFilter = sensitiveDataFilter;
        }

        if (typeof rateLimiting === "boolean") {
          logger.setRateLimiting(rateLimiting);
          config.rateLimiting = rateLimiting;
        }

        const result: EmptyResult = {
          _meta: {
            message: "Logging configuration updated",
            configUpdated: config,
            timestamp: new Date().toISOString(),
            requestId: extra.requestId,
          },
        };

        await logger.logMethodExit(
          "logging/config",
          {
            requestId: extra.requestId,
            configUpdated: config,
          },
          "logging"
        );

        return result;
      } catch (error) {
        await logger.logServerError(
          error instanceof Error ? error : new Error(String(error)),
          "logging/config",
          { requestId: extra.requestId, params: request.params }
        );
        throw error;
      }
    }
  );
}
