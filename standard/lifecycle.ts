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

export class LifecycleManager {
  private state: LifecycleState = LifecycleState.UNINITIALIZED;
  private server: McpServer | null = null;
  private startTime: Date = new Date();
  private shutdownHandlers: Array<() => Promise<void> | void> = [];
  private signalHandlersRegistered = false;

  /**
   * Initialize lifecycle manager with MCP server
   */
  initialize(server: McpServer) {
    // Prevent double initialization
    if (this.state !== LifecycleState.UNINITIALIZED) {
      logger.warning(`Lifecycle already initialized in state: ${this.state}`, "lifecycle");
      return;
    }
    const traceId = logger.startOperation("lifecycle.initialize", {
      'lifecycle.server.type': 'McpServer',
      'lifecycle.state.initial': this.state,
    });
    
    logger.logMethodEntry("lifecycle.initialize", { 
      serverType: 'McpServer' 
    }, "lifecycle");
    
    try {
      this.server = server;
      this.state = LifecycleState.INITIALIZING;
      
      logger.debug("Registering lifecycle endpoints", "lifecycle");
      this.registerLifecycleEndpoints(server);
      
      logger.debug("Setting up shutdown handlers", "lifecycle");
      this.setupShutdownHandlers();
      
      logger.info({
        message: "Lifecycle manager initialized",
        state: this.state,
        startTime: this.startTime.toISOString(),
        serverType: 'McpServer',
      }, "lifecycle");
      
      logger.logMethodExit("lifecycle.initialize", { state: this.state }, "lifecycle", traceId);
      
      if (traceId) {
        logger.endOperation(traceId, {
          'lifecycle.state.final': this.state,
          'lifecycle.initialization.success': true,
        });
      }
    } catch (error) {
      if (traceId) {
        logger.endOperation(traceId, {
          'lifecycle.initialization.success': false,
          'lifecycle.error.type': error instanceof Error ? error.name : 'unknown',
        });
      }
      throw error;
    }
  }

  /**
   * Get current lifecycle state
   */
  getState(): LifecycleState {
    return this.state;
  }

  /**
   * Get current lifecycle state (alias for getState)
   */
  get currentState(): LifecycleState {
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
    logger.debug({
      message: "Shutdown handler registered",
      totalHandlers: this.shutdownHandlers.length,
    }, "lifecycle");
  }

  /**
   * Initiate graceful shutdown
   */
  async shutdown(reason: string = "Server shutdown requested") {
    if (this.state === LifecycleState.SHUTTING_DOWN || this.state === LifecycleState.SHUTDOWN) {
      return;
    }

    const traceId = logger.startOperation("lifecycle.shutdown", {
      'lifecycle.shutdown.reason': reason,
      'lifecycle.state.previous': this.state,
      'lifecycle.uptime.ms': this.getUptime() * 1000,
    });

    const previousState = this.state;
    this.state = LifecycleState.SHUTTING_DOWN;
    
    logger.info({
      message: "Initiating graceful shutdown",
      reason,
      previousState,
      uptime: this.getUptime(),
    }, "lifecycle");

    try {
      // Handle shutdown during different states
      if (previousState === LifecycleState.INITIALIZING) {
        logger.warning("Shutdown requested during initialization - will complete gracefully", "lifecycle");
        // Allow a brief moment for initialization to complete or be interrupted
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Execute shutdown handlers in reverse order (LIFO)
      for (let i = this.shutdownHandlers.length - 1; i >= 0; i--) {
        const handler = this.shutdownHandlers[i];
        try {
          await Promise.race([
            handler(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Shutdown handler timeout')), 5000)
            )
          ]);
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
        handlersExecuted: this.shutdownHandlers.length,
      }, "lifecycle");
      
      if (traceId) {
        logger.endOperation(traceId, {
          'lifecycle.shutdown.success': true,
          'lifecycle.handlers.executed': this.shutdownHandlers.length,
          'lifecycle.final.uptime.ms': this.getUptime() * 1000,
        });
      }
      
    } catch (error) {
      logger.error({
        message: "Error during shutdown",
        error: error instanceof Error ? error.message : String(error),
      }, "lifecycle");
      
      if (traceId) {
        logger.endOperation(traceId, {
          'lifecycle.shutdown.success': false,
          'lifecycle.error.type': error instanceof Error ? error.name : 'unknown',
        });
      }
      
      this.state = LifecycleState.SHUTDOWN;
    }
  }

  /**
   * Register lifecycle-related endpoints
   */
  private registerLifecycleEndpoints(server: McpServer) {
    try {
      // Register initialized notification handler
      server.setNotificationHandler(
        InitializedNotificationSchema,
        async () => {
        if (this.state === LifecycleState.SHUTTING_DOWN || this.state === LifecycleState.SHUTDOWN) {
          logger.warning("Initialized notification received during shutdown - ignoring", "lifecycle");
          return;
        }

        logger.info({
          message: "Client initialization complete",
          previousState: this.state,
        }, "lifecycle");

        if (this.state === LifecycleState.INITIALIZED) {
          this.state = LifecycleState.OPERATING;
          
          logger.info({
            message: "Server is now operational",
            state: this.state,
            uptime: this.getUptime(),
          }, "lifecycle");
        } else {
          logger.warning(`Initialized notification received in invalid state: ${this.state}`, "lifecycle");
        }
      }
    );
    } catch (error) {
      logger.warning({
        message: "Failed to register lifecycle endpoints - MCP server may not support notification handlers",
        error: error instanceof Error ? error.message : String(error),
      }, "lifecycle");
    }
  }

  /**
   * Setup system-level shutdown handlers
   */
  private setupShutdownHandlers() {
    // Prevent duplicate signal handler registration
    if (this.signalHandlersRegistered) {
      logger.debug("Signal handlers already registered, skipping", "lifecycle");
      return;
    }
    
    logger.logMethodEntry("lifecycle.setupShutdownHandlers", undefined, "lifecycle");
    
    // Handle various shutdown signals
    const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const;
    
    shutdownSignals.forEach(signal => {
      process.on(signal, async () => {
        logger.alert({
          message: `Received ${signal} signal`,
          currentState: this.state,
          uptime: this.getUptime(),
          signal,
        }, "lifecycle");
        
        await this.shutdown(`${signal} signal received`);
        process.exit(0);
      });
      
      logger.debug(`Registered ${signal} signal handler`, "lifecycle");
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      logger.critical({
        message: "Uncaught exception - initiating emergency shutdown",
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        state: this.state,
        uptime: this.getUptime(),
      }, "lifecycle");
      
      await this.shutdown(`Uncaught exception: ${error.message}`);
      process.exit(1);
    });
    
    logger.debug("Registered uncaughtException handler", "lifecycle");

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      logger.critical({
        message: "Unhandled promise rejection - initiating emergency shutdown",
        reason: String(reason),
        promise: String(promise),
        state: this.state,
        uptime: this.getUptime(),
      }, "lifecycle");
      
      await this.shutdown(`Unhandled promise rejection: ${String(reason)}`);
      process.exit(1);
    });
    
    logger.debug("Registered unhandledRejection handler", "lifecycle");
    logger.info(`Registered ${shutdownSignals.length} signal handlers + 2 error handlers`, "lifecycle");
    
    this.signalHandlersRegistered = true;
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
    } else if (this.state === LifecycleState.SHUTTING_DOWN) {
      logger.warning("Initialize completed during shutdown - ignoring", "lifecycle");
    } else {
      logger.warning(`markInitialized called in invalid state: ${this.state}`, "lifecycle");
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