import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InitializedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.js";

/**
 * MCP Lifecycle Management
 * 
 * Implements MCP lifecycle phases:
 * 1. Initialization - Protocol version negotiation and capability exchange
 * 2. Operation - Normal protocol communication  
 * 3. Shutdown - Clean connection termination
 */

export enum LifecycleState {
  UNINITIALIZED = "uninitialized",
  INITIALIZING = "initializing", 
  INITIALIZED = "initialized",
  OPERATING = "operating",
  SHUTTING_DOWN = "shutting_down",
  SHUTDOWN = "shutdown"
}

class LifecycleManager {
  private state: LifecycleState = LifecycleState.UNINITIALIZED;
  private server: McpServer | null = null;
  private startTime: Date = new Date();
  private shutdownHandlers: Array<() => Promise<void> | void> = [];

  /**
   * Initialize lifecycle manager with MCP server
   */
  initialize(server: McpServer) {
    this.server = server;
    this.state = LifecycleState.INITIALIZING;
    this.registerLifecycleEndpoints(server);
    this.setupShutdownHandlers();
    
    logger.info({
      message: "Lifecycle manager initialized",
      state: this.state,
      startTime: this.startTime.toISOString(),
    }, "lifecycle");
  }

  /**
   * Get current lifecycle state
   */
  getState(): LifecycleState {
    return this.state;
  }

  /**
   * Get server uptime in seconds
   */
  getUptime(): number {
    return (Date.now() - this.startTime.getTime()) / 1000;
  }

  /**
   * Check if server is ready for operations
   */
  isOperational(): boolean {
    return this.state === LifecycleState.OPERATING;
  }

  /**
   * Register a shutdown handler
   */
  onShutdown(handler: () => Promise<void> | void) {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Initiate graceful shutdown
   */
  async shutdown(reason: string = "Server shutdown requested") {
    if (this.state === LifecycleState.SHUTTING_DOWN || this.state === LifecycleState.SHUTDOWN) {
      return;
    }

    this.state = LifecycleState.SHUTTING_DOWN;
    
    logger.info({
      message: "Initiating graceful shutdown",
      reason,
      uptime: this.getUptime(),
    }, "lifecycle");

    try {
      // Execute shutdown handlers in reverse order (LIFO)
      for (let i = this.shutdownHandlers.length - 1; i >= 0; i--) {
        const handler = this.shutdownHandlers[i];
        try {
          await handler();
        } catch (error) {
          logger.error({
            message: "Error in shutdown handler",
            error: error instanceof Error ? error.message : String(error),
            handlerIndex: i,
          }, "lifecycle");
        }
      }

      this.state = LifecycleState.SHUTDOWN;
      
      logger.info({
        message: "Graceful shutdown completed",
        finalUptime: this.getUptime(),
      }, "lifecycle");
      
    } catch (error) {
      logger.error({
        message: "Error during shutdown",
        error: error instanceof Error ? error.message : String(error),
      }, "lifecycle");
      
      this.state = LifecycleState.SHUTDOWN;
    }
  }

  /**
   * Register lifecycle-related endpoints
   */
  private registerLifecycleEndpoints(server: McpServer) {
    // Register initialized notification handler
    server.server.setNotificationHandler(
      InitializedNotificationSchema,
      async (notification) => {
        logger.info({
          message: "Client initialization complete",
          previousState: this.state,
        }, "lifecycle");

        this.state = LifecycleState.OPERATING;
        
        logger.info({
          message: "Server is now operational",
          state: this.state,
          uptime: this.getUptime(),
        }, "lifecycle");
      }
    );
  }

  /**
   * Setup system-level shutdown handlers
   */
  private setupShutdownHandlers() {
    // Handle various shutdown signals
    const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const;
    
    shutdownSignals.forEach(signal => {
      process.on(signal, async () => {
        logger.info({
          message: `Received ${signal} signal`,
          currentState: this.state,
        }, "lifecycle");
        
        await this.shutdown(`${signal} signal received`);
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      logger.critical({
        message: "Uncaught exception",
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      }, "lifecycle");
      
      await this.shutdown(`Uncaught exception: ${error.message}`);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      logger.critical({
        message: "Unhandled promise rejection",
        reason: String(reason),
        promise: String(promise),
      }, "lifecycle");
      
      await this.shutdown(`Unhandled promise rejection: ${String(reason)}`);
      process.exit(1);
    });
  }

  /**
   * Mark initialization as complete (called after initialize endpoint)
   */
  markInitialized() {
    if (this.state === LifecycleState.INITIALIZING) {
      this.state = LifecycleState.INITIALIZED;
      
      logger.info({
        message: "Initialization phase completed, waiting for client confirmation",
        state: this.state,
      }, "lifecycle");
    }
  }
}

// Global lifecycle manager instance
export const lifecycleManager = new LifecycleManager();

/**
 * Register lifecycle management with MCP server
 */
export function registerLifecycleManagement(server: McpServer) {
  lifecycleManager.initialize(server);
}

/**
 * Get current server state information
 */
export function getServerStatus() {
  return {
    state: lifecycleManager.getState(),
    uptime: lifecycleManager.getUptime(),
    isOperational: lifecycleManager.isOperational(),
    startTime: new Date(Date.now() - lifecycleManager.getUptime() * 1000).toISOString(),
  };
}