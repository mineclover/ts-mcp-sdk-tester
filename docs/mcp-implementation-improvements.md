# MCP 로깅 시스템 구현 개선안

## 현재 구현의 문제점 및 개선 방향

### 🔍 주요 발견 사항

#### 1. MCP 프로토콜 메타데이터 부족
**현재 코드**:
```typescript
async logEndpointEntry(endpoint: string, requestId?: string | number, params?: unknown): Promise<string | null> {
  const traceId = this.startOperation(`mcp.${endpoint}`, {
    'mcp.endpoint': endpoint,
    'mcp.request.id': requestId ? String(requestId) : 'unknown',
    ...this.extractMcpAttributes(endpoint, params),
  });
  
  await this.info(`🔌 ${endpoint} triggered${idStr}${paramInfo}`, "endpoint");
  return traceId;
}
```

**문제점**:
- MCP 클라이언트 유형 정보 누락
- 프로토콜 버전 정보 없음
- 세션 컨텍스트와 요청 간 연결 부족

#### 2. 세션 관리가 OTel에만 의존
**현재 코드**:
```typescript
setSessionContext(sessionId: string) {
  if (this.otelSessionEnabled) {
    sessionLogger.setSessionContext(sessionId);
    // MCP 세션 정보 부족
  }
}
```

**문제점**:
- MCP 프로토콜 레벨 세션 정보 부족
- 클라이언트별 세션 관리 미흡
- 세션과 요청 간 추적 제한적

## 🚀 구체적 개선 방안

### Phase 1: MCP 프로토콜 메타데이터 강화

#### A. MCP 세션 인터페이스 정의

```typescript
// 새로운 MCP 세션 인터페이스
interface McpSessionContext {
  sessionId: string;          // mcp_session_{userContext}_{timestamp}
  connectionId: string;       // 물리적 연결 ID
  clientType: 'claude' | 'vscode' | 'cursor' | 'web' | 'cli';
  clientVersion?: string;     // 클라이언트 버전
  protocolVersion: string;    // MCP 프로토콜 버전 (2024-11-05)
  userId?: string;           // 사용자 식별자
  userAgent?: string;        // User-Agent 정보
  capabilities: string[];    // 클라이언트 지원 기능
  transportType: 'stdio' | 'http' | 'websocket';
  establishedAt: number;     // 세션 생성 시간
  lastActivityAt: number;    // 마지막 활동 시간
  metadata?: Record<string, unknown>; // 추가 메타데이터
}

// MCP 요청 컨텍스트
interface McpRequestContext {
  method: string;            // tools/call, resources/list 등
  requestId: string;         // JSON-RPC 요청 ID
  sessionId: string;         // MCP 세션 ID
  toolName?: string;         // 도구 이름
  resourceUri?: string;      // 리소스 URI
  promptName?: string;       // 프롬프트 이름
  parameters?: unknown;      // 요청 파라미터
  clientType: string;        // 클라이언트 유형
  protocolVersion: string;   // 프로토콜 버전
  startTime: number;         // 요청 시작 시간
}
```

#### B. Logger 클래스 확장

```typescript
export class EnhancedMcpLogger extends Logger {
  private mcpSessions = new Map<string, McpSessionContext>();
  private mcpRequests = new Map<string, McpRequestContext>();
  
  /**
   * MCP 세션 생성 및 등록
   */
  createMcpSession(sessionInfo: Omit<McpSessionContext, 'sessionId' | 'establishedAt' | 'lastActivityAt'>): string {
    const timestamp = Date.now();
    const userContext = sessionInfo.userId || sessionInfo.clientType;
    const sessionId = `mcp_session_${userContext}_${timestamp}`;
    
    const mcpSession: McpSessionContext = {
      ...sessionInfo,
      sessionId,
      establishedAt: timestamp,
      lastActivityAt: timestamp
    };
    
    this.mcpSessions.set(sessionId, mcpSession);
    
    // OTel 세션도 함께 설정
    if (this.otelSessionEnabled) {
      sessionLogger.setSessionContext(sessionId);
    }
    
    this.info({
      message: "MCP session created",
      sessionId,
      clientType: sessionInfo.clientType,
      protocolVersion: sessionInfo.protocolVersion,
      capabilities: sessionInfo.capabilities,
      transportType: sessionInfo.transportType
    }, "mcp.session");
    
    return sessionId;
  }
  
  /**
   * MCP 요청 진입점 로깅 (기존 logEndpointEntry 대체)
   */
  async logMcpRequest(context: McpRequestContext): Promise<string | null> {
    // 세션 활동 시간 업데이트
    const session = this.mcpSessions.get(context.sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
    
    // 요청 컨텍스트 저장
    this.mcpRequests.set(context.requestId, context);
    
    // MCP 특화 트레이스 시작
    const traceId = this.startOperation(`mcp.${context.method}`, {
      'mcp.method': context.method,
      'mcp.request.id': context.requestId,
      'mcp.session.id': context.sessionId,
      'mcp.client.type': context.clientType,
      'mcp.protocol.version': context.protocolVersion,
      'mcp.tool.name': context.toolName,
      'mcp.resource.uri': context.resourceUri,
      'mcp.prompt.name': context.promptName,
      'mcp.request.start_time': context.startTime
    });
    
    // 구조화된 로그 출력
    await this.info({
      message: `MCP ${context.method} request started`,
      mcpMethod: context.method,
      requestId: context.requestId,
      sessionId: context.sessionId,
      toolName: context.toolName,
      resourceUri: context.resourceUri,
      promptName: context.promptName,
      clientType: context.clientType,
      protocolVersion: context.protocolVersion,
      parameters: this.sanitizeParameters(context.parameters),
      traceId
    }, "mcp.request");
    
    return traceId;
  }
  
  /**
   * MCP 응답 완료 로깅 (기존 logMethodExit 강화)
   */
  async logMcpResponse(
    requestId: string,
    result: {
      success: boolean;
      data?: unknown;
      error?: string;
      duration?: number;
      metadata?: Record<string, unknown>;
    },
    traceId?: string | null
  ) {
    const requestContext = this.mcpRequests.get(requestId);
    if (!requestContext) {
      await this.warning({
        message: "MCP response logged without matching request",
        requestId,
        result
      }, "mcp.response");
      return;
    }
    
    const duration = result.duration || (Date.now() - requestContext.startTime);
    
    // 트레이스 종료
    if (traceId) {
      this.endOperation(traceId, {
        'mcp.response.success': result.success,
        'mcp.response.duration_ms': duration,
        'mcp.response.error': result.error || null,
        'mcp.response.data_size': this.getDataSize(result.data)
      });
    }
    
    // 구조화된 응답 로그
    await this.info({
      message: `MCP ${requestContext.method} request completed`,
      mcpMethod: requestContext.method,
      requestId,
      sessionId: requestContext.sessionId,
      success: result.success,
      duration,
      toolName: requestContext.toolName,
      resourceUri: requestContext.resourceUri,
      clientType: requestContext.clientType,
      protocolVersion: requestContext.protocolVersion,
      error: result.error,
      dataSize: this.getDataSize(result.data),
      metadata: result.metadata,
      traceId
    }, "mcp.response");
    
    // 요청 컨텍스트 정리
    this.mcpRequests.delete(requestId);
    
    // 성능 메트릭 수집
    await this.collectMcpMetrics(requestContext, result, duration);
  }
  
  /**
   * MCP 특화 작업 추적
   */
  startMcpOperation(
    operationName: string,
    context: {
      sessionId?: string;
      requestId?: string;
      toolName?: string;
      resourceUri?: string;
      attributes?: Record<string, string | number | boolean>;
    }
  ): string | null {
    const attributes = {
      'mcp.operation': operationName,
      'mcp.session.id': context.sessionId,
      'mcp.request.id': context.requestId,
      'mcp.tool.name': context.toolName,
      'mcp.resource.uri': context.resourceUri,
      ...context.attributes
    };
    
    return this.startOperation(operationName, attributes);
  }
  
  /**
   * 파라미터 무해화 (민감 정보 제거)
   */
  private sanitizeParameters(params: unknown): unknown {
    if (!params) return params;
    
    // 민감 데이터 필터링 적용
    return this.filterSensitiveData(params);
  }
  
  /**
   * 데이터 크기 계산
   */
  private getDataSize(data: unknown): number {
    if (!data) return 0;
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
  
  /**
   * MCP 메트릭 수집
   */
  private async collectMcpMetrics(
    requestContext: McpRequestContext,
    result: { success: boolean; error?: string },
    duration: number
  ) {
    await this.info({
      message: "MCP performance metric",
      metric: "request_duration",
      mcpMethod: requestContext.method,
      clientType: requestContext.clientType,
      protocolVersion: requestContext.protocolVersion,
      toolName: requestContext.toolName,
      success: result.success,
      duration,
      timestamp: Date.now()
    }, "mcp.metrics");
  }
  
  /**
   * MCP 세션 통계
   */
  getMcpSessionStats(): {
    activeSessions: number;
    activeRequests: number;
    sessionsByClient: Record<string, number>;
    averageSessionDuration: number;
  } {
    const now = Date.now();
    const sessions = Array.from(this.mcpSessions.values());
    
    const sessionsByClient: Record<string, number> = {};
    let totalDuration = 0;
    
    for (const session of sessions) {
      sessionsByClient[session.clientType] = (sessionsByClient[session.clientType] || 0) + 1;
      totalDuration += (now - session.establishedAt);
    }
    
    return {
      activeSessions: sessions.length,
      activeRequests: this.mcpRequests.size,
      sessionsByClient,
      averageSessionDuration: sessions.length > 0 ? totalDuration / sessions.length : 0
    };
  }
  
  /**
   * 만료된 세션 정리
   */
  private cleanupExpiredSessions() {
    const now = Date.now();
    const sessionTtl = 30 * 60 * 1000; // 30분
    
    for (const [sessionId, session] of this.mcpSessions) {
      if (now - session.lastActivityAt > sessionTtl) {
        this.mcpSessions.delete(sessionId);
        this.info({
          message: "MCP session expired",
          sessionId,
          clientType: session.clientType,
          duration: now - session.establishedAt
        }, "mcp.session");
      }
    }
  }
}
```

### Phase 2: 사용법 예시

#### A. MCP 서버 초기화 시

```typescript
const mcpLogger = new EnhancedMcpLogger();

// MCP 서버 초기화 후 세션 생성
mcpLogger.initialize(mcpServer);

const sessionId = mcpLogger.createMcpSession({
  connectionId: "conn_12345",
  clientType: "claude",
  clientVersion: "3.5.0",
  protocolVersion: "2024-11-05",
  userId: "user_123",
  userAgent: "Claude/3.5.0",
  capabilities: ["tools", "resources", "prompts"],
  transportType: "stdio",
  metadata: { region: "us-west-2" }
});
```

#### B. MCP 요청 처리 시

```typescript
// tools/call 요청 예시
async function handleToolCall(request: any): Promise<any> {
  const requestContext: McpRequestContext = {
    method: "tools/call",
    requestId: request.id,
    sessionId: getCurrentSessionId(),
    toolName: request.params.name,
    parameters: request.params.arguments,
    clientType: "claude",
    protocolVersion: "2024-11-05",
    startTime: Date.now()
  };
  
  // 요청 시작 로깅
  const traceId = await mcpLogger.logMcpRequest(requestContext);
  
  try {
    // 도구 검증
    const validationSpanId = mcpLogger.startMcpOperation("mcp.tool.validation", {
      sessionId: requestContext.sessionId,
      requestId: requestContext.requestId,
      toolName: requestContext.toolName
    });
    
    const validationResult = await validateTool(request.params);
    mcpLogger.endOperation(validationSpanId, {
      "validation.result": validationResult.success ? "success" : "failure",
      "validation.duration_ms": validationResult.duration
    });
    
    if (!validationResult.success) {
      throw new Error(`Tool validation failed: ${validationResult.error}`);
    }
    
    // 도구 실행
    const executionSpanId = mcpLogger.startMcpOperation("mcp.tool.execution", {
      sessionId: requestContext.sessionId,
      requestId: requestContext.requestId,
      toolName: requestContext.toolName
    });
    
    const result = await executeTool(request.params);
    mcpLogger.endOperation(executionSpanId, {
      "execution.result": "success",
      "execution.duration_ms": result.duration,
      "execution.output_size": mcpLogger.getDataSize(result.data)
    });
    
    // 응답 로깅
    await mcpLogger.logMcpResponse(requestContext.requestId, {
      success: true,
      data: result.data,
      duration: Date.now() - requestContext.startTime,
      metadata: { tool: requestContext.toolName }
    }, traceId);
    
    return result;
    
  } catch (error) {
    // 에러 로깅
    await mcpLogger.logMcpResponse(requestContext.requestId, {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - requestContext.startTime
    }, traceId);
    
    throw error;
  }
}
```

#### C. 성능 모니터링

```typescript
// 주기적 MCP 통계 로깅
setInterval(async () => {
  const stats = mcpLogger.getMcpSessionStats();
  
  await mcpLogger.info({
    message: "MCP system statistics",
    activeSessions: stats.activeSessions,
    activeRequests: stats.activeRequests,
    sessionsByClient: stats.sessionsByClient,
    averageSessionDuration: Math.round(stats.averageSessionDuration / 1000), // 초 단위
    memoryUsage: process.memoryUsage(),
    timestamp: Date.now()
  }, "mcp.stats");
}, 60000); // 1분마다
```

## 🎯 구현 우선순위

### Phase 1 (즉시 구현): 핵심 MCP 메타데이터
1. ✅ `McpSessionContext` 및 `McpRequestContext` 인터페이스 정의
2. ✅ `createMcpSession()` 메서드 구현
3. ✅ `logMcpRequest()` / `logMcpResponse()` 메서드 구현
4. ✅ 기존 테스트 업데이트

### Phase 2 (1주 내): 고급 기능
1. MCP 성능 메트릭 수집 시스템
2. 세션 생명주기 관리
3. 자동 정리 작업
4. 확장된 에러 분류

### Phase 3 (2주 내): 모니터링 및 분석
1. 실시간 대시보드 데이터
2. 클라이언트별 성능 분석
3. 이상 패턴 감지
4. 자동 최적화 제안

## 🧪 테스트 전략

### 단위 테스트
```typescript
describe("Enhanced MCP Logger", () => {
  test("MCP session creation includes all protocol metadata", () => {
    const sessionId = mcpLogger.createMcpSession({
      connectionId: "conn_123",
      clientType: "claude",
      protocolVersion: "2024-11-05",
      userId: "user_123",
      capabilities: ["tools", "resources"],
      transportType: "stdio"
    });
    
    expect(sessionId).toMatch(/^mcp_session_user_123_\d+$/);
    expect(mcpLogger.getMcpSessionStats().activeSessions).toBe(1);
  });
  
  test("MCP request logging captures full context", async () => {
    const traceId = await mcpLogger.logMcpRequest({
      method: "tools/call",
      requestId: "req_001",
      sessionId: "mcp_session_user_123_1234567890",
      toolName: "calculator",
      clientType: "claude",
      protocolVersion: "2024-11-05",
      startTime: Date.now()
    });
    
    expect(traceId).toBeDefined();
    expect(mcpLogger.getMcpSessionStats().activeRequests).toBe(1);
  });
});
```

이러한 개선을 통해 현재 로깅 시스템을 MCP 프로토콜 완전 준수 시스템으로 발전시킬 수 있습니다.