import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LoggingLevel } from "../spec/current_spec.js";
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  PARSE_ERROR,
} from "../spec/current_spec.js";
import { sessionLogger, type SessionAwareLogData } from "./otel-session.js";

// Define log data type
type LogData = string | number | boolean | object | null | undefined;

// Sensitive data patterns to filter
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /credential/i,
  /private/i,
];

// Rate limiting for logging
interface LogRateLimit {
  lastLogTime: number;
  count: number;
  suppressed: number;
}

const LOG_RATE_LIMITS = new Map<string, LogRateLimit>();
const RATE_LIMIT_WINDOW = 1000; // 1 second
const MAX_LOGS_PER_WINDOW = 10;

// JSON-RPC error code mapping
export enum ErrorType {
  PARSE_ERROR = "parse_error",
  INVALID_REQUEST = "invalid_request",
  METHOD_NOT_FOUND = "method_not_found",
  INVALID_PARAMS = "invalid_params",
  INTERNAL_ERROR = "internal_error",
  TOOL_NOT_FOUND = "tool_not_found",
  RESOURCE_NOT_FOUND = "resource_not_found",
  AUTHENTICATION_ERROR = "authentication_error",
  TRANSPORT_ERROR = "transport_error",
}

/**
 * Error code mapping constants and utilities
 */

const ERROR_CODE_MAP: Record<ErrorType, number> = {
  [ErrorType.PARSE_ERROR]: PARSE_ERROR,
  [ErrorType.INVALID_REQUEST]: INVALID_REQUEST,
  [ErrorType.METHOD_NOT_FOUND]: METHOD_NOT_FOUND,
  [ErrorType.INVALID_PARAMS]: INVALID_PARAMS,
  [ErrorType.INTERNAL_ERROR]: INTERNAL_ERROR,
  [ErrorType.TOOL_NOT_FOUND]: METHOD_NOT_FOUND, // Tools are methods in MCP context
  [ErrorType.RESOURCE_NOT_FOUND]: METHOD_NOT_FOUND,
  [ErrorType.AUTHENTICATION_ERROR]: INVALID_REQUEST,
  [ErrorType.TRANSPORT_ERROR]: INTERNAL_ERROR,
};

const ERROR_MESSAGE_PATTERNS: Array<{
  pattern: RegExp;
  errorType: ErrorType;
}> = [
  { pattern: /tool not found|method.*not found/i, errorType: ErrorType.TOOL_NOT_FOUND },
  { pattern: /resource not found/i, errorType: ErrorType.RESOURCE_NOT_FOUND },
  {
    pattern: /invalid param|parameter.*required|missing.*param/i,
    errorType: ErrorType.INVALID_PARAMS,
  },
  { pattern: /invalid request|bad request/i, errorType: ErrorType.INVALID_REQUEST },
  { pattern: /parse error|malformed/i, errorType: ErrorType.PARSE_ERROR },
  {
    pattern: /authentication|unauthorized|forbidden/i,
    errorType: ErrorType.AUTHENTICATION_ERROR,
  },
  { pattern: /transport|connection|session/i, errorType: ErrorType.TRANSPORT_ERROR },
];

/**
 * Get JSON-RPC error code for a given error type
 */
export function getErrorCode(errorType: ErrorType): number {
  return ERROR_CODE_MAP[errorType];
}

/**
 * Automatically detect error type from error message
 */
export function detectErrorType(error: Error | string): ErrorType {
  const message = typeof error === "string" ? error : error.message;

  for (const { pattern, errorType } of ERROR_MESSAGE_PATTERNS) {
    if (pattern.test(message)) {
      return errorType;
    }
  }

  // Default to internal error if no pattern matches
  return ErrorType.INTERNAL_ERROR;
}

/**
 * Get error code from error message automatically
 */
export function getErrorCodeFromMessage(error: Error | string): number {
  const errorType = detectErrorType(error);
  return getErrorCode(errorType);
}

/**
 * Centralized Logging Manager
 *
 * Provides MCP-compliant logging with:
 * - Level-based filtering
 * - Client notification transmission
 * - Structured log formatting
 */

export class Logger {
  private server: McpServer | null = null;
  private currentLevel: LoggingLevel = "info";
  private isClientConnected = false;
  private sensitiveDataFilterEnabled = true;
  private rateLimitingEnabled = true;
  private otelSessionEnabled = true;

  // Log level severity mapping (higher number = more severe)
  private static readonly LEVEL_SEVERITY: Record<LoggingLevel, number> = {
    debug: 0,
    info: 1,
    notice: 2,
    warning: 3,
    error: 4,
    critical: 5,
    alert: 6,
    emergency: 7,
  };

  /**
   * Initialize the logger with MCP server connection
   */
  initialize(server: McpServer) {
    this.server = server;
    this.isClientConnected = true;
  }

  /**
   * Set the logging level (called from logging/setLevel endpoint)
   */
  setLevel(level: LoggingLevel) {
    const previousLevel = this.currentLevel;
    this.currentLevel = level;
    this.info({
      message: "Logging level changed",
      previousLevel,
      newLevel: level,
      timestamp: new Date().toISOString(),
    }, "logger");
  }
  
  /**
   * Enable or disable sensitive data filtering
   */
  setSensitiveDataFilter(enabled: boolean) {
    this.sensitiveDataFilterEnabled = enabled;
    this.info({
      message: "Sensitive data filtering changed",
      enabled,
      timestamp: new Date().toISOString(),
    }, "logger");
  }
  
  /**
   * Enable or disable rate limiting
   */
  setRateLimiting(enabled: boolean) {
    this.rateLimitingEnabled = enabled;
    this.info({
      message: "Log rate limiting changed",
      enabled,
      timestamp: new Date().toISOString(),
    }, "logger");
  }
  
  /**
   * Enable or disable OTel session tracking
   */
  setOTelSession(enabled: boolean) {
    this.otelSessionEnabled = enabled;
    this.info({
      message: "OTel session tracking changed",
      enabled,
      timestamp: new Date().toISOString(),
    }, "logger");
  }
  
  /**
   * Set session context for current operations
   */
  setSessionContext(sessionId: string) {
    if (this.otelSessionEnabled) {
      sessionLogger.setSessionContext(sessionId);
      this.debug({
        message: "Session context set",
        sessionId,
        timestamp: new Date().toISOString(),
      }, "session");
    }
  }
  
  /**
   * Start operation tracing
   */
  startOperation(operationName: string, attributes?: Record<string, string | number | boolean>): string | null {
    if (!this.otelSessionEnabled) {
      return null;
    }
    
    const traceId = sessionLogger.startOperation(operationName, attributes);
    if (traceId) {
      sessionLogger.setTraceContext(traceId);
      this.debug({
        message: "Operation trace started",
        operationName,
        traceId,
        attributes,
      }, "trace");
    }
    
    return traceId;
  }
  
  /**
   * End operation tracing
   */
  endOperation(traceId: string, attributes?: Record<string, string | number | boolean>) {
    if (this.otelSessionEnabled && traceId) {
      sessionLogger.endOperation(traceId, attributes);
      this.debug({
        message: "Operation trace ended",
        traceId,
        attributes,
      }, "trace");
    }
  }

  /**
   * Get current logging level
   */
  getLevel(): LoggingLevel {
    return this.currentLevel;
  }

  /**
   * Check if a log level should be output based on current level setting
   */
  private shouldLog(level: LoggingLevel): boolean {
    const currentSeverity = Logger.LEVEL_SEVERITY[this.currentLevel];
    const messageSeverity = Logger.LEVEL_SEVERITY[level];
    return messageSeverity >= currentSeverity;
  }

  /**
   * Send log message to client via MCP notification
   */
  private async sendToClient(level: LoggingLevel, logger: string | undefined, data: LogData) {
    if (!this.server || !this.isClientConnected) {
      return;
    }

    try {
      // Send notification using MCP SDK's notification method
      await this.server.server.notification({
        method: "notifications/message",
        params: {
          level,
          logger,
          data,
        },
      });
    } catch (error) {
      // Fallback to console if client notification fails
      console.error(
        `[${level.toUpperCase()}] [${logger || "server"}]`,
        data,
        `(notification failed: ${error})`
      );
    }
  }

  /**
   * Format log message for console output
   */
  private formatConsoleMessage(level: LoggingLevel, logger: string, data: LogData): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(9);
    const loggerStr = logger.padEnd(15);

    if (typeof data === "string") {
      return `${timestamp} [${levelStr}] [${loggerStr}] ${data}`;
    }

    return `${timestamp} [${levelStr}] [${loggerStr}] ${JSON.stringify(data)}`;
  }

  /**
   * Check if log should be rate limited
   */
  private shouldRateLimit(level: LoggingLevel, logger: string, data: LogData): boolean {
    if (!this.rateLimitingEnabled) {
      return false;
    }
    
    // Don't rate limit critical messages
    if (['critical', 'alert', 'emergency'].includes(level)) {
      return false;
    }
    
    const key = `${level}:${logger}:${typeof data === 'string' ? data : JSON.stringify(data).substring(0, 50)}`;
    const now = Date.now();
    
    let rateLimit = LOG_RATE_LIMITS.get(key);
    if (!rateLimit) {
      rateLimit = { lastLogTime: now, count: 1, suppressed: 0 };
      LOG_RATE_LIMITS.set(key, rateLimit);
      return false;
    }
    
    // Reset count if window has passed
    if (now - rateLimit.lastLogTime > RATE_LIMIT_WINDOW) {
      if (rateLimit.suppressed > 0) {
        // Log suppressed count before resetting
        this.logWithoutRateLimit('warning', logger, {
          message: 'Log messages were suppressed due to rate limiting',
          suppressedCount: rateLimit.suppressed,
          timeWindow: RATE_LIMIT_WINDOW,
        });
      }
      rateLimit.count = 1;
      rateLimit.suppressed = 0;
      rateLimit.lastLogTime = now;
      return false;
    }
    
    // Check if rate limit exceeded
    if (rateLimit.count >= MAX_LOGS_PER_WINDOW) {
      rateLimit.suppressed++;
      return true;
    }
    
    rateLimit.count++;
    return false;
  }
  
  /**
   * Filter sensitive data from log messages
   */
  private filterSensitiveData(data: LogData): LogData {
    if (!this.sensitiveDataFilterEnabled) {
      return data;
    }
    
    if (typeof data === 'string') {
      // Check if the string itself might be sensitive
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(data)) {
          return '[FILTERED_SENSITIVE_DATA]';
        }
      }
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      const filtered: Record<string, unknown> | unknown[] = Array.isArray(data) ? [] : {};
      
      for (const [key, value] of Object.entries(data)) {
        // Check if key is sensitive
        const isSensitiveKey = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
        
        if (isSensitiveKey) {
          (filtered as Record<string, unknown>)[key] = '[FILTERED]';
        } else if (typeof value === 'string') {
          // Check if value might be sensitive
          const isSensitiveValue = SENSITIVE_PATTERNS.some(pattern => pattern.test(value));
          (filtered as Record<string, unknown>)[key] = isSensitiveValue ? '[FILTERED]' : value;
        } else if (typeof value === 'object' && value !== null) {
          (filtered as Record<string, unknown>)[key] = this.filterSensitiveData(value);
        } else {
          (filtered as Record<string, unknown>)[key] = value;
        }
      }
      
      return filtered;
    }
    
    return data;
  }
  
  /**
   * Log without rate limiting (for internal use)
   */
  private async logWithoutRateLimit(level: LoggingLevel, logger: string, data: LogData) {
    if (!this.shouldLog(level)) {
      return;
    }

    // Enhance with session and trace context if enabled
    let enhancedData = data;
    if (this.otelSessionEnabled) {
      enhancedData = sessionLogger.enhanceLogData(data, logger);
    }

    // Filter sensitive data
    const filteredData = this.filterSensitiveData(enhancedData);

    // Always output to console for server-side debugging
    const consoleMessage = this.formatConsoleMessage(level, logger, filteredData);

    // Use appropriate console method based on severity
    switch (level) {
      case "debug":
        console.debug(consoleMessage);
        break;
      case "info":
      case "notice":
        console.info(consoleMessage);
        break;
      case "warning":
        console.warn(consoleMessage);
        break;
      case "error":
      case "critical":
      case "alert":
      case "emergency":
        console.error(consoleMessage);
        break;
    }

    // Send to client if connected
    if (this.isClientConnected) {
      await this.sendToClient(level, logger, filteredData);
    }
  }
  
  /**
   * Core logging method with rate limiting and filtering
   */
  private async log(level: LoggingLevel, logger: string, data: LogData) {
    // Check rate limiting
    if (this.shouldRateLimit(level, logger, data)) {
      return; // Silently drop the log
    }
    
    await this.logWithoutRateLimit(level, logger, data);
  }

  // Convenience methods for each log level
  async debug(data: LogData, logger = "mcp-server") {
    await this.log("debug", logger, data);
  }

  async info(data: LogData, logger = "mcp-server") {
    await this.log("info", logger, data);
  }

  async notice(data: LogData, logger = "mcp-server") {
    await this.log("notice", logger, data);
  }

  async warning(data: LogData, logger = "mcp-server") {
    await this.log("warning", logger, data);
  }

  async error(data: LogData, logger = "mcp-server") {
    await this.log("error", logger, data);
  }

  async critical(data: LogData, logger = "mcp-server") {
    await this.log("critical", logger, data);
  }

  async alert(data: LogData, logger = "mcp-server") {
    await this.log("alert", logger, data);
  }

  async emergency(data: LogData, logger = "mcp-server") {
    await this.log("emergency", logger, data);
  }

  /**
   * Disconnect logger from client
   */
  disconnect() {
    this.isClientConnected = false;
    this.info("Logger disconnected from client");
  }

  // Specialized logging helper methods

  /**
   * Log method entry with parameters (DEBUG level)
   */
  async logMethodEntry(methodName: string, params?: unknown, loggerName = "method") {
    if (this.shouldLog("debug")) {
      const paramStr = params ? JSON.stringify(params).substring(0, 200) : "()";
      await this.debug(`→ ${methodName}(${paramStr})`, loggerName);
    }
  }

  /**
   * Log MCP endpoint entry (INFO level) with automatic operation tracing
   */
  async logEndpointEntry(endpoint: string, requestId?: string | number, params?: unknown): Promise<string | null> {
    const idStr = requestId ? `[${requestId}]` : "";
    const paramInfo = params ? ` ${JSON.stringify(params).substring(0, 100)}` : "";
    
    // Start operation tracing for endpoint
    const traceId = this.startOperation(`mcp.${endpoint}`, {
      'mcp.endpoint': endpoint,
      'mcp.request.id': requestId ? String(requestId) : 'unknown',
      ...this.extractMcpAttributes(endpoint, params),
    });
    
    await this.info(`🔌 ${endpoint} triggered${idStr}${paramInfo}`, "endpoint");
    return traceId;
  }
  
  /**
   * Extract MCP-specific attributes from endpoint and parameters
   */
  private extractMcpAttributes(endpoint: string, params?: unknown): Record<string, string | number | boolean> {
    const attributes: Record<string, string | number | boolean> = {};
    
    if (params && typeof params === 'object' && params !== null) {
      const p = params as Record<string, unknown>;
      
      // Extract common MCP attributes
      if (p.uri && typeof p.uri === 'string') attributes['mcp.resource.uri'] = p.uri;
      if (p.name && typeof p.name === 'string') {
        if (endpoint.includes('tool')) attributes['mcp.tool.name'] = p.name;
        else if (endpoint.includes('prompt')) attributes['mcp.prompt.name'] = p.name;
      }
      if (p.cursor && typeof p.cursor === 'string') attributes['mcp.request.cursor'] = p.cursor;
      if (typeof p.hasMore === 'boolean') attributes['mcp.response.has_more'] = p.hasMore;
    }
    
    return attributes;
  }

  /**
   * Log server errors with context and JSON-RPC error codes (ERROR level)
   */
  async logServerError(
    error: Error | string,
    context: string,
    details?: unknown,
    errorType?: ErrorType
  ) {
    const errorMessage = typeof error === "string" ? error : error.message;

    // Automatically detect error type if not provided
    const detectedErrorType = errorType || detectErrorType(error);
    const errorCode = getErrorCode(detectedErrorType);

    const errorData: Record<string, unknown> = {
      message: errorMessage,
      context,
      errorCode,
      errorType: detectedErrorType,
    };

    if (typeof error === "object" && error instanceof Error) {
      if (error.name) errorData.errorName = error.name;
      if (error.stack) errorData.stack = error.stack.split("\n").slice(0, 3).join("\n");
    }

    if (details) errorData.details = details;

    await this.error(errorData, "server");
  }

  /**
   * Log server errors with explicit error type (ERROR level)
   */
  async logServerErrorWithType(
    error: Error | string,
    context: string,
    errorType: ErrorType,
    details?: unknown
  ) {
    await this.logServerError(error, context, details, errorType);
  }

  /**
   * Log method exit with result (DEBUG level) and end operation tracing
   */
  async logMethodExit(methodName: string, result?: unknown, loggerName = "method", traceId?: string | null) {
    if (this.shouldLog("debug")) {
      const resultStr = result ? JSON.stringify(result).substring(0, 100) : "void";
      await this.debug(`← ${methodName} → ${resultStr}`, loggerName);
    }
    
    // End operation tracing if traceId provided
    if (traceId) {
      const attributes: Record<string, string | number | boolean> = {
        'mcp.method.result': result ? 'success' : 'void',
      };
      
      // Extract performance metrics from result
      if (result && typeof result === 'object' && result !== null) {
        const r = result as Record<string, unknown>;
        if (typeof r.responseTimeMs === 'number') {
          attributes['mcp.response.time.ms'] = r.responseTimeMs;
        }
        if (typeof r.requestId === 'string' || typeof r.requestId === 'number') {
          attributes['mcp.request.id'] = String(r.requestId);
        }
      }
      
      this.endOperation(traceId, attributes);
    }
  }
  
  /**
   * Get session and trace statistics
   */
  getOTelStats(): {
    sessionEnabled: boolean;
    sessionStats: {
      activeSessions: number;
      activeTraces: number;
      sessions: Array<{
        sessionId: string;
        clientId?: string;
        transportType: string;
        uptime: number;
      }>;
    };
  } {
    if (!this.otelSessionEnabled) {
      return {
        sessionEnabled: false,
        sessionStats: {
          activeSessions: 0,
          activeTraces: 0,
          sessions: [],
        },
      };
    }
    
    const stats = sessionLogger.getSessionStats();
    return {
      sessionEnabled: true,
      sessionStats: {
        activeSessions: stats.activeSessions,
        activeTraces: stats.activeTraces,
        sessions: stats.sessions.map(s => ({
          sessionId: s.sessionId,
          clientId: s.clientId,
          transportType: s.transportType,
          uptime: Date.now() - s.startTime,
        })),
      },
    };
  }
}

// Global logger instance
export const logger = new Logger();
