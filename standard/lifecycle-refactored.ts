/**
 * Refactored Lifecycle Management using centralized SessionManager
 * 
 * This version delegates session management responsibility to the
 * centralized SessionManager to follow single responsibility principle.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./logger.js";
import { globalSessionManager } from "./abstractions/session-manager.js";
import { 
  SessionLifecycleAdapter as SessionLifecycleManager,
  LifecycleAdapterFactory as SessionLifecycleManagerFactory,
  LifecycleState,
  type LifecycleCapabilities,
  type LifecycleInfo
} from "./abstractions/lifecycle-adapter.js";
import { APP_CONFIG } from "./constants.js";

// Re-export for compatibility
export { 
  LifecycleState, 
  type LifecycleCapabilities, 
  type LifecycleInfo,
  SessionLifecycleManager,
  SessionLifecycleManagerFactory
};

/**
 * Global lifecycle manager for server-wide state
 * Now uses the centralized SessionManager internally
 */
export class LifecycleManager {
  private globalSessionId: string;
  private adapter: SessionLifecycleManager;
  private signalHandlersRegistered = false;

  constructor() {
    // Create a global session for the server lifecycle
    this.globalSessionId = globalSessionManager.createSession("server", "global", ["lifecycle"]);
    this.adapter = new SessionLifecycleManager(this.globalSessionId);
  }

  /**
   * Initialize lifecycle manager with MCP server
   */
  initialize(server: McpServer, serverInfo: LifecycleInfo) {
    // Prevent double initialization
    if (this.getState() !== LifecycleState.UNINITIALIZED) {
      logger.warning(`Lifecycle already initialized in state: ${this.getState()}`, "lifecycle");
      return;
    }

    try {
      this.adapter.initialize(server, serverInfo);

      // Register lifecycle endpoints
      this.registerLifecycleEndpoints(server);

      // Setup shutdown handlers
      this.setupShutdownHandlers();

      logger.info(
        {
          message: "Lifecycle manager initialized using centralized SessionManager",
          state: this.getState(),
          serverInfo,
        },
        "lifecycle"
      );
    } catch (error) {
      logger.error(
        {
          message: "Failed to initialize lifecycle manager",
          error: error instanceof Error ? error.message : String(error),
        },
        "lifecycle"
      );
      throw error;
    }
  }

  /**
   * Delegate all other methods to the adapter
   */
  getState(): LifecycleState {
    return this.adapter.getState();
  }

  get currentState(): LifecycleState {
    return this.adapter.getState();
  }

  getUptime(): number {
    return this.adapter.getUptime();
  }

  isOperational(): boolean {
    return this.adapter.isOperational();
  }

  getProtocolVersion(): string {
    return this.adapter.getProtocolVersion();
  }

  getClientCapabilities(): LifecycleCapabilities {
    const session = globalSessionManager.getSession(this.globalSessionId);
    return session?.capabilities ? { tools: { listChanged: true } } : {};
  }

  getServerCapabilities(): LifecycleCapabilities {
    return {
      prompts: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      tools: { listChanged: true },
      logging: {},
      completions: {},
    };
  }

  getClientInfo(): LifecycleInfo | null {
    return this.adapter.getClientInfo();
  }

  getServerInfo(): LifecycleInfo | null {
    return this.adapter.getServerInfo();
  }

  onShutdown(handler: () => Promise<void> | void) {
    this.adapter.onShutdown(handler);
  }

  async shutdown(reason: string = "Server shutdown requested") {
    await this.adapter.shutdown(reason);
  }

  markInitialized() {
    this.adapter.markInitialized();
  }

  reset() {
    this.adapter.reset();
  }

  handleInitializeRequest(request: any): any {
    return this.adapter.handleInitializeRequest(request);
  }

  /**
   * Register lifecycle endpoints with MCP server
   */
  private registerLifecycleEndpoints(server: McpServer) {
    // Register ping endpoint
    server.registerTool(
      "ping",
      {
        title: "Ping",
        description: "Check server health and get uptime",
      },
      async () => ({
        content: [
          {
            type: "text",
            text: `Server is healthy. Uptime: ${this.getUptime()}ms`,
          },
        ],
      })
    );

    // Register lifecycle state endpoint
    server.registerTool(
      "get_lifecycle_state",
      {
        title: "Get Lifecycle State",
        description: "Get current server lifecycle state",
      },
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                state: this.getState(),
                uptime: this.getUptime(),
                protocolVersion: this.getProtocolVersion(),
                serverInfo: this.getServerInfo(),
                sessionStats: globalSessionManager.getStatistics(),
              },
              null,
              2
            ),
          },
        ],
      })
    );
  }

  /**
   * Setup shutdown handlers for graceful shutdown
   */
  private setupShutdownHandlers() {
    if (this.signalHandlersRegistered) {
      return;
    }

    const shutdownHandler = async (signal: string) => {
      logger.info(
        {
          message: "Received shutdown signal",
          signal,
          state: this.getState(),
        },
        "lifecycle"
      );

      await this.shutdown(`Signal received: ${signal}`);
      process.exit(0);
    };

    // Register signal handlers
    process.on("SIGINT", () => shutdownHandler("SIGINT"));
    process.on("SIGTERM", () => shutdownHandler("SIGTERM"));

    // Handle uncaught exceptions
    process.on("uncaughtException", async (error) => {
      logger.error(
        {
          message: "Uncaught exception",
          error: error.message,
          stack: error.stack,
        },
        "lifecycle"
      );

      await this.shutdown("Uncaught exception");
      process.exit(1);
    });

    // Handle unhandled rejections
    process.on("unhandledRejection", async (reason, promise) => {
      logger.error(
        {
          message: "Unhandled promise rejection",
          reason: reason instanceof Error ? reason.message : String(reason),
        },
        "lifecycle"
      );

      await this.shutdown("Unhandled promise rejection");
      process.exit(1);
    });

    this.signalHandlersRegistered = true;

    logger.debug("Shutdown handlers registered", "lifecycle");
  }
}

// Global lifecycle manager instance (for backward compatibility)
export const lifecycleManager = new LifecycleManager();

/**
 * Register lifecycle management with MCP server
 */
export function registerLifecycleManagement(server: McpServer, serverInfo: LifecycleInfo) {
  lifecycleManager.initialize(server, serverInfo);
}

/**
 * Get server status
 */
export function getServerStatus() {
  return {
    state: lifecycleManager.getState(),
    uptime: lifecycleManager.getUptime(),
    isOperational: lifecycleManager.isOperational(),
    protocolVersion: lifecycleManager.getProtocolVersion(),
    clientInfo: lifecycleManager.getClientInfo(),
    serverInfo: lifecycleManager.getServerInfo(),
    clientCapabilities: lifecycleManager.getClientCapabilities(),
    serverCapabilities: lifecycleManager.getServerCapabilities(),
    sessionStats: SessionLifecycleManagerFactory.getStats(),
    globalSessionStats: globalSessionManager.getStatistics(),
  };
}