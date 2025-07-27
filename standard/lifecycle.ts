import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  InitializedNotificationSchema,
  InitializeRequestSchema,
  InitializeResultSchema
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.js";
import { SessionManager, type SessionInfo } from "./otel-session.js";
import { APP_CONFIG } from "./constants.js";

/**
 * MCP Lifecycle Management
 * 
 * Implements MCP lifecycle phases according to specification:
 * https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
 * 
 * 1. Initialization - Protocol version negotiation and capability exchange
 * 2. Operation - Normal protocol communication  
 * 3. Shutdown - Clean connection termination
 * 
 * Supports session isolation for multi-user environments
 */

export enum LifecycleState {
  UNINITIALIZED = "uninitialized",
  INITIALIZING = "initializing", 
  INITIALIZED = "initialized",
  OPERATING = "operating",
  SHUTTING_DOWN = "shutting_down",
  SHUTDOWN = "shutdown",
}

export interface LifecycleCapabilities {
  // Client capabilities
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, unknown>;
  elicitation?: Record<string, unknown>;
  experimental?: Record<string, unknown>;
  
  // Server capabilities  
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
  logging?: Record<string, unknown>;
  completions?: Record<string, unknown>;
}

export interface LifecycleInfo {
  name: string;
  title?: string;
  version: string;
}

/**
 * Session-specific lifecycle manager for user isolation
 */
export class SessionLifecycleManager {
  private sessionId: string;
  private state: LifecycleState = LifecycleState.UNINITIALIZED;
  private server: McpServer | null = null;
  private startTime: Date = new Date();
  private shutdownHandlers: Array<() => Promise<void> | void> = [];
  
  // Protocol version and capabilities tracking (session-specific)
  private protocolVersion: string = APP_CONFIG.protocol;
  private clientCapabilities: LifecycleCapabilities = {};
  private serverCapabilities: LifecycleCapabilities = {};
  private clientInfo: LifecycleInfo | null = null;
  private serverInfo: LifecycleInfo | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    
    logger.debug(`Session lifecycle manager created for session: ${sessionId}`, "lifecycle");
  }

  /**
   * Initialize session-specific lifecycle manager
   */
  initialize(server: McpServer, serverInfo: LifecycleInfo) {
    // Prevent double initialization
    if (this.state !== LifecycleState.UNINITIALIZED) {
      logger.warning(`Session lifecycle already initialized in state: ${this.state} for session: ${this.sessionId}`, "lifecycle");
      return;
    }
    
    const traceId = logger.startOperation("lifecycle.session.initialize", {
      "lifecycle.session.id": this.sessionId,
      "lifecycle.server.type": "McpServer",
      "lifecycle.state.initial": this.state,
      "lifecycle.server.name": serverInfo.name,
      "lifecycle.server.version": serverInfo.version,
    });

    logger.logMethodEntry(
      "lifecycle.session.initialize",
      {
        sessionId: this.sessionId,
        serverType: "McpServer",
        serverInfo,
      },
      "lifecycle"
    );

    try {
      this.server = server;
      this.serverInfo = serverInfo;
      this.state = LifecycleState.INITIALIZING;
      this.startTime = new Date();

      logger.info(
        {
          message: "Session lifecycle manager initialized",
          sessionId: this.sessionId,
          state: this.state,
          serverInfo,
        },
        "lifecycle"
      );

      if (traceId) {
        logger.endOperation(traceId, {
          "lifecycle.state.final": this.state,
          "lifecycle.session.initialized": true,
        });
      }
    } catch (error) {
      logger.error(
        {
          message: "Failed to initialize session lifecycle manager",
          sessionId: this.sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        "lifecycle"
      );
      throw error;
    }
  }

  /**
   * Get current lifecycle state for this session
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
   * Get session uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Check if session is operational
   */
  isOperational(): boolean {
    return this.state === LifecycleState.OPERATING;
  }

  /**
   * Get protocol version for this session
   */
  getProtocolVersion(): string {
    return this.protocolVersion;
  }

  /**
   * Get client capabilities for this session
   */
  getClientCapabilities(): LifecycleCapabilities {
    return { ...this.clientCapabilities };
  }

  /**
   * Get server capabilities for this session
   */
  getServerCapabilities(): LifecycleCapabilities {
    return { ...this.serverCapabilities };
  }

  /**
   * Get client info for this session
   */
  getClientInfo(): LifecycleInfo | null {
    return this.clientInfo;
  }

  /**
   * Get server info for this session
   */
  getServerInfo(): LifecycleInfo | null {
    return this.serverInfo;
  }

  /**
   * Register shutdown handler for this session
   */
  onShutdown(handler: () => Promise<void> | void) {
    this.shutdownHandlers.push(handler);
    
    logger.debug(
      {
        message: "Shutdown handler registered for session",
        sessionId: this.sessionId,
        handlerCount: this.shutdownHandlers.length,
      },
      "lifecycle"
    );
  }

  /**
   * Shutdown session lifecycle manager
   */
  async shutdown(reason: string = "Session shutdown requested") {
    if (this.state === LifecycleState.SHUTTING_DOWN || this.state === LifecycleState.SHUTDOWN) {
      logger.warning(
        {
          message: "Session lifecycle already shutting down",
          sessionId: this.sessionId,
          currentState: this.state,
        },
        "lifecycle"
      );
      return;
    }

    const traceId = logger.startOperation("lifecycle.session.shutdown", {
      "lifecycle.session.id": this.sessionId,
      "lifecycle.state.initial": this.state,
      "lifecycle.shutdown.reason": reason,
    });

    logger.info(
      {
        message: "Starting session lifecycle shutdown",
        sessionId: this.sessionId,
        reason,
        state: this.state,
        uptime: this.getUptime(),
      },
      "lifecycle"
    );

    try {
      this.state = LifecycleState.SHUTTING_DOWN;

      // Execute session-specific shutdown handlers
      if (this.shutdownHandlers.length > 0) {
        logger.debug(
          {
            message: "Executing session shutdown handlers",
            sessionId: this.sessionId,
            handlerCount: this.shutdownHandlers.length,
          },
          "lifecycle"
        );

        const shutdownPromises = this.shutdownHandlers.map(async (handler, index) => {
          try {
            const handlerStartTime = Date.now();
            await Promise.resolve(handler());
            const handlerDuration = Date.now() - handlerStartTime;
            
            logger.debug(
              {
                message: "Session shutdown handler completed",
                sessionId: this.sessionId,
                handlerIndex: index,
                duration: handlerDuration,
              },
              "lifecycle"
            );
          } catch (error) {
            logger.warning(
              {
                message: "Session shutdown handler failed",
                sessionId: this.sessionId,
                handlerIndex: index,
                error: error instanceof Error ? error.message : String(error),
              },
              "lifecycle"
            );
          }
        });

        // Wait for all handlers with timeout
        const timeout = setTimeout(() => {
          logger.warning(
            {
              message: "Session shutdown handlers timeout",
              sessionId: this.sessionId,
              timeoutMs: 5000,
            },
            "lifecycle"
          );
        }, 5000);

        await Promise.all(shutdownPromises);
        clearTimeout(timeout);
      }

      this.state = LifecycleState.SHUTDOWN;
      this.server = null;

      logger.info(
        {
          message: "Session lifecycle shutdown completed",
          sessionId: this.sessionId,
          state: this.state,
          totalUptime: this.getUptime(),
        },
        "lifecycle"
      );

      if (traceId) {
        logger.endOperation(traceId, {
          "lifecycle.state.final": this.state,
          "lifecycle.session.shutdown.completed": true,
          "lifecycle.session.total.uptime.ms": this.getUptime(),
        });
      }
    } catch (error) {
      logger.error(
        {
          message: "Session lifecycle shutdown failed",
          sessionId: this.sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        "lifecycle"
      );
      throw error;
    }
  }

  /**
   * Mark session as initialized
   */
  markInitialized() {
    if (this.state !== LifecycleState.INITIALIZING) {
      logger.warning(
        {
          message: "Cannot mark session as initialized - not in initializing state",
          sessionId: this.sessionId,
          currentState: this.state,
        },
        "lifecycle"
      );
      return;
    }

    this.state = LifecycleState.INITIALIZED;
    
    logger.info(
      {
        message: "Session marked as initialized",
        sessionId: this.sessionId,
        state: this.state,
      },
      "lifecycle"
    );
  }

  /**
   * Reset session lifecycle manager to initial state (for testing)
   */
  reset() {
    this.state = LifecycleState.UNINITIALIZED;
    this.server = null;
    this.startTime = new Date();
    this.shutdownHandlers = [];
    this.protocolVersion = APP_CONFIG.protocol;
    this.clientCapabilities = {};
    this.serverCapabilities = {};
    this.clientInfo = null;
    this.serverInfo = null;

    logger.debug(
      {
        message: "Session lifecycle manager reset to initial state",
        sessionId: this.sessionId,
      },
      "lifecycle"
    );
  }

  /**
   * Handle initialize request for this session
   */
  handleInitializeRequest(request: any): any {
    if (this.state === LifecycleState.SHUTTING_DOWN || this.state === LifecycleState.SHUTDOWN) {
      throw new Error("Session is shutting down");
    }

    logger.info(
      {
        message: "Session initialize request received",
        sessionId: this.sessionId,
        clientProtocolVersion: request.params.protocolVersion,
        clientCapabilities: request.params.capabilities,
        clientInfo: request.params.clientInfo,
      },
      "lifecycle"
    );

    // Version negotiation
    const requestedVersion = request.params.protocolVersion;
    if (requestedVersion !== this.protocolVersion) {
      logger.warning(
        {
          message: "Protocol version mismatch for session",
          sessionId: this.sessionId,
          requested: requestedVersion,
          supported: this.protocolVersion,
        },
        "lifecycle"
      );

      throw new Error(`Unsupported protocol version. Server supports: ${this.protocolVersion}`);
    }

    // Store client information for this session
    this.clientCapabilities = request.params.capabilities;
    this.clientInfo = request.params.clientInfo;

    // Define server capabilities for this session
    this.serverCapabilities = {
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
      logging: {},
      completions: {},
    };

    logger.info(
      {
        message: "Session initialize request processed successfully",
        sessionId: this.sessionId,
        negotiatedVersion: this.protocolVersion,
        clientCapabilities: this.clientCapabilities,
        serverCapabilities: this.serverCapabilities,
      },
      "lifecycle"
    );

    // Mark initialization as complete for this session
    this.markInitialized();

    return {
      protocolVersion: this.protocolVersion,
      capabilities: this.serverCapabilities,
      serverInfo: this.serverInfo,
      instructions: "MCP server ready for operation",
    };
  }

  /**
   * Get session-specific server status
   */
  getSessionStatus() {
    return {
      sessionId: this.sessionId,
      state: this.state,
      uptime: this.getUptime(),
      protocolVersion: this.protocolVersion,
      clientCapabilities: this.clientCapabilities,
      serverCapabilities: this.serverCapabilities,
      clientInfo: this.clientInfo,
      serverInfo: this.serverInfo,
    };
  }
}

/**
 * Global lifecycle manager for server-wide state
 * (Maintains backward compatibility)
 */
export class LifecycleManager {
  private state: LifecycleState = LifecycleState.UNINITIALIZED;
  private server: McpServer | null = null;
  private startTime: Date = new Date();
  private shutdownHandlers: Array<() => Promise<void> | void> = [];
  private signalHandlersRegistered = false;
  
  // Protocol version and capabilities tracking
  private protocolVersion: string = APP_CONFIG.protocol;
  private clientCapabilities: LifecycleCapabilities = {};
  private serverCapabilities: LifecycleCapabilities = {};
  private clientInfo: LifecycleInfo | null = null;
  private serverInfo: LifecycleInfo | null = null;

  /**
   * Initialize lifecycle manager with MCP server
   */
  initialize(server: McpServer, serverInfo: LifecycleInfo) {
    // Prevent double initialization
    if (this.state !== LifecycleState.UNINITIALIZED) {
      logger.warning(`Lifecycle already initialized in state: ${this.state}`, "lifecycle");
      return;
    }
    
    const traceId = logger.startOperation("lifecycle.initialize", {
      "lifecycle.server.type": "McpServer",
      "lifecycle.state.initial": this.state,
      "lifecycle.server.name": serverInfo.name,
      "lifecycle.server.version": serverInfo.version,
    });

    logger.logMethodEntry(
      "lifecycle.initialize",
      {
        serverType: "McpServer",
        serverInfo,
      },
      "lifecycle"
    );

    try {
      this.server = server;
      this.serverInfo = serverInfo;
      this.state = LifecycleState.INITIALIZING;
      this.startTime = new Date();

      // Register lifecycle endpoints
      this.registerLifecycleEndpoints(server);

      // Setup shutdown handlers
      this.setupShutdownHandlers();

      logger.info(
        {
          message: "Lifecycle manager initialized",
          state: this.state,
          serverInfo,
        },
        "lifecycle"
      );

      if (traceId) {
        logger.endOperation(traceId, {
          "lifecycle.state.final": this.state,
          "lifecycle.initialized": true,
        });
      }
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
   * Get server uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Check if server is operational
   */
  isOperational(): boolean {
    return this.state === LifecycleState.OPERATING;
  }

  /**
   * Get protocol version
   */
  getProtocolVersion(): string {
    return this.protocolVersion;
  }

  /**
   * Get client capabilities
   */
  getClientCapabilities(): LifecycleCapabilities {
    return { ...this.clientCapabilities };
  }

  /**
   * Get server capabilities
   */
  getServerCapabilities(): LifecycleCapabilities {
    return { ...this.serverCapabilities };
  }

  /**
   * Get client info
   */
  getClientInfo(): LifecycleInfo | null {
    return this.clientInfo;
  }

  /**
   * Get server info
   */
  getServerInfo(): LifecycleInfo | null {
    return this.serverInfo;
  }

  /**
   * Register shutdown handler
   */
  onShutdown(handler: () => Promise<void> | void) {
    this.shutdownHandlers.push(handler);
    
    logger.debug(
      {
        message: "Shutdown handler registered",
        handlerCount: this.shutdownHandlers.length,
      },
      "lifecycle"
    );
  }

  /**
   * Shutdown lifecycle manager
   */
  async shutdown(reason: string = "Server shutdown requested") {
    if (this.state === LifecycleState.SHUTTING_DOWN || this.state === LifecycleState.SHUTDOWN) {
      logger.warning(
        {
          message: "Lifecycle already shutting down",
          currentState: this.state,
        },
        "lifecycle"
      );
      return;
    }

    const traceId = logger.startOperation("lifecycle.shutdown", {
      "lifecycle.state.initial": this.state,
      "lifecycle.shutdown.reason": reason,
    });

    logger.info(
      {
        message: "Starting lifecycle shutdown",
        reason,
        state: this.state,
        uptime: this.getUptime(),
      },
      "lifecycle"
    );

    try {
      this.state = LifecycleState.SHUTTING_DOWN;

      // Execute shutdown handlers
      if (this.shutdownHandlers.length > 0) {
        logger.debug(
          {
            message: "Executing shutdown handlers",
            handlerCount: this.shutdownHandlers.length,
          },
          "lifecycle"
        );

        const shutdownPromises = this.shutdownHandlers.map(async (handler, index) => {
          try {
            const handlerStartTime = Date.now();
            await Promise.resolve(handler());
            const handlerDuration = Date.now() - handlerStartTime;
            
            logger.debug(
              {
                message: "Shutdown handler completed",
                handlerIndex: index,
                duration: handlerDuration,
              },
              "lifecycle"
            );
          } catch (error) {
            logger.warning(
              {
                message: "Shutdown handler failed",
                handlerIndex: index,
                error: error instanceof Error ? error.message : String(error),
              },
              "lifecycle"
            );
          }
        });

        // Wait for all handlers with timeout
        const timeout = setTimeout(() => {
          logger.warning(
            {
              message: "Shutdown handlers timeout",
              timeoutMs: 5000,
            },
            "lifecycle"
          );
        }, 5000);

        await Promise.all(shutdownPromises);
        clearTimeout(timeout);
      }

      this.state = LifecycleState.SHUTDOWN;
      this.server = null;

      logger.info(
        {
          message: "Lifecycle shutdown completed",
          state: this.state,
          totalUptime: this.getUptime(),
        },
        "lifecycle"
      );

      if (traceId) {
        logger.endOperation(traceId, {
          "lifecycle.state.final": this.state,
          "lifecycle.shutdown.completed": true,
          "lifecycle.total.uptime.ms": this.getUptime(),
        });
      }
    } catch (error) {
      logger.error(
        {
          message: "Lifecycle shutdown failed",
          error: error instanceof Error ? error.message : String(error),
        },
        "lifecycle"
      );
      throw error;
    }
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
                state: this.state,
                uptime: this.getUptime(),
                protocolVersion: this.protocolVersion,
                serverInfo: this.serverInfo,
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
          state: this.state,
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

  /**
   * Mark server as initialized
   */
  markInitialized() {
    if (this.state !== LifecycleState.INITIALIZING) {
      logger.warning(
        {
          message: "Cannot mark as initialized - not in initializing state",
          currentState: this.state,
        },
        "lifecycle"
      );
      return;
    }

    this.state = LifecycleState.INITIALIZED;
    
    logger.info(
      {
        message: "Server marked as initialized",
        state: this.state,
      },
      "lifecycle"
    );
  }

  /**
   * Reset lifecycle manager to initial state (for testing)
   */
  reset() {
    this.state = LifecycleState.UNINITIALIZED;
    this.server = null;
    this.startTime = new Date();
    this.shutdownHandlers = [];
    this.signalHandlersRegistered = false;
    this.protocolVersion = APP_CONFIG.protocol;
    this.clientCapabilities = {};
    this.serverCapabilities = {};
    this.clientInfo = null;
    this.serverInfo = null;

    logger.debug("Lifecycle manager reset to initial state", "lifecycle");
  }

  /**
   * Handle initialize request (to be called from transport layer)
   */
  handleInitializeRequest(request: any): any {
    if (this.state === LifecycleState.SHUTTING_DOWN || this.state === LifecycleState.SHUTDOWN) {
      throw new Error("Server is shutting down");
    }

    logger.info(
      {
        message: "Initialize request received",
        clientProtocolVersion: request.params.protocolVersion,
        clientCapabilities: request.params.capabilities,
        clientInfo: request.params.clientInfo,
      },
      "lifecycle"
    );

    // Version negotiation
    const requestedVersion = request.params.protocolVersion;
    if (requestedVersion !== this.protocolVersion) {
      logger.warning(
        {
          message: "Protocol version mismatch",
          requested: requestedVersion,
          supported: this.protocolVersion,
        },
        "lifecycle"
      );

      // According to spec, server should respond with supported version
      // Client should disconnect if it doesn't support the server's version
      throw new Error(`Unsupported protocol version. Server supports: ${this.protocolVersion}`);
    }

    // Store client information
    this.clientCapabilities = request.params.capabilities;
    this.clientInfo = request.params.clientInfo;

    // Define server capabilities based on what the server actually supports
    this.serverCapabilities = {
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
      logging: {},
      completions: {},
    };

    logger.info(
      {
        message: "Initialize request processed successfully",
        negotiatedVersion: this.protocolVersion,
        clientCapabilities: this.clientCapabilities,
        serverCapabilities: this.serverCapabilities,
      },
      "lifecycle"
    );

    // Mark initialization as complete
    this.markInitialized();

    return {
      protocolVersion: this.protocolVersion,
      capabilities: this.serverCapabilities,
      serverInfo: this.serverInfo,
      instructions: "MCP server ready for operation",
    };
  }
}

/**
 * Session Lifecycle Manager Factory
 */
export class SessionLifecycleManagerFactory {
  private static sessionManagers = new Map<string, SessionLifecycleManager>();
  private static sessionManager = SessionManager.getInstance();

  /**
   * Get or create session lifecycle manager
   */
  static getSessionLifecycleManager(sessionId: string): SessionLifecycleManager {
    let manager = this.sessionManagers.get(sessionId);
    
    if (!manager) {
      manager = new SessionLifecycleManager(sessionId);
      this.sessionManagers.set(sessionId, manager);
      
      logger.debug(
        {
          message: "Created new session lifecycle manager",
          sessionId,
          totalManagers: this.sessionManagers.size,
        },
        "lifecycle"
      );
    }
    
    return manager;
  }

  /**
   * Remove session lifecycle manager
   */
  static removeSessionLifecycleManager(sessionId: string): void {
    const manager = this.sessionManagers.get(sessionId);
    if (manager) {
      // Shutdown the manager before removing
      manager.shutdown("Session cleanup").catch(error => {
        logger.warning(
          {
            message: "Error during session lifecycle manager shutdown",
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          "lifecycle"
        );
      });
      
      this.sessionManagers.delete(sessionId);
      
      logger.debug(
        {
          message: "Removed session lifecycle manager",
          sessionId,
          remainingManagers: this.sessionManagers.size,
        },
        "lifecycle"
      );
    }
  }

  /**
   * Get all active session lifecycle managers
   */
  static getAllSessionLifecycleManagers(): Map<string, SessionLifecycleManager> {
    return new Map(this.sessionManagers);
  }

  /**
   * Get session lifecycle manager statistics
   */
  static getSessionLifecycleStats() {
    const managers = Array.from(this.sessionManagers.values());
    const operationalCount = managers.filter(m => m.isOperational()).length;
    const initializingCount = managers.filter(m => m.getState() === LifecycleState.INITIALIZING).length;
    const initializedCount = managers.filter(m => m.getState() === LifecycleState.INITIALIZED).length;
    const shuttingDownCount = managers.filter(m => m.getState() === LifecycleState.SHUTTING_DOWN).length;
    const shutdownCount = managers.filter(m => m.getState() === LifecycleState.SHUTDOWN).length;

    return {
      total: managers.length,
      operational: operationalCount,
      initializing: initializingCount,
      initialized: initializedCount,
      shuttingDown: shuttingDownCount,
      shutdown: shutdownCount,
    };
  }

  /**
   * Cleanup inactive session lifecycle managers
   */
  static cleanupInactiveSessions(maxInactiveTime: number = 30 * 60 * 1000): number {
    let cleanedCount = 0;

    for (const [sessionId, manager] of this.sessionManagers.entries()) {
      const uptime = manager.getUptime();
      if (uptime > maxInactiveTime) {
        this.removeSessionLifecycleManager(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(
        {
          message: "Cleaned up inactive session lifecycle managers",
          cleanedCount,
          maxInactiveTime,
        },
        "lifecycle"
      );
    }

    return cleanedCount;
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
    sessionStats: SessionLifecycleManagerFactory.getSessionLifecycleStats(),
  };
}
