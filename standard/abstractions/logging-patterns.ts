/**
 * MCP 로깅 시스템 추상화 패턴
 * 
 * 프로토콜 테스트를 위한 메모리 효율적인 로깅 패턴을 제공합니다.
 * 단순하고 가벼운 구조로 설계되었습니다.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../logger.js";

/**
 * MCP 엔드포인트 실행 컨텍스트
 */
export interface McpEndpointContext {
  endpoint: string;
  requestId: string;
  category: string;
  sessionId?: string;
  userId?: string;
  clientType?: string;
}

/**
 * MCP 작업 실행 컨텍스트
 */
export interface McpOperationContext {
  operationName: string;
  parentSpanId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 고수준 MCP 엔드포인트 실행 래퍼
 * 자동으로 로깅 및 추적을 처리합니다.
 */
export async function executeMcpEndpoint<T>(
  context: McpEndpointContext,
  handler: () => Promise<T>,
  inputParams?: Record<string, unknown>
): Promise<T> {
  // 엔드포인트 진입 로깅
  const traceId = await logger.logEndpointEntry(
    context.endpoint,
    context.requestId,
    {
      ...inputParams,
      sessionId: context.sessionId,
      userId: context.userId,
      clientType: context.clientType,
    }
  );

  try {
    // 실제 처리 실행
    const result = await handler();

    // 성공 로깅
    await logger.logMethodExit(
      context.endpoint,
      {
        requestId: context.requestId,
        success: true,
        resultType: typeof result,
      },
      context.category,
      traceId
    );

    return result;
  } catch (error) {
    // 오류 로깅
    await logger.logServerError(
      error instanceof Error ? error : new Error(String(error)),
      `${context.endpoint} endpoint`,
      { 
        requestId: context.requestId,
        sessionId: context.sessionId,
        traceId 
      }
    );
    throw error;
  }
}

/**
 * MCP 작업 단위 실행 래퍼
 * 세부 작업의 추적과 성능 측정을 처리합니다.
 */
export async function executeMcpOperation<T>(
  context: McpOperationContext,
  handler: () => Promise<T>
): Promise<T> {
  const spanId = logger.startOperation(context.operationName, {
    parentSpanId: context.parentSpanId,
    ...context.metadata,
  });

  const startTime = Date.now();

  try {
    const result = await handler();
    const duration = Date.now() - startTime;

    logger.endOperation(spanId, {
      success: true,
      duration,
      resultType: typeof result,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.endOperation(spanId, {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * MCP 엔드포인트 데코레이터
 * 클래스 메서드에 적용하여 자동 로깅을 활성화합니다.
 */
export function McpEndpoint(endpoint: string, category: string = "mcp") {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const [request, extra] = args;
      
      const context: McpEndpointContext = {
        endpoint,
        requestId: extra?.requestId || 'unknown',
        category,
        sessionId: (this as any).sessionId,
        userId: (this as any).userId,
        clientType: (this as any).clientType,
      };

      return executeMcpEndpoint(
        context,
        () => originalMethod.apply(this, args),
        request?.params
      );
    };

    return descriptor;
  };
}

/**
 * MCP 작업 데코레이터
 * 메서드에 적용하여 자동 작업 추적을 활성화합니다.
 */
export function McpOperation(operationName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context: McpOperationContext = {
        operationName,
        metadata: { methodName: propertyKey },
      };

      return executeMcpOperation(
        context,
        () => originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

/**
 * 간단한 작업 추적 헬퍼
 * 프로토콜 테스트용 가벼운 구조
 */
export async function executeMcpTask<T>(
  taskName: string,
  handler: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const spanId = logger.startOperation(taskName, metadata);
  const startTime = Date.now();

  try {
    const result = await handler();
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
 * 가벼운 성능 측정 헬퍼
 * 프로토콜 테스트용 최적화
 */
export async function measureMcpOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    
    // 간단한 로깅만 수행 (메모리 효율적)
    if (duration > 100) { // 100ms 이상만 로깅
      logger.debug(`Slow operation: ${name} (${duration}ms)`, "performance");
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.warning(`Failed operation: ${name} (${duration}ms)`, "performance", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}