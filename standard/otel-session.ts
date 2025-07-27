/**
 * OpenTelemetry Session Integration for MCP Logger
 *
 * Provides basic session tracking and trace context for existing logger
 * without requiring full OTel SDK installation.
 */

import type { OTelTraceContext, OTelSpan, McpOTelAttributes } from "./otel-interface.js";

// Simple session information structure
export interface SessionInfo {
  sessionId: string;
  clientId?: string;
  connectionId: string;
  transportType: "stdio" | "http" | "websocket";
  startTime: number;
  userAgent?: string;
  remoteAddress?: string;
  capabilities?: string[];
}

// Simple trace context for request tracking
export interface SimpleTraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sessionId: string;
  operationName: string;
  startTime: number;
  attributes: Record<string, string | number | boolean>;
}

// Active session store
const activeSessions = new Map<string, SessionInfo>();
const activeTraces = new Map<string, SimpleTraceContext>();

/**
 * Session Manager for tracking client connections
 */
export class SessionManager {
  private static instance: SessionManager;

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Create a new session
   */
  createSession(options: {
    clientId?: string;
    transportType: "stdio" | "http" | "websocket";
    userAgent?: string;
    remoteAddress?: string;
    capabilities?: string[];
  }): SessionInfo {
    const sessionId = this.generateSessionId();
    const connectionId = this.generateConnectionId();

    const session: SessionInfo = {
      sessionId,
      clientId: options.clientId,
      connectionId,
      transportType: options.transportType,
      startTime: Date.now(),
      userAgent: options.userAgent,
      remoteAddress: options.remoteAddress,
      capabilities: options.capabilities,
    };

    activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionInfo | undefined {
    return activeSessions.get(sessionId);
  }

  /**
   * Update session information
   */
  updateSession(sessionId: string, updates: Partial<SessionInfo>): void {
    const session = activeSessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
    }
  }

  /**
   * Remove session
   */
  removeSession(sessionId: string): void {
    activeSessions.delete(sessionId);
    // Clean up related traces
    for (const [traceId, trace] of activeTraces.entries()) {
      if (trace.sessionId === sessionId) {
        activeTraces.delete(traceId);
      }
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionInfo[] {
    return Array.from(activeSessions.values());
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

/**
 * Simple Trace Manager for request tracking
 */
export class TraceManager {
  private static instance: TraceManager;

  static getInstance(): TraceManager {
    if (!TraceManager.instance) {
      TraceManager.instance = new TraceManager();
    }
    return TraceManager.instance;
  }

  /**
   * Start a new trace for an operation
   */
  startTrace(options: {
    sessionId: string;
    operationName: string;
    parentSpanId?: string;
    attributes?: Record<string, string | number | boolean>;
  }): SimpleTraceContext {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();

    const trace: SimpleTraceContext = {
      traceId,
      spanId,
      parentSpanId: options.parentSpanId,
      sessionId: options.sessionId,
      operationName: options.operationName,
      startTime: Date.now(),
      attributes: {
        "mcp.operation": options.operationName,
        "mcp.session.id": options.sessionId,
        ...options.attributes,
      },
    };

    activeTraces.set(traceId, trace);
    return trace;
  }

  /**
   * End a trace
   */
  endTrace(traceId: string, attributes?: Record<string, string | number | boolean>): void {
    const trace = activeTraces.get(traceId);
    if (trace) {
      if (attributes) {
        Object.assign(trace.attributes, attributes);
      }
      trace.attributes["mcp.duration.ms"] = Date.now() - trace.startTime;

      // In a real implementation, this would export to OTel collector
      // For now, we just keep it for debugging
      activeTraces.delete(traceId);
    }
  }

  /**
   * Get active trace
   */
  getTrace(traceId: string): SimpleTraceContext | undefined {
    return activeTraces.get(traceId);
  }

  /**
   * Get all traces for a session
   */
  getSessionTraces(sessionId: string): SimpleTraceContext[] {
    return Array.from(activeTraces.values()).filter((trace) => trace.sessionId === sessionId);
  }

  /**
   * Generate trace ID (128-bit in hex)
   */
  private generateTraceId(): string {
    const high = Math.random().toString(16).substring(2, 18).padStart(16, "0");
    const low = Math.random().toString(16).substring(2, 18).padStart(16, "0");
    return high + low;
  }

  /**
   * Generate span ID (64-bit in hex)
   */
  private generateSpanId(): string {
    return Math.random().toString(16).substring(2, 18).padStart(16, "0");
  }
}

/**
 * Enhanced log data with session and trace context
 */
export interface SessionAwareLogData {
  message?: string;
  [key: string]: unknown;
  _session?: {
    sessionId: string;
    clientId?: string;
    connectionId: string;
    transportType: string;
  };
  _trace?: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
  };
  _otel?: {
    timestamp: number;
    resource: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
  };
}

/**
 * Session-aware logger extension
 */
export class SessionAwareLogger {
  private sessionManager = SessionManager.getInstance();
  private traceManager = TraceManager.getInstance();
  private currentSessionId?: string;
  private currentTraceId?: string;

  /**
   * Set current session context
   */
  setSessionContext(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Set current trace context
   */
  setTraceContext(traceId: string): void {
    this.currentTraceId = traceId;
  }

  /**
   * Start a new operation trace
   */
  startOperation(
    operationName: string,
    attributes?: Record<string, string | number | boolean>
  ): string | null {
    if (!this.currentSessionId) {
      return null;
    }

    const trace = this.traceManager.startTrace({
      sessionId: this.currentSessionId,
      operationName,
      parentSpanId: this.currentTraceId,
      attributes,
    });

    return trace.traceId;
  }

  /**
   * End current operation trace
   */
  endOperation(traceId: string, attributes?: Record<string, string | number | boolean>): void {
    this.traceManager.endTrace(traceId, attributes);
  }

  /**
   * Enhance log data with session and trace context
   */
  enhanceLogData(data: unknown, logger: string): SessionAwareLogData {
    let enhancedData: SessionAwareLogData;

    if (typeof data === "string") {
      enhancedData = { message: data };
    } else if (typeof data === "object" && data !== null) {
      enhancedData = { ...data } as SessionAwareLogData;
    } else {
      enhancedData = { message: String(data) };
    }

    // Add session context
    if (this.currentSessionId) {
      const session = this.sessionManager.getSession(this.currentSessionId);
      if (session) {
        enhancedData._session = {
          sessionId: session.sessionId,
          clientId: session.clientId,
          connectionId: session.connectionId,
          transportType: session.transportType,
        };
      }
    }

    // Add trace context
    if (this.currentTraceId) {
      const trace = this.traceManager.getTrace(this.currentTraceId);
      if (trace) {
        enhancedData._trace = {
          traceId: trace.traceId,
          spanId: trace.spanId,
          parentSpanId: trace.parentSpanId,
          operationName: trace.operationName,
        };
      }
    }

    // Add OTel-style metadata
    enhancedData._otel = {
      timestamp: Date.now(),
      resource: {
        "service.name": "mcp-server",
        "service.version": "1.0.0",
        "mcp.logger.name": logger,
      },
      attributes: {
        "mcp.logger.category": logger,
        "mcp.log.timestamp": new Date().toISOString(),
      },
    };

    return enhancedData;
  }

  /**
   * Create MCP-specific attributes for operations
   */
  createMcpAttributes(options: {
    endpoint?: string;
    method?: string;
    requestId?: string | number;
    resourceUri?: string;
    toolName?: string;
    promptName?: string;
    hasMore?: boolean;
    cursor?: string;
  }): Record<string, string | number | boolean> {
    const attributes: Record<string, string | number | boolean> = {};

    if (options.endpoint) attributes["mcp.endpoint"] = options.endpoint;
    if (options.method) attributes["mcp.method"] = options.method;
    if (options.requestId) attributes["mcp.request.id"] = String(options.requestId);
    if (options.resourceUri) attributes["mcp.resource.uri"] = options.resourceUri;
    if (options.toolName) attributes["mcp.tool.name"] = options.toolName;
    if (options.promptName) attributes["mcp.prompt.name"] = options.promptName;
    if (options.hasMore !== undefined) attributes["mcp.response.has_more"] = options.hasMore;
    if (options.cursor) attributes["mcp.request.cursor"] = options.cursor;

    return attributes;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    activeSessions: number;
    activeTraces: number;
    sessions: SessionInfo[];
  } {
    return {
      activeSessions: activeSessions.size,
      activeTraces: activeTraces.size,
      sessions: this.sessionManager.getActiveSessions(),
    };
  }
}

// Global session-aware logger instance
export const sessionLogger = new SessionAwareLogger();

/**
 * Helper functions for Express middleware integration
 */
export function createSessionFromRequest(req: any): SessionInfo {
  const sessionManager = SessionManager.getInstance();

  return sessionManager.createSession({
    clientId: req.headers["x-client-id"] || req.headers["user-agent"]?.substring(0, 50),
    transportType: "http",
    userAgent: req.headers["user-agent"],
    remoteAddress: req.ip || req.connection.remoteAddress,
    capabilities: req.headers["x-mcp-capabilities"]?.split(",") || [],
  });
}

/**
 * Helper to extract trace context from HTTP headers
 */
export function extractTraceContextFromHeaders(headers: Record<string, string>): {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
} {
  // Support for W3C Trace Context standard
  const traceparent = headers["traceparent"] || headers["x-trace-id"];

  if (traceparent && typeof traceparent === "string") {
    const parts = traceparent.split("-");
    if (parts.length >= 3) {
      return {
        traceId: parts[1],
        spanId: parts[2],
        parentSpanId: parts[2], // Use same as spanId for now
      };
    }
  }

  return {};
}

/**
 * Helper to inject trace context into HTTP headers
 */
export function injectTraceContextIntoHeaders(
  headers: Record<string, string>,
  context: { traceId: string; spanId: string }
): void {
  // W3C Trace Context format: version-traceId-spanId-flags
  headers["traceparent"] = `00-${context.traceId}-${context.spanId}-01`;
}
