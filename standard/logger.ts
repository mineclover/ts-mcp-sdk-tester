import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LoggingLevel } from "../spec/current_spec.js";
import { 
  PARSE_ERROR,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  INVALID_PARAMS,
  INTERNAL_ERROR
} from "../spec/current_spec.js";
import { APP_CONFIG } from "./constants.js";

// Define log data type
type LogData = string | number | boolean | object | null | undefined;

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
  TRANSPORT_ERROR = "transport_error"
}

/**
 * Error code mapping utility
 */
export class ErrorCodeMapper {
  private static readonly ERROR_CODE_MAP: Record<ErrorType, number> = {
    [ErrorType.PARSE_ERROR]: PARSE_ERROR,
    [ErrorType.INVALID_REQUEST]: INVALID_REQUEST,
    [ErrorType.METHOD_NOT_FOUND]: METHOD_NOT_FOUND,
    [ErrorType.INVALID_PARAMS]: INVALID_PARAMS,
    [ErrorType.INTERNAL_ERROR]: INTERNAL_ERROR,
    [ErrorType.TOOL_NOT_FOUND]: METHOD_NOT_FOUND, // Tools are methods in MCP context
    [ErrorType.RESOURCE_NOT_FOUND]: METHOD_NOT_FOUND,
    [ErrorType.AUTHENTICATION_ERROR]: INVALID_REQUEST,
    [ErrorType.TRANSPORT_ERROR]: INTERNAL_ERROR
  };

  private static readonly ERROR_MESSAGE_PATTERNS: Array<{
    pattern: RegExp;
    errorType: ErrorType;
  }> = [
    { pattern: /tool not found|method.*not found/i, errorType: ErrorType.TOOL_NOT_FOUND },
    { pattern: /resource not found/i, errorType: ErrorType.RESOURCE_NOT_FOUND },
    { pattern: /invalid param|parameter.*required|missing.*param/i, errorType: ErrorType.INVALID_PARAMS },
    { pattern: /invalid request|bad request/i, errorType: ErrorType.INVALID_REQUEST },
    { pattern: /parse error|malformed/i, errorType: ErrorType.PARSE_ERROR },
    { pattern: /authentication|unauthorized|forbidden/i, errorType: ErrorType.AUTHENTICATION_ERROR },
    { pattern: /transport|connection|session/i, errorType: ErrorType.TRANSPORT_ERROR }
  ];

  /**
   * Get JSON-RPC error code for a given error type
   */
  static getErrorCode(errorType: ErrorType): number {
    return this.ERROR_CODE_MAP[errorType];
  }

  /**
   * Automatically detect error type from error message
   */
  static detectErrorType(error: Error | string): ErrorType {
    const message = typeof error === 'string' ? error : error.message;
    
    for (const { pattern, errorType } of this.ERROR_MESSAGE_PATTERNS) {
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
  static getErrorCodeFromMessage(error: Error | string): number {
    const errorType = this.detectErrorType(error);
    return this.getErrorCode(errorType);
  }
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
    this.currentLevel = level;
    this.info(`Logging level changed to: ${level}`);
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
      console.error(`[${level.toUpperCase()}] [${logger || 'server'}]`, data, 
        `(notification failed: ${error})`);
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
   * Core logging method
   */
  private async log(level: LoggingLevel, logger: string, data: LogData) {
    if (!this.shouldLog(level)) {
      return;
    }

    // Always output to console for server-side debugging
    const consoleMessage = this.formatConsoleMessage(level, logger, data);
    
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
      await this.sendToClient(level, logger, data);
    }
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
   * Log MCP endpoint entry (INFO level)
   */
  async logEndpointEntry(endpoint: string, requestId?: string | number, params?: unknown) {
    const idStr = requestId ? `[${requestId}]` : "";
    const paramInfo = params ? ` ${JSON.stringify(params).substring(0, 100)}` : "";
    await this.info(`🔌 ${endpoint} triggered${idStr}${paramInfo}`, "endpoint");
  }

  /**
   * Log server errors with context and JSON-RPC error codes (ERROR level)
   */
  async logServerError(error: Error | string, context: string, details?: unknown, errorType?: ErrorType) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    // Automatically detect error type if not provided
    const detectedErrorType = errorType || ErrorCodeMapper.detectErrorType(error);
    const errorCode = ErrorCodeMapper.getErrorCode(detectedErrorType);
    
    const errorData: Record<string, unknown> = {
      message: errorMessage,
      context,
      errorCode,
      errorType: detectedErrorType,
    };
    
    if (typeof error === 'object' && error instanceof Error) {
      if (error.name) errorData.errorName = error.name;
      if (error.stack) errorData.stack = error.stack.split('\n').slice(0, 3).join('\n');
    }
    
    if (details) errorData.details = details;
    
    await this.error(errorData, "server");
  }

  /**
   * Log server errors with explicit error type (ERROR level)
   */
  async logServerErrorWithType(error: Error | string, context: string, errorType: ErrorType, details?: unknown) {
    await this.logServerError(error, context, details, errorType);
  }

  /**
   * Log method exit with result (DEBUG level)
   */
  async logMethodExit(methodName: string, result?: unknown, loggerName = "method") {
    if (this.shouldLog("debug")) {
      const resultStr = result ? JSON.stringify(result).substring(0, 100) : "void";
      await this.debug(`← ${methodName} → ${resultStr}`, loggerName);
    }
  }
}

// Global logger instance
export const logger = new Logger();