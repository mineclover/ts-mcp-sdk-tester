import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type {
  EmptyResult,
  LoggingLevel,
} from "../../spec/current_spec.js";

// Global logging state
let currentLoggingState = {
  level: "info" as LoggingLevel,
  enabled: false,
  lastUpdated: new Date().toISOString(),
};

/**
 * Registers the logging/setLevel method handler
 * Enables or adjusts logging level for the server
 */
export function registerSetLevel(server: McpServer): void {
  server.server.setRequestHandler(
    SetLevelRequestSchema,
    async (request): Promise<EmptyResult> => {
      try {
        const { level } = request.params;

        // Update logging state
        currentLoggingState = {
          level,
          enabled: true,
          lastUpdated: new Date().toISOString(),
        };

        // Log the level change
        console.log(`Logging level set to: ${level}`);
        
        // Send initial log message notification
        server.server.notification({
          method: "notifications/message",
          params: {
            level: "info",
            logger: "mcp-server",
            data: `Logging level changed to ${level}`,
          },
        });

        return {
          _meta: {
            timestamp: currentLoggingState.lastUpdated,
            previousLevel: level,
          },
        };
      } catch (error) {
        console.error("Error setting logging level:", error);
        throw new Error(
          `Failed to set logging level: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  );
}

/**
 * Get current logging state
 */
export function getCurrentLoggingState() {
  return { ...currentLoggingState };
}

/**
 * Send a log message notification if logging is enabled
 */
export function sendLogMessage(
  server: McpServer,
  level: LoggingLevel,
  data: unknown,
  logger?: string
): void {
  if (!currentLoggingState.enabled) {
    return;
  }

  // Check if message level meets current threshold
  const levels: LoggingLevel[] = [
    "debug",
    "info",
    "notice",
    "warning",
    "error",
    "critical",
    "alert",
    "emergency",
  ];
  
  const currentLevelIndex = levels.indexOf(currentLoggingState.level);
  const messageLevelIndex = levels.indexOf(level);
  
  if (messageLevelIndex >= currentLevelIndex) {
    server.server.notification({
      method: "notifications/message",
      params: {
        level,
        logger,
        data,
      },
    });
  }
}