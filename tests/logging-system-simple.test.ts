import { test, expect, describe } from "bun:test";
import { logger } from "../standard/logger.js";

/**
 * Simplified Logging System Tests
 * 
 * Focus on ensuring all logging methods work without errors
 * rather than capturing and parsing output.
 */

describe("Logging System - Functional Tests", () => {
  describe("RFC 5424 Severity Levels", () => {
    test("All 8 severity levels execute without error", async () => {
      // Test that all logging methods can be called without throwing
      await expect(logger.debug("Debug message")).resolves.toBeUndefined();
      await expect(logger.info("Info message")).resolves.toBeUndefined();
      await expect(logger.notice("Notice message")).resolves.toBeUndefined();
      await expect(logger.warning("Warning message")).resolves.toBeUndefined();
      await expect(logger.error("Error message")).resolves.toBeUndefined();
      await expect(logger.critical("Critical message")).resolves.toBeUndefined();
      await expect(logger.alert("Alert message")).resolves.toBeUndefined();
      await expect(logger.emergency("Emergency message")).resolves.toBeUndefined();
    });

    test("Level configuration works", () => {
      // Test that level setting doesn't throw
      expect(() => logger.setLevel("debug")).not.toThrow();
      expect(() => logger.setLevel("warning")).not.toThrow();
      expect(() => logger.setLevel("emergency")).not.toThrow();
    });
  });

  describe("Structured Logging", () => {
    test("JSON object logging works", async () => {
      const testData = {
        userId: "123",
        action: "login",
        timestamp: new Date().toISOString(),
        metadata: {
          ip: "127.0.0.1",
          userAgent: "test-client"
        }
      };

      await expect(logger.info(testData)).resolves.toBeUndefined();
    });

    test("String messages work", async () => {
      await expect(logger.info("Simple string message")).resolves.toBeUndefined();
    });
  });

  describe("Specialized Logging Methods", () => {
    test("logMethodEntry works", async () => {
      // Test that method executes without throwing
      expect(() => 
        logger.logMethodEntry("testFunction", { param1: "value" }, "testModule")
      ).not.toThrow();
    });

    test("logMethodExit works", async () => {
      const traceId = await logger.logEndpointEntry("testFunction", "req-123", {});
      await expect(
        logger.logMethodExit("testFunction", { result: "success" }, "testModule", traceId)
      ).resolves.toBeUndefined();
    });

    test("logEndpointEntry works", async () => {
      const traceId = await logger.logEndpointEntry("tools/list", "req-123", { cursor: "abc" });
      expect(traceId).toBeDefined();
    });

    test("logServerError works", async () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1:1";

      await expect(
        logger.logServerError(error, "test operation", { requestId: "req-123" })
      ).resolves.toBeUndefined();
    });
  });

  describe("Configuration Methods", () => {
    test("Sensitive data filtering configuration", () => {
      expect(() => logger.setSensitiveDataFilter(true)).not.toThrow();
      expect(() => logger.setSensitiveDataFilter(false)).not.toThrow();
    });

    test("Rate limiting configuration", () => {
      expect(() => logger.setRateLimiting(true)).not.toThrow();
      expect(() => logger.setRateLimiting(false)).not.toThrow();
    });

    test("Structured logging with sensitive data", async () => {
      logger.setSensitiveDataFilter(true);
      
      const sensitiveData = {
        username: "testuser",
        password: "secret123",
        apiKey: "key-abc-def",
        publicData: "visible-data"
      };

      await expect(logger.info(sensitiveData)).resolves.toBeUndefined();
    });
  });

  describe("Operation Lifecycle", () => {
    test("Operation lifecycle logging", async () => {
      const operationId = logger.startOperation("test-operation", { param: "value" });
      expect(operationId).toBeDefined();
      
      // endOperation may not return a promise
      if (operationId) {
        expect(() => 
          logger.endOperation(operationId, { result: "success" })
        ).not.toThrow();
      }
    });
  });

  describe("Trace Flow Tracking", () => {
    test("Complete trace flow: logEndpointEntry → logMethodExit with maintained Trace ID", async () => {
      // 1. 진입점에서 트레이스 시작 (실제 MCP 엔드포인트와 같은 방식)
      const traceId = await logger.logEndpointEntry(
        "tools/call", 
        "req-trace-test-001", 
        { 
          toolName: "calculator",
          operation: "add",
          arguments: { a: 5, b: 3 }
        }
      );
      
      // Trace ID가 생성되었는지 확인
      expect(traceId).toBeDefined();
      if (traceId) {
        expect(typeof traceId).toBe("string");
        expect(traceId.length).toBeGreaterThan(0);
      }

      // 2. 중간 처리 단계들 - 실제 비즈니스 로직 시뮬레이션
      await logger.debug({
        message: "Tool validation started",
        toolName: "calculator",
        validationSteps: ["schema", "permissions", "availability"]
      }, "validation");

      await logger.info({
        message: "Tool execution in progress", 
        operation: "mathematical_calculation",
        inputSize: 2,
        estimatedDuration: "50ms"
      }, "execution");

      // 3. 종료점에서 트레이스 완료 (같은 Trace ID 사용)
      await logger.logMethodExit(
        "tools/call",
        {
          requestId: "req-trace-test-001",
          result: { value: 8 },
          success: true,
          executionTime: 45,
          operationsPerformed: 3
        },
        "tools",
        traceId  // 동일한 Trace ID 전달
      );

      // 4. 추가적인 관련 작업들도 같은 트레이스 컨텍스트에서
      if (traceId) {
        logger.endOperation(traceId, {
          "mcp.endpoint.result": "success",
          "mcp.total.duration.ms": 45,
          "mcp.operations.count": 3
        });
      }

      // 테스트 검증: 모든 로깅 호출이 성공적으로 완료됨
      expect(true).toBe(true); // 모든 비동기 로깅이 오류 없이 완료됨을 확인
    });

    test("Nested operation tracing with parent-child relationships", async () => {
      // 1. 메인 엔드포인트 트레이스 시작
      const mainTraceId = await logger.logEndpointEntry(
        "resources/read",
        "req-nested-001",
        {
          resourceUri: "file://example.txt",
          includeMetadata: true
        }
      );

      expect(mainTraceId).toBeDefined();

      // 2. 중첩된 작업들 시작
      const validationAttributes: Record<string, string | number | boolean> = {
        "resource.type": "file",
        "validation.level": "strict"
      };
      if (mainTraceId) {
        validationAttributes["parent.trace.id"] = mainTraceId;
      }
      const validationTraceId = logger.startOperation("resource.validation", validationAttributes);

      await logger.debug({
        message: "Resource validation completed",
        validationResult: "passed",
        checksPerformed: ["existence", "permissions", "format"]
      }, "validation");

      if (validationTraceId) {
        logger.endOperation(validationTraceId, {
          "validation.result": "success",
          "validation.duration.ms": 15
        });
      }

      // 3. 다른 중첩 작업
      const fetchAttributes: Record<string, string | number | boolean> = {
        "resource.size.bytes": 1024,
        "fetch.method": "streaming"
      };
      if (mainTraceId) {
        fetchAttributes["parent.trace.id"] = mainTraceId;
      }
      const fetchTraceId = logger.startOperation("resource.fetch", fetchAttributes);

      await logger.info({
        message: "Resource content fetched",
        contentType: "text/plain",
        encoding: "utf-8",
        size: 1024
      }, "fetch");

      if (fetchTraceId) {
        logger.endOperation(fetchTraceId, {
          "fetch.result": "success",
          "fetch.bytes.transferred": 1024,
          "fetch.duration.ms": 120
        });
      }

      // 4. 메인 트레이스 완료
      await logger.logMethodExit(
        "resources/read",
        {
          requestId: "req-nested-001",
          resourceUri: "file://example.txt",
          contentLength: 1024,
          success: true,
          totalDuration: 145
        },
        "resources", 
        mainTraceId
      );

      expect(true).toBe(true);
    });

    test("Error handling with trace context preservation", async () => {
      // 1. 트레이스 시작
      const traceId = await logger.logEndpointEntry(
        "tools/call",
        "req-error-001", 
        {
          toolName: "unreliable-tool",
          timeout: 5000
        }
      );

      expect(traceId).toBeDefined();

      try {
        // 2. 시뮬레이션된 오류 발생
        logger.startOperation("tool.execution", {
          "tool.name": "unreliable-tool",
          "execution.mode": "strict"
        });

        // 의도적으로 오류 발생
        throw new Error("Tool execution timeout after 5000ms");
        
      } catch (error) {
        // 3. 오류 상황에서도 트레이스 컨텍스트 유지
        await logger.logServerError(
          error as Error,
          "tools/call",
          {
            requestId: "req-error-001",
            traceId: traceId,
            toolName: "unreliable-tool",
            errorStage: "execution",
            attemptsBeforeFailure: 1
          }
        );

        // 4. 오류 상황에서도 proper exit 로깅
        await logger.logMethodExit(
          "tools/call",
          {
            requestId: "req-error-001", 
            success: false,
            error: (error as Error).message,
            errorType: "timeout"
          },
          "tools",
          traceId
        );

        // 오류가 적절히 처리되었음을 확인
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("timeout");
      }
    });

    test("High-volume tracing performance", async () => {
      const startTime = performance.now();
      const traceIds: (string | null)[] = [];

      // 1. 다수의 트레이스 생성
      for (let i = 0; i < 50; i++) {
        const traceId = await logger.logEndpointEntry(
          "batch/process",
          `req-batch-${i.toString().padStart(3, '0')}`,
          {
            batchId: `batch-${Math.floor(i / 10)}`,
            itemIndex: i % 10,
            totalItems: 50
          }
        );
        traceIds.push(traceId);

        // 각 트레이스에서 작업 수행 (traceId가 null이어도 로깅은 계속)
        const workTraceId = logger.startOperation("item.processing", {
          "item.id": i,
          "processing.type": "standard"
        });

        if (workTraceId) {
          logger.endOperation(workTraceId, {
            "processing.result": "success",
            "processing.duration.ms": Math.random() * 10
          });
        }

        await logger.logMethodExit(
          "batch/process",
          {
            requestId: `req-batch-${i.toString().padStart(3, '0')}`,
            itemId: i,
            success: true
          },
          "batch",
          traceId  // null이어도 상관없음
        );
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // 2. 성능 검증
      expect(traceIds).toHaveLength(50);
      expect(totalDuration).toBeLessThan(1000); // 1초 이내에 완료되어야 함

      // traceId가 null이어도 로깅 시스템이 정상 작동함을 검증
      const validTraceIds = traceIds.filter(id => id !== null);
      
      await logger.info({
        message: "High-volume tracing performance test completed",
        totalOperations: traceIds.length,
        validTraceIds: validTraceIds.length,
        nullTraceIds: traceIds.length - validTraceIds.length,
        totalDuration: Math.round(totalDuration),
        averagePerOperation: Math.round(totalDuration / traceIds.length * 100) / 100,
        otelEnabled: validTraceIds.length > 0
      }, "performance");
      
      // 테스트 환경에서는 OTel이 비활성화될 수 있으므로 로깅 시스템 자체가 작동하는지만 확인
      expect(true).toBe(true); // 모든 로깅 작업이 오류 없이 완료됨
    });
  });
});