/**
 * MCP 핑 시스템 추상화 패턴
 * 
 * 연결성 테스트, 헬스체크, 상태 모니터링을 위한
 * 고수준 핑 패턴과 유틸리티를 제공합니다.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EmptyResult } from "../../spec/current_spec.js";
import { logger } from "../logger.js";

/**
 * 헬스체크 상태
 */
export enum HealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
}

/**
 * 헬스체크 결과
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  responseTimeMs: number;
  checks: Record<string, {
    status: HealthStatus;
    message?: string;
    data?: Record<string, unknown>;
  }>;
  metadata: {
    serverTime: string;
    uptime: number;
    version?: string;
    environment?: string;
  };
}

/**
 * 개별 헬스체크 인터페이스
 */
export interface HealthChecker {
  name: string;
  timeout?: number;
  
  /**
   * 헬스체크 실행
   */
  check(): Promise<{
    status: HealthStatus;
    message?: string;
    data?: Record<string, unknown>;
  }>;
}

/**
 * 기본 헬스체크 구현들
 */
export class MemoryHealthChecker implements HealthChecker {
  name = "memory";
  timeout = 1000;

  async check() {
    const memoryUsage = process.memoryUsage();
    const totalMB = Math.round(memoryUsage.rss / 1024 / 1024);
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    let status: HealthStatus;
    if (heapUsagePercent < 70) {
      status = HealthStatus.HEALTHY;
    } else if (heapUsagePercent < 90) {
      status = HealthStatus.DEGRADED;
    } else {
      status = HealthStatus.UNHEALTHY;
    }

    return {
      status,
      message: `Memory usage: ${heapUsagePercent.toFixed(1)}%`,
      data: {
        totalMB,
        heapUsedMB,
        heapTotalMB,
        heapUsagePercent,
      },
    };
  }
}

export class CpuHealthChecker implements HealthChecker {
  name = "cpu";
  timeout = 2000;

  async check() {
    const startUsage = process.cpuUsage();
    
    // 100ms 대기 후 CPU 사용량 측정
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const endUsage = process.cpuUsage(startUsage);
    const totalUsage = endUsage.user + endUsage.system;
    const cpuPercent = (totalUsage / 100000) * 100; // 마이크로초를 퍼센트로 변환

    let status: HealthStatus;
    if (cpuPercent < 70) {
      status = HealthStatus.HEALTHY;
    } else if (cpuPercent < 90) {
      status = HealthStatus.DEGRADED;
    } else {
      status = HealthStatus.UNHEALTHY;
    }

    return {
      status,
      message: `CPU usage: ${cpuPercent.toFixed(1)}%`,
      data: {
        cpuPercent,
        userTime: endUsage.user,
        systemTime: endUsage.system,
      },
    };
  }
}

export class UptimeHealthChecker implements HealthChecker {
  name = "uptime";
  timeout = 500;

  async check() {
    const uptimeSeconds = process.uptime();
    const uptimeHours = uptimeSeconds / 3600;

    // 업타임이 24시간 이상이면 HEALTHY, 1시간 미만이면 DEGRADED
    let status: HealthStatus;
    if (uptimeHours >= 24) {
      status = HealthStatus.HEALTHY;
    } else if (uptimeHours >= 1) {
      status = HealthStatus.DEGRADED;
    } else {
      status = HealthStatus.DEGRADED;
    }

    return {
      status,
      message: `Uptime: ${uptimeHours.toFixed(1)} hours`,
      data: {
        uptimeSeconds,
        uptimeHours,
        startTime: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
      },
    };
  }
}

/**
 * 종합 헬스체크 매니저
 */
export class McpHealthManager {
  private checkers: HealthChecker[] = [];
  private lastResult: HealthCheckResult | null = null;
  private lastCheckTime = 0;
  private cacheTtl = 5000; // 5초 캐시

  constructor(
    private version?: string,
    private environment?: string
  ) {
    // 기본 헬스체크들 등록
    this.addChecker(new MemoryHealthChecker());
    this.addChecker(new CpuHealthChecker());
    this.addChecker(new UptimeHealthChecker());
  }

  addChecker(checker: HealthChecker): void {
    this.checkers.push(checker);
  }

  removeChecker(name: string): void {
    this.checkers = this.checkers.filter(c => c.name !== name);
  }

  /**
   * 전체 헬스체크 실행
   */
  async performHealthCheck(useCache: boolean = true): Promise<HealthCheckResult> {
    const now = Date.now();

    // 캐시된 결과 반환 (필요시)
    if (useCache && this.lastResult && (now - this.lastCheckTime) < this.cacheTtl) {
      return this.lastResult;
    }

    const startTime = now;
    const checks: Record<string, any> = {};
    let overallStatus = HealthStatus.HEALTHY;

    // 모든 헬스체크 병렬 실행
    const checkPromises = this.checkers.map(async (checker) => {
      try {
        const checkResult = await Promise.race([
          checker.check(),
          this.timeoutPromise(checker.timeout || 5000),
        ]);

        checks[checker.name] = checkResult;

        // 전체 상태 결정
        if (checkResult.status === HealthStatus.UNHEALTHY) {
          overallStatus = HealthStatus.UNHEALTHY;
        } else if (checkResult.status === HealthStatus.DEGRADED && overallStatus === HealthStatus.HEALTHY) {
          overallStatus = HealthStatus.DEGRADED;
        }

      } catch (error) {
        checks[checker.name] = {
          status: HealthStatus.UNHEALTHY,
          message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        };
        overallStatus = HealthStatus.UNHEALTHY;
      }
    });

    await Promise.all(checkPromises);

    const responseTimeMs = Date.now() - startTime;

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTimeMs,
      checks,
      metadata: {
        serverTime: new Date().toISOString(),
        uptime: process.uptime(),
        version: this.version,
        environment: this.environment,
      },
    };

    // 캐시 업데이트
    this.lastResult = result;
    this.lastCheckTime = now;

    return result;
  }

  private async timeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout after ${timeoutMs}ms`)), timeoutMs);
    });
  }

  /**
   * 간단한 상태 확인
   */
  async isHealthy(): Promise<boolean> {
    const result = await this.performHealthCheck();
    return result.status === HealthStatus.HEALTHY;
  }

  /**
   * 상태 요약 가져오기
   */
  async getStatusSummary(): Promise<{
    status: HealthStatus;
    message: string;
    uptime: number;
  }> {
    const result = await this.performHealthCheck();
    
    const unhealthyChecks = Object.entries(result.checks)
      .filter(([_, check]) => check.status === HealthStatus.UNHEALTHY)
      .map(([name]) => name);

    const degradedChecks = Object.entries(result.checks)
      .filter(([_, check]) => check.status === HealthStatus.DEGRADED)
      .map(([name]) => name);

    let message: string;
    if (unhealthyChecks.length > 0) {
      message = `Unhealthy components: ${unhealthyChecks.join(', ')}`;
    } else if (degradedChecks.length > 0) {
      message = `Degraded components: ${degradedChecks.join(', ')}`;
    } else {
      message = "All systems operational";
    }

    return {
      status: result.status,
      message,
      uptime: result.metadata.uptime,
    };
  }
}

/**
 * 고수준 MCP 핑 응답 생성기
 */
export class McpPingResponseBuilder {
  constructor(
    private healthManager: McpHealthManager,
    private includeHealthDetails: boolean = false
  ) {}

  /**
   * 표준 MCP 핑 응답 생성
   */
  async buildPingResponse(requestId: string): Promise<EmptyResult> {
    const startTime = Date.now();

    try {
      let healthData: any = {};

      if (this.includeHealthDetails) {
        const healthResult = await this.healthManager.performHealthCheck();
        healthData = {
          health: {
            status: healthResult.status,
            checks: Object.keys(healthResult.checks).length,
            responseTime: healthResult.responseTimeMs,
          },
        };
      }

      const responseTime = Date.now() - startTime;

      return {
        _meta: {
          serverTime: new Date().toISOString(),
          status: "ok",
          uptime: process.uptime(),
          responseTimeMs: responseTime,
          requestId,
          ...healthData,
        },
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        _meta: {
          serverTime: new Date().toISOString(),
          status: "error",
          uptime: process.uptime(),
          responseTimeMs: responseTime,
          requestId,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * 상세 헬스체크 응답 생성
   */
  async buildHealthResponse(): Promise<HealthCheckResult> {
    return this.healthManager.performHealthCheck();
  }
}

/**
 * 핑 응답 시간 추적기
 */
export class PingMetricsTracker {
  private responseTimeHistory: number[] = [];
  private errorCount = 0;
  private totalRequests = 0;
  private lastResetTime = Date.now();

  recordPing(responseTimeMs: number, isError: boolean = false): void {
    this.totalRequests++;
    this.responseTimeHistory.push(responseTimeMs);

    if (isError) {
      this.errorCount++;
    }

    // 최근 100개만 유지
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory.shift();
    }
  }

  getMetrics(): {
    totalRequests: number;
    errorCount: number;
    errorRate: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    last10Average: number;
    uptimeHours: number;
  } {
    const averageResponseTime = this.responseTimeHistory.length > 0
      ? this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length
      : 0;

    const last10 = this.responseTimeHistory.slice(-10);
    const last10Average = last10.length > 0
      ? last10.reduce((a, b) => a + b, 0) / last10.length
      : 0;

    return {
      totalRequests: this.totalRequests,
      errorCount: this.errorCount,
      errorRate: this.totalRequests > 0 ? (this.errorCount / this.totalRequests) * 100 : 0,
      averageResponseTime,
      minResponseTime: Math.min(...this.responseTimeHistory),
      maxResponseTime: Math.max(...this.responseTimeHistory),
      last10Average,
      uptimeHours: (Date.now() - this.lastResetTime) / (1000 * 60 * 60),
    };
  }

  reset(): void {
    this.responseTimeHistory = [];
    this.errorCount = 0;
    this.totalRequests = 0;
    this.lastResetTime = Date.now();
  }
}

/**
 * 전역 핑 메트릭 추적기
 */
export const globalPingTracker = new PingMetricsTracker();

/**
 * 핑 엔드포인트 데코레이터
 */
export function McpPing(healthManager?: McpHealthManager, includeHealth: boolean = false) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (request: any, extra: any) {
      const startTime = Date.now();
      let isError = false;

      try {
        if (healthManager) {
          const responseBuilder = new McpPingResponseBuilder(healthManager, includeHealth);
          const result = await responseBuilder.buildPingResponse(extra.requestId);
          
          const responseTime = Date.now() - startTime;
          globalPingTracker.recordPing(responseTime, false);
          
          return result;
        }

        // 기본 ping 처리
        const result = await originalMethod.apply(this, [request, extra]);
        const responseTime = Date.now() - startTime;
        globalPingTracker.recordPing(responseTime, false);
        
        return result;

      } catch (error) {
        isError = true;
        const responseTime = Date.now() - startTime;
        globalPingTracker.recordPing(responseTime, true);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 편의 함수들
 */

/**
 * 간단한 헬스체크 실행
 */
export async function quickHealthCheck(): Promise<{
  isHealthy: boolean;
  uptime: number;
  memoryUsage: number;
}> {
  const healthManager = new McpHealthManager();
  const result = await healthManager.performHealthCheck();

  return {
    isHealthy: result.status === HealthStatus.HEALTHY,
    uptime: result.metadata.uptime,
    memoryUsage: result.checks.memory?.data?.heapUsagePercent || 0,
  };
}

/**
 * 커스텀 헬스체커 생성 헬퍼
 */
export function createCustomHealthChecker(
  name: string,
  checkFn: () => Promise<{ status: HealthStatus; message?: string; data?: any }>,
  timeout: number = 5000
): HealthChecker {
  return {
    name,
    timeout,
    check: checkFn,
  };
}

/**
 * 데이터베이스 연결 헬스체커 예시
 */
export function createDatabaseHealthChecker(
  name: string = "database",
  pingFn: () => Promise<boolean>
): HealthChecker {
  return createCustomHealthChecker(
    name,
    async () => {
      try {
        const isConnected = await pingFn();
        return {
          status: isConnected ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
          message: isConnected ? "Database connection healthy" : "Database connection failed",
          data: { connected: isConnected },
        };
      } catch (error) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `Database error: ${error instanceof Error ? error.message : String(error)}`,
          data: { connected: false, error: String(error) },
        };
      }
    },
    3000
  );
}

/**
 * 외부 서비스 헬스체커 예시
 */
export function createExternalServiceHealthChecker(
  name: string,
  serviceUrl: string,
  timeout: number = 5000
): HealthChecker {
  return createCustomHealthChecker(
    name,
    async () => {
      try {
        const startTime = Date.now();
        const response = await fetch(serviceUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(timeout),
        });
        const responseTime = Date.now() - startTime;

        const isHealthy = response.ok;
        return {
          status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
          message: `${name} service: ${response.status} (${responseTime}ms)`,
          data: {
            url: serviceUrl,
            status: response.status,
            responseTime,
            available: isHealthy,
          },
        };
      } catch (error) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `${name} service unavailable: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            url: serviceUrl,
            available: false,
            error: String(error),
          },
        };
      }
    },
    timeout
  );
}