/**
 * MCP 로깅 시스템 확장 유틸리티
 * 
 * 특정 시나리오별 로깅 헬퍼와 편의 함수들을 제공합니다.
 */

import { logger } from "../logger.js";
import type { McpEndpointContext, McpOperationContext } from "./logging-patterns.js";

/**
 * MCP 세션 컨텍스트 (단순 데이터 홀더)
 * @deprecated SessionManager를 사용하세요
 */
export class McpSessionContext {
  constructor(
    public sessionId: string,
    public clientType: string,
    public userId?: string,
    public capabilities: string[] = []
  ) {}

  /**
   * @deprecated globalSessionManager.activateSession()을 사용하세요
   */
  activate(): void {
    logger.setSessionContext(this.sessionId);
  }

  /**
   * @deprecated globalSessionManager.createEndpointContext()를 사용하세요
   */
  createEndpointContext(
    endpoint: string,
    requestId: string,
    category: string = "mcp"
  ): McpEndpointContext {
    return {
      endpoint,
      requestId,
      category,
      sessionId: this.sessionId,
      userId: this.userId,
      clientType: this.clientType,
    };
  }

  /**
   * @deprecated globalSessionManager.enrichLogData()를 사용하세요
   */
  enrichLogData(data: Record<string, unknown>): Record<string, unknown> {
    return {
      ...data,
      sessionId: this.sessionId,
      clientType: this.clientType,
      userId: this.userId,
      capabilities: this.capabilities,
    };
  }
}

import { globalSessionManager } from "./session-manager.js";

/**
 * MCP 도구 실행 로깅 헬퍼
 */
export class McpToolLogger {
  constructor(private sessionContext?: McpSessionContext) {}

  async logToolExecution<T>(
    toolName: string,
    args: Record<string, unknown>,
    execution: () => Promise<T>
  ): Promise<T> {
    const sessionData = globalSessionManager.enrichLogData({});
    const spanId = logger.startOperation("mcp.tool.execution", {
      toolName,
      argumentCount: Object.keys(args).length,
      ...sessionData,
    });

    logger.info(
      `Executing tool: ${toolName}`,
      "tools",
      globalSessionManager.enrichLogData({ toolName, args })
    );

    const startTime = Date.now();

    try {
      const result = await execution();
      const duration = Date.now() - startTime;

      logger.endOperation(spanId, {
        success: true,
        duration,
        toolName,
        resultType: typeof result,
      });

      logger.info(
        `Tool execution completed: ${toolName}`,
        "tools",
        globalSessionManager.enrichLogData({
          toolName,
          duration,
          success: true,
        })
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.endOperation(spanId, {
        success: false,
        duration,
        toolName,
        error: error instanceof Error ? error.message : String(error),
      });

      logger.error(
        `Tool execution failed: ${toolName}`,
        "tools",
        globalSessionManager.enrichLogData({
          toolName,
          duration,
          error: error instanceof Error ? error.message : String(error),
        })
      );

      throw error;
    }
  }

  logToolValidation(
    toolName: string,
    args: Record<string, unknown>,
    validationResult: { isValid: boolean; errors?: string[] }
  ): void {
    const logData = globalSessionManager.enrichLogData({
      toolName,
      argumentCount: Object.keys(args).length,
      isValid: validationResult.isValid,
      errors: validationResult.errors,
    });

    if (validationResult.isValid) {
      logger.debug(`Tool validation passed: ${toolName}`, "tools", logData);
    } else {
      logger.warning(`Tool validation failed: ${toolName}`, "tools", logData);
    }
  }
}

/**
 * MCP 리소스 접근 로깅 헬퍼
 */
export class McpResourceLogger {
  constructor(private sessionContext?: McpSessionContext) {}

  async logResourceAccess<T>(
    resourceUri: string,
    operation: "read" | "list" | "subscribe",
    execution: () => Promise<T>
  ): Promise<T> {
    const spanId = logger.startOperation("mcp.resource.access", {
      resourceUri,
      operation,
      ...globalSessionManager.enrichLogData({}),
    });

    logger.debug(
      `Accessing resource: ${resourceUri} (${operation})`,
      "resources",
      globalSessionManager.enrichLogData({ resourceUri, operation })
    );

    const startTime = Date.now();

    try {
      const result = await execution();
      const duration = Date.now() - startTime;

      logger.endOperation(spanId, {
        success: true,
        duration,
        resourceUri,
        operation,
        resultType: typeof result,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.endOperation(spanId, {
        success: false,
        duration,
        resourceUri,
        operation,
        error: error instanceof Error ? error.message : String(error),
      });

      logger.error(
        `Resource access failed: ${resourceUri}`,
        "resources",
        globalSessionManager.enrichLogData({
          resourceUri,
          operation,
          duration,
          error: error instanceof Error ? error.message : String(error),
        })
      );

      throw error;
    }
  }

  logResourcePermissionCheck(
    resourceUri: string,
    hasPermission: boolean,
    requiredPermissions: string[]
  ): void {
    const logData = globalSessionManager.enrichLogData({
      resourceUri,
      hasPermission,
      requiredPermissions,
    });

    if (hasPermission) {
      logger.debug(`Resource access granted: ${resourceUri}`, "resources", logData);
    } else {
      logger.warning(`Resource access denied: ${resourceUri}`, "resources", logData);
    }
  }
}

/**
 * MCP 인증/권한 로깅 헬퍼
 */
export class McpAuthLogger {
  logAuthAttempt(
    method: "api-key" | "oauth" | "basic" | "none",
    success: boolean,
    clientId?: string,
    additionalInfo?: Record<string, unknown>
  ): void {
    const logData = {
      authMethod: method,
      success,
      clientId,
      timestamp: new Date().toISOString(),
      ...additionalInfo,
    };

    if (success) {
      logger.info(`Authentication successful: ${method}`, "auth", logData);
    } else {
      logger.warning(`Authentication failed: ${method}`, "auth", logData);
    }
  }

  logPermissionCheck(
    resource: string,
    action: string,
    granted: boolean,
    clientId?: string,
    reason?: string
  ): void {
    const logData = {
      resource,
      action,
      granted,
      clientId,
      reason,
      timestamp: new Date().toISOString(),
    };

    if (granted) {
      logger.debug(`Permission granted: ${action} on ${resource}`, "auth", logData);
    } else {
      logger.warning(`Permission denied: ${action} on ${resource}`, "auth", logData);
    }
  }

  logRateLimitEvent(
    type: "warning" | "exceeded" | "reset",
    clientId: string,
    endpoint: string,
    currentCount: number,
    limit: number
  ): void {
    const logData = {
      type,
      clientId,
      endpoint,
      currentCount,
      limit,
      timestamp: new Date().toISOString(),
    };

    switch (type) {
      case "warning":
        logger.warning(`Rate limit warning: ${endpoint}`, "auth", logData);
        break;
      case "exceeded":
        logger.error(`Rate limit exceeded: ${endpoint}`, "auth", logData);
        break;
      case "reset":
        logger.debug(`Rate limit reset: ${endpoint}`, "auth", logData);
        break;
    }
  }
}

/**
 * MCP 전송 프로토콜 로깅 헬퍼
 */
export class McpTransportLogger {
  logConnectionEvent(
    type: "connect" | "disconnect" | "error",
    transport: "stdio" | "http" | "websocket",
    clientInfo?: Record<string, unknown>
  ): void {
    const logData = {
      type,
      transport,
      clientInfo,
      timestamp: new Date().toISOString(),
    };

    switch (type) {
      case "connect":
        logger.info(`Client connected via ${transport}`, "transport", logData);
        break;
      case "disconnect":
        logger.info(`Client disconnected from ${transport}`, "transport", logData);
        break;
      case "error":
        logger.error(`Transport error on ${transport}`, "transport", logData);
        break;
    }
  }

  logRequestProcessing(
    method: string,
    requestId: string,
    processingTimeMs: number,
    success: boolean,
    transport: string
  ): void {
    const logData = {
      method,
      requestId,
      processingTimeMs,
      success,
      transport,
      timestamp: new Date().toISOString(),
    };

    logger.info(
      `Request processed: ${method} (${processingTimeMs}ms)`,
      "transport",
      logData
    );
  }
}

/**
 * 편의 함수들
 */

/**
 * 간단한 MCP 작업 로깅
 */
export async function logMcpTask<T>(
  taskName: string,
  task: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const spanId = logger.startOperation(`mcp.task.${taskName}`, context);
  const startTime = Date.now();

  try {
    const result = await task();
    const duration = Date.now() - startTime;

    logger.endOperation(spanId, {
      success: true,
      duration,
      taskName,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.endOperation(spanId, {
      success: false,
      duration,
      taskName,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * 조건부 로깅 (개발 환경에서만)
 */
export function debugLog(
  message: string,
  category: string = "debug",
  data?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "development") {
    logger.debug(message, category, data);
  }
}

/**
 * 성능 임계값 기반 로깅
 */
export async function logSlowOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  thresholdMs: number = 1000
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    if (duration > thresholdMs) {
      logger.warning(
        `Slow operation detected: ${operationName}`,
        "performance",
        { operationName, duration, threshold: thresholdMs }
      );
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error(
      `Failed operation: ${operationName}`,
      "performance",
      { 
        operationName, 
        duration, 
        error: error instanceof Error ? error.message : String(error) 
      }
    );

    throw error;
  }
}