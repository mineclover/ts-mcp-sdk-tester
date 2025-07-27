# MCP 추상화 시스템 사용 가이드

## 📋 개요

본 가이드는 MCP 서버의 모든 기능에서 일관되게 사용할 수 있도록 설계된 메모리 효율적 추상화 시스템의 사용법을 제공합니다. 중앙화된 세션 관리, 스트리밍 페이지네이션, 그리고 단순화된 헬스 체크 시스템을 포함합니다.

## 🎯 설계 원칙

### 1. 메모리 효율성 (Memory Efficiency)
- 배치 작업 제거 및 스트리밍 기반 처리
- 프로토콜 테스트에 최적화된 경량 구현
- 자동 리소스 정리 및 가비지 컬렉션

### 2. 단일 책임 원칙 (Single Responsibility)
- 중앙화된 SessionManager로 세션 관리 통합
- 각 컴포넌트의 명확한 역할 분리
- 어댑터 패턴을 통한 호환성 유지

### 3. 단순성 (Simplicity)
- 복잡한 기능 제거 및 핵심 기능에 집중
- 직관적인 API 설계
- 최소한의 설정으로 최대 효과

### 4. 프로토콜 테스트 최적화 (Protocol Testing Optimized)
- 실제 프로덕션 기능 확장이 아닌 프로토콜 테스트에 집중
- 빠른 피드백 루프 지원
- MCP 사양 준수 검증 용이성

## 🔧 1. 중앙화된 세션 관리

### 1.1 세션 생성 및 활성화

```typescript
import { 
  globalSessionManager, 
  createAndActivateSession,
  withSession 
} from "../abstractions/index.js";

// 세션 생성 및 활성화 (원스텝)
const sessionId = createAndActivateSession("claude", "user_123", ["tools", "resources"]);

// 또는 단계별 생성
const newSessionId = globalSessionManager.createSession("claude", "user_123", ["tools"]);
globalSessionManager.activateSession(newSessionId);

// 세션 정보 조회
const session = globalSessionManager.getSession(sessionId);
console.log(session?.clientType); // "claude"
```

### 1.2 세션별 작업 실행

```typescript
import { executeMcpTask, withSession } from "../abstractions/index.js";

// 특정 세션 컨텍스트에서 작업 실행
await withSession(sessionId, async () => {
  await executeMcpTask("process_tools_list", async () => {
    // 작업 실행 - 현재 세션 컨텍스트가 자동으로 설정됨
    return { tools: await getAvailableTools() };
  });
});
```

### 1.3 세션 종료 및 정리

```typescript
// 세션 정리 및 종료
globalSessionManager.terminateSession(sessionId, "User disconnected");

// 현재 활성 세션 정보 조회
const activeSession = globalSessionManager.getActiveSession();
console.log(activeSession?.sessionId);

// 모든 세션 정보 조회
const allSessions = globalSessionManager.getAllSessions();
console.log(`총 ${allSessions.length}개 세션 활성`);
```

## 🔧 2. 스트리밍 페이지네이션 시스템

### 2.1 기본 배열 페이지네이션 (메모리 효율적)

```typescript
import { createArrayPaginator } from "../abstractions/index.js";

async function listResources(request: any, extra: any) {
  const { cursor } = request.params || {};
  
  // 리소스 조회 (메모리 효율적)
  const allResources = await getAllResources();
  
  // 간소화된 페이지네이션 
  const paginator = createArrayPaginator(allResources, {
    defaultPageSize: 10,
    maxPageSize: 50,
  });
  
  return paginator.paginate(cursor);
}
```

### 2.2 스트리밍 데이터 소스 페이지네이션

```typescript
import { StreamingPaginatedDataSource } from "../abstractions/index.js";

async function listLargeDataset(request: any, extra: any) {
  const { cursor } = request.params || {};
  
  // 스트리밍 기반 데이터 소스 (배치 작업 제거)
  const dataSource = new StreamingPaginatedDataSource(
    // 전체 개수 조회 함수
    () => Promise.resolve(getTotalCount()),
    // 페이지별 데이터 조회 함수
    (startIndex, pageSize) => Promise.resolve(
      getDataSlice(startIndex, pageSize)
    )
  );
  
  return dataSource.paginate(cursor, { defaultPageSize: 20 });
}
```

### 2.3 비동기 페이지네이션 (프로토콜 테스트 최적화)

```typescript
import { createAsyncPaginator } from "../abstractions/index.js";

class ResourcesHandler {
  @McpPaginated(
    () => new MemoryPaginatedDataSource(this.getAllResources()),
    { defaultPageSize: 15, maxPageSize: 75 }
  )
  async listResources(request: any, extra: any) {
    // 자동으로 페이지네이션이 적용됨
    // 실제 데이터는 데이터 소스 팩토리에서 제공
  }

  private getAllResources() {
    return [/* 리소스 목록 */];
  }
}
```

### 2.4 캐시가 적용된 페이지네이션

```typescript
import { 
  executeCachedPagination, 
  globalPaginationCache,
  createArrayPaginator 
} from "../abstractions/index.js";

async function listCachedResources(request: any, extra: any) {
  const { cursor } = request.params || {};
  
  const paginator = createArrayPaginator(await getExpensiveData());
  const cacheKey = globalPaginationCache.generateKey(
    "resources/list",
    cursor,
    { filter: request.params?.filter }
  );
  
  return executeCachedPagination(
    paginator,
    globalPaginationCache,
    cacheKey,
    cursor
  );
}
```

### 2.5 필터링과 정렬이 적용된 페이지네이션

```typescript
import { McpPaginator, MemoryPaginatedDataSource } from "../abstractions/index.js";

async function listFilteredAndSortedTools(request: any, extra: any) {
  const { cursor, category, sortBy } = request.params || {};
  
  const dataSource = new MemoryPaginatedDataSource(await getAllTools());
  const paginator = new McpPaginator(dataSource);
  
  // 필터링과 정렬 적용
  return paginator.paginateWithFilterAndSort(
    cursor,
    // 필터 조건
    tool => !category || tool.category === category,
    // 정렬 조건
    (a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    }
  );
}
```

## 🔧 3. 단순화된 헬스체크 시스템

### 3.1 기본 헬스체크 (프로토콜 테스트 최적화)

```typescript
import { quickHealthCheck, globalHealthManager } from "../abstractions/index.js";

async function pingEndpoint(request: any, extra: any) {
  // 간단한 헬스체크 (기본 메트릭만)
  const healthStatus = await quickHealthCheck();
  
  return {
    content: [
      {
        type: "text",
        text: `Server is ${healthStatus.status}. Uptime: ${healthStatus.uptime}s`,
      },
    ],
  };
}
```

### 3.2 상세 헬스체크 (필요시에만)

```typescript
import { globalHealthManager } from "../abstractions/index.js";

async function healthEndpoint(request: any, extra: any) {
  // 상세 헬스 정보 (메모리 사용량 등)
  const detailedStatus = globalHealthManager.getStatusSummary();
  
  return {
    status: detailedStatus.status,
    uptime: detailedStatus.uptime,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  };
}
```

### 3.3 커스텀 헬스체커 (경량화)

```typescript
import { createCustomHealthChecker, globalHealthManager } from "../abstractions/index.js";

// 간단한 커스텀 헬스체커
const customChecker = createCustomHealthChecker(
  "protocol-test",
  async () => {
    // 프로토콜 테스트에 필요한 최소한의 체크만
    return {
      status: "healthy",
      message: "Protocol test ready",
    };
  }
);

// 헬스 매니저에 추가
globalHealthManager.addChecker(customChecker);
```

### 3.4 커스텀 헬스체커 추가

```typescript
import { 
  createCustomHealthChecker,
  createDatabaseHealthChecker,
  createExternalServiceHealthChecker,
  globalHealthManager 
} from "../abstractions/index.js";

// 데이터베이스 헬스체커
const dbChecker = createDatabaseHealthChecker(
  "main_database",
  async () => {
    try {
      await database.ping();
      return true;
    } catch {
      return false;
    }
  }
);

// 외부 서비스 헬스체커
const apiChecker = createExternalServiceHealthChecker(
  "external_api",
  "https://api.external-service.com/health",
  3000
);

// 커스텀 헬스체커
const customChecker = createCustomHealthChecker(
  "custom_check",
  async () => {
    const isReady = await checkCustomCondition();
    return {
      status: isReady ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
      message: `Custom condition: ${isReady ? "ready" : "not ready"}`,
      data: { ready: isReady },
    };
  },
  2000
);

// 헬스 매니저에 추가
globalHealthManager.addChecker(dbChecker);
globalHealthManager.addChecker(apiChecker);
globalHealthManager.addChecker(customChecker);
```

## 🔧 4. 통합 사용 패턴

### 4.1 McpEndpointBase 상속

```typescript
import { McpEndpointBase, createMcpSession } from "../abstractions/index.js";

class ToolsEndpoint extends McpEndpointBase {
  constructor() {
    const session = createMcpSession("claude", "user_123", ["tools"]);
    super(session);
  }

  async listTools(request: any, extra: any) {
    const context = this.createEndpointContext("tools/list", extra.requestId, "tools");
    
    return executeMcpEndpoint(
      context,
      async () => {
        // 페이지네이션 적용
        const tools = await getAllTools();
        return this.executePagination(tools, request.params?.cursor);
      },
      request.params
    );
  }

  async callTool(request: any, extra: any) {
    const { name, arguments: args } = request.params;
    
    // 도구 실행 로깅
    return this.executeTool(
      name,
      args,
      async () => {
        // 성능 측정
        return this.measureOperation(
          `tool_execution_${name}`,
          () => actualToolExecution(name, args)
        );
      }
    );
  }
}
```

### 4.2 표준 설정을 사용한 엔드포인트

```typescript
import { 
  createMcpEndpointBase, 
  standardMcpConfig,
  createMcpSession 
} from "../abstractions/index.js";

// 표준 설정으로 엔드포인트 베이스 생성
const endpointBase = createMcpEndpointBase({
  ...standardMcpConfig,
  sessionContext: createMcpSession("vscode", "user_456"),
});

async function resourcesListHandler(request: any, extra: any) {
  // 캐시된 페이지네이션 실행
  const paginator = createArrayPaginator(await getResources());
  const cacheKey = `resources:${JSON.stringify(request.params)}`;
  
  return endpointBase.executeCachedPagination(
    paginator,
    cacheKey,
    request.params?.cursor
  );
}
```

## 📊 5. 성능 모니터링

### 5.1 성능 메트릭 수집

```typescript
import { globalPerformanceTracker, globalPingTracker, globalPaginationTracker } from "../abstractions/index.js";

// 전체 성능 대시보드
function getPerformanceDashboard() {
  return {
    general: globalPerformanceTracker.getMetrics(),
    ping: globalPingTracker.getMetrics(),
    pagination: Object.fromEntries(globalPaginationTracker.getMetrics()),
  };
}

// 특정 작업 성능 측정
await globalPerformanceTracker.measureOperation(
  "complex_calculation",
  async () => {
    return performComplexCalculation();
  }
);
```

### 5.2 느린 작업 감지

```typescript
import { logSlowOperation } from "../abstractions/index.js";

// 1초 이상 걸리는 작업 자동 감지
const result = await logSlowOperation(
  "database_query",
  async () => {
    return database.complexQuery();
  },
  1000 // 1초 임계값
);
```

## 🛠️ 6. 실제 엔드포인트 구현 예시

### 6.1 완전한 Tools 엔드포인트

```typescript
import { 
  McpEndpointBase,
  createMcpSession,
  executeMcpEndpoint,
  createArrayPaginator,
  type McpEndpointContext 
} from "../abstractions/index.js";

export class ModernToolsHandler extends McpEndpointBase {
  constructor() {
    const session = createMcpSession("claude", undefined, ["tools"]);
    super(session);
  }

  async registerEndpoints(server: McpServer) {
    // tools/list 엔드포인트
    server.server.setRequestHandler(
      ListToolsRequestSchema,
      this.listTools.bind(this)
    );

    // tools/call 엔드포인트
    server.server.setRequestHandler(
      CallToolRequestSchema,
      this.callTool.bind(this)
    );
  }

  private async listTools(request: any, extra: any) {
    const context = this.createEndpointContext("tools/list", extra.requestId, "tools");
    
    return executeMcpEndpoint(
      context,
      async () => {
        const allTools = await this.getAllTools();
        return this.executePagination(allTools, request.params?.cursor, {
          defaultPageSize: 10,
          maxPageSize: 50,
        });
      },
      request.params
    );
  }

  private async callTool(request: any, extra: any) {
    const { name, arguments: args } = request.params;
    const context = this.createEndpointContext("tools/call", extra.requestId, "tools");
    
    return executeMcpEndpoint(
      context,
      async () => {
        return this.executeTool(
          name,
          args,
          async () => {
            // 도구 검증
            await this.validateTool(name, args);
            
            // 실제 실행
            return this.measureOperation(
              `tool_${name}`,
              () => this.executeToolLogic(name, args)
            );
          }
        );
      },
      { toolName: name, argumentCount: Object.keys(args).length }
    );
  }

  private async getAllTools() {
    // 도구 목록 조회 로직
    return [
      { name: "calculator", description: "Basic math operations" },
      { name: "weather", description: "Weather information" },
      // ...
    ];
  }

  private async validateTool(name: string, args: any) {
    // 도구 검증 로직
    this.toolLogger.logToolValidation(name, args, { isValid: true });
  }

  private async executeToolLogic(name: string, args: any) {
    // 실제 도구 실행 로직
    switch (name) {
      case "calculator":
        return this.executeCalculator(args);
      case "weather":
        return this.executeWeather(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async executeCalculator(args: any) {
    const { operation, a, b } = args;
    switch (operation) {
      case "add": return { result: a + b };
      case "subtract": return { result: a - b };
      case "multiply": return { result: a * b };
      case "divide": return { result: a / b };
      default: throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private async executeWeather(args: any) {
    // 날씨 API 호출 로직
    return { temperature: 22, condition: "sunny" };
  }
}
```

### 6.2 현대화된 Resources 엔드포인트

```typescript
import { 
  McpEndpointBase,
  createAsyncPaginator,
  executeCachedPagination,
  globalPaginationCache
} from "../abstractions/index.js";

export class ModernResourcesHandler extends McpEndpointBase {
  async listResources(request: any, extra: any) {
    const context = this.createEndpointContext("resources/list", extra.requestId, "resources");
    
    return executeMcpEndpoint(
      context,
      async () => {
        // 비동기 페이지네이션 (대용량 데이터 최적화)
        const paginator = createAsyncPaginator(
          () => this.getResourceCount(),
          (startIndex, pageSize) => this.getResourcesPage(startIndex, pageSize)
        );

        // 캐시된 페이지네이션 실행
        const cacheKey = globalPaginationCache.generateKey(
          "resources/list",
          request.params?.cursor,
          { filter: request.params?.filter }
        );

        return this.executeCachedPagination(paginator, cacheKey, request.params?.cursor);
      },
      request.params
    );
  }

  async readResource(request: any, extra: any) {
    const { uri } = request.params;
    const context = this.createEndpointContext("resources/read", extra.requestId, "resources");
    
    return executeMcpEndpoint(
      context,
      async () => {
        return this.accessResource(
          uri,
          "read",
          async () => {
            return this.measureOperation(
              "resource_read",
              () => this.readResourceContent(uri)
            );
          }
        );
      },
      { resourceUri: uri }
    );
  }

  private async getResourceCount(): Promise<number> {
    // 실제 리소스 개수 조회
    return 1000;
  }

  private async getResourcesPage(startIndex: number, pageSize: number) {
    // 페이지별 리소스 조회
    return Array.from({ length: pageSize }, (_, i) => ({
      uri: `resource://${startIndex + i}`,
      name: `Resource ${startIndex + i}`,
      mimeType: "text/plain",
    }));
  }

  private async readResourceContent(uri: string) {
    // 실제 리소스 내용 읽기
    return {
      contents: [
        {
          type: "text",
          text: `Content of ${uri}`,
        },
      ],
    };
  }
}
```

## 🎯 7. 베스트 프랙티스

### 7.1 세션 관리 (단일 책임 원칙)

```typescript
// ✅ 권장: 중앙화된 SessionManager 사용
const sessionId = globalSessionManager.createSession("claude", "user_123", ["tools"]);
globalSessionManager.activateSession(sessionId);

// ❌ 비권장: 분산된 세션 관리
const sessionManager = new SessionManager();
sessionManager.createSession();
```

### 7.2 메모리 효율적 페이지네이션

```typescript
// ✅ 권장: 스트리밍 기반 페이지네이션
const dataSource = new StreamingPaginatedDataSource(
  () => Promise.resolve(getTotalCount()),
  (start, size) => Promise.resolve(getDataSlice(start, size))
);

// ❌ 비권장: 배치 작업 기반 페이지네이션
const allData = await getAllDataInMemory(); // 메모리 부담
const paginator = createArrayPaginator(allData);
```

### 7.3 Transport 세션 정리

```typescript
// ✅ 권장: 명확한 종료 사유와 함께 정리
globalSessionManager.terminateSession(sessionId, "Transport connection closed");

// ❌ 비권장: 사유 없는 정리
globalSessionManager.terminateSession(sessionId, "");
```

### 7.4 프로토콜 테스트 최적화

```typescript
// ✅ 권장: 경량화된 헬스체크
const healthStatus = await quickHealthCheck();

// ❌ 비권장: 복잡한 헬스체크 (프로토콜 테스트에 불필요)
const detailedStatus = await comprehensiveHealthCheck();
```

## 🚀 8. 마이그레이션 가이드

### 8.1 기존 세션 관리에서 중앙화된 시스템으로

```typescript
// Before: 분산된 세션 관리
import { SessionManager } from "./otel-session.js";
const sessionManager = SessionManager.getInstance();
const sessionId = sessionManager.createSession("claude");

// After: 중앙화된 세션 관리
import { globalSessionManager } from "./abstractions/session-manager.js";
const sessionId = globalSessionManager.createSession("claude", "user_123", ["tools"]);
globalSessionManager.activateSession(sessionId);
```

### 8.2 배치 작업에서 스트리밍으로

```typescript
// Before: 메모리 기반 배치 처리
const allItems = await database.getAll();
const paginated = paginateInMemory(allItems, cursor);

// After: 스트리밍 기반 처리
const dataSource = new StreamingPaginatedDataSource(
  () => database.count(),
  (start, size) => database.getPage(start, size)
);
const result = await dataSource.paginate(cursor);
```

### 8.3 Transport 세션 정리 패턴

```typescript
// Before: 수동 정리
try {
  // transport cleanup
} catch (error) {
  console.error(error);
}

// After: 헬퍼 함수 사용
function cleanupTransportSession(sessionId: string, mcpSessionId: string, reason: string) {
  try {
    globalSessionManager.terminateSession(sessionId, reason);
    logger.debug(`Transport session cleaned up: ${mcpSessionId}`, "transport");
  } catch (error) {
    logger.warning(`Failed to cleanup transport session ${mcpSessionId}: ${error}`, "transport");
  }
}
```

### 8.4 단계별 마이그레이션

1. **1단계**: 중앙화된 SessionManager 도입
2. **2단계**: Transport 시스템 세션 관리 통합
3. **3단계**: 스트리밍 페이지네이션 전환
4. **4단계**: 경량화된 헬스체크 적용
5. **5단계**: 문서 및 API 정리

## 📈 9. 모니터링 및 디버깅

### 9.1 세션 상태 모니터링

```typescript
// 현재 세션 상태 조회
const activeSession = globalSessionManager.getActiveSession();
const allSessions = globalSessionManager.getAllSessions();

console.log(`활성 세션: ${activeSession?.sessionId}`);
console.log(`총 세션 수: ${allSessions.length}`);
```

### 9.2 헬스체크 및 간단한 메트릭

```typescript
// 경량화된 헬스체크 (프로토콜 테스트용)
const healthStatus = await quickHealthCheck();
console.log(`서버 상태: ${healthStatus.status}`);

// 필요시에만 상세 정보
const detailedStatus = globalHealthManager.getStatusSummary();
```

### 9.3 Transport 연결 디버깅

```typescript
// Transport 세션 추적
logger.debug(`Transport session created: ${mcpSessionId}`, "transport");
logger.debug(`Transport session cleaned up: ${mcpSessionId}`, "transport");
```

## 📋 결론

이 메모리 효율적 추상화 시스템을 사용하면:

- **중앙화된 세션 관리**로 단일 책임 원칙 준수
- **스트리밍 페이지네이션**으로 메모리 사용량 최소화
- **프로토콜 테스트 최적화**로 빠른 피드백 루프
- **단순화된 헬스체크**로 오버헤드 감소
- **MCP Transport 사양 준수**를 통한 완전한 호환성

모든 컴포넌트가 프로토콜 테스트 목적에 최적화되어 있으며, 메모리 효율성과 단순성에 중점을 둔 설계입니다.