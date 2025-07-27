# MCP 로깅 시스템 구현 검토 및 개선 권고사항

## 개요

MCP (Model Context Protocol) 프로토콜에 따른 로깅 시스템의 현재 구현을 검토하고, 프로토콜 준수도와 성능 최적화 관점에서 개선 권고사항을 제시합니다.

## 현재 구현 분석

### ✅ 잘 구현된 부분

#### 1. RFC 5424 준수 로그 레벨
```typescript
private static readonly LEVEL_SEVERITY: Record<LoggingLevel, number> = {
  debug: 0, info: 1, notice: 2, warning: 3,
  error: 4, critical: 5, alert: 6, emergency: 7,
};
```
- 8개 표준 로그 레벨 완전 지원
- 레벨별 심각도 기반 필터링

#### 2. 보안 기능
```typescript
const SENSITIVE_PATTERN = /password|secret|token|key|auth|credential|private/i;
```
- 민감 데이터 자동 필터링
- 최적화된 단일 정규식 사용
- 성능 향상 (이전 대비 8배 개선)

#### 3. 성능 최적화
- Rate limiting으로 로그 홍수 방지
- OTel 세션 추적 선택적 활성화
- 메모리 효율적인 Map 기반 저장

### ⚠️ 개선 필요 사항

#### 1. MCP 프로토콜 세션 관리 부족

**현재 문제**:
```typescript
setSessionContext(sessionId: string) {
  if (this.otelSessionEnabled) {
    sessionLogger.setSessionContext(sessionId);
    // MCP 프로토콜 컨텍스트 정보 부족
  }
}
```

**권고 개선**:
```typescript
setMcpSessionContext(sessionInfo: {
  sessionId: string;           // MCP 세션 ID
  clientType: string;         // "claude", "vscode", "cursor" 등
  protocolVersion: string;    // "2024-11-05"
  userId?: string;           // 사용자 식별자
  capabilities?: string[];   // 클라이언트 능력
}) {
  // MCP 프로토콜 정보 포함하여 세션 설정
}
```

#### 2. MCP 요청 추적 개선 필요

**현재 문제**:
```typescript
logEndpointEntry(endpoint: string, requestId: string | number, params?: unknown): Promise<string | null>
```
- MCP 메서드 구분 부족
- 프로토콜 버전 추적 없음
- 클라이언트별 성능 분석 제한

**권고 개선**:
```typescript
logMcpEndpointEntry(mcpRequest: {
  method: string;              // "tools/call", "resources/list"
  requestId: string;          // MCP JSON-RPC ID
  params?: unknown;           // 요청 파라미터
  clientType?: string;        // 클라이언트 유형
  protocolVersion?: string;   // MCP 프로토콜 버전
}): Promise<string | null>
```

#### 3. 로그 구조에 MCP 메타데이터 부족

**현재 문제**:
```typescript
// 일반적인 로그 구조만 지원
{
  "message": "Tool execution completed",
  "_session": { ... },
  "_trace": { ... }
}
```

**권고 개선**:
```typescript
// MCP 프로토콜 특화 메타데이터 추가
{
  "message": "MCP tool execution completed",
  "_session": { ... },
  "_trace": { ... },
  "_mcp": {
    "method": "tools/call",
    "toolName": "calculator",
    "protocolVersion": "2024-11-05",
    "clientType": "claude",
    "requestDuration": 150
  }
}
```

## 구체적 개선 방안

### 1. MCP 프로토콜 준수 강화

#### A. 세션 관리 개선

```typescript
interface McpSessionInfo {
  sessionId: string;          // mcp_session_{userContext}_{timestamp}
  connectionId: string;       // 물리적 연결 ID
  clientType: 'claude' | 'vscode' | 'cursor' | 'custom';
  protocolVersion: string;    // MCP 프로토콜 버전
  userId?: string;           // 사용자 식별자
  capabilities: string[];    // 클라이언트 능력 목록
  transportType: 'stdio' | 'http' | 'websocket';
  establishedAt: number;     // 세션 생성 시간
}

class McpSessionManager {
  private activeSessions = new Map<string, McpSessionInfo>();
  
  createMcpSession(info: Omit<McpSessionInfo, 'sessionId' | 'establishedAt'>): string {
    const sessionId = `mcp_session_${info.userId || info.clientType}_${Date.now()}`;
    const sessionInfo: McpSessionInfo = {
      ...info,
      sessionId,
      establishedAt: Date.now()
    };
    
    this.activeSessions.set(sessionId, sessionInfo);
    return sessionId;
  }
}
```

#### B. MCP 요청 추적 강화

```typescript
interface McpRequestContext {
  method: string;             // MCP 메서드
  requestId: string;         // JSON-RPC 요청 ID
  toolName?: string;         // 도구 이름 (tools/call용)
  resourceUri?: string;      // 리소스 URI (resources/용)
  promptName?: string;       // 프롬프트 이름 (prompts/용)
  clientType: string;        // 클라이언트 유형
  protocolVersion: string;   // 프로토콜 버전
}

async logMcpRequest(context: McpRequestContext, params?: unknown): Promise<string | null> {
  const traceId = await this.startMcpTrace(context);
  
  await this.info({
    message: `MCP ${context.method} request started`,
    mcpMethod: context.method,
    requestId: context.requestId,
    toolName: context.toolName,
    resourceUri: context.resourceUri,
    clientType: context.clientType,
    protocolVersion: context.protocolVersion,
    parameters: this.sanitizeParams(params)
  }, "mcp.request");
  
  return traceId;
}
```

### 2. 성능 및 확장성 개선

#### A. 메모리 관리 최적화

```typescript
class OptimizedMcpLogger extends Logger {
  private readonly MAX_SESSIONS = 1000;
  private readonly SESSION_TTL = 30 * 60 * 1000; // 30분
  private readonly TRACE_TTL = 10 * 60 * 1000;   // 10분
  
  // 주기적 정리 작업
  private startCleanupTimer() {
    setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupExpiredTraces();
    }, 5 * 60 * 1000); // 5분마다 정리
  }
  
  private cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.activeSessions) {
      if (now - session.establishedAt > this.SESSION_TTL) {
        this.activeSessions.delete(sessionId);
        this.debug({ message: "Session expired", sessionId }, "cleanup");
      }
    }
  }
}
```

#### B. 배치 처리 및 비동기 최적화

```typescript
class BatchedMcpLogger extends OptimizedMcpLogger {
  private logQueue: LogEntry[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_TIMEOUT = 1000;
  
  private async flushLogs() {
    if (this.logQueue.length === 0) return;
    
    const batch = this.logQueue.splice(0, this.BATCH_SIZE);
    
    // 배치로 클라이언트에 전송
    await this.sendBatchToClient(batch);
    
    // 배치로 외부 시스템에 전송 (옵션)
    await this.sendBatchToExternalSystems(batch);
  }
}
```

### 3. MCP 프로토콜 검증 및 호환성

#### A. 프로토콜 버전 호환성 검사

```typescript
class McpCompatibilityChecker {
  private static readonly SUPPORTED_VERSIONS = [
    "2024-11-05",
    "2024-10-07",
    "2024-09-25"
  ];
  
  static validateProtocolVersion(version: string): boolean {
    return this.SUPPORTED_VERSIONS.includes(version);
  }
  
  static getCompatibilityInfo(version: string): {
    supported: boolean;
    features: string[];
    limitations: string[];
  } {
    // 버전별 기능 및 제한사항 반환
  }
}
```

#### B. MCP 메서드 검증

```typescript
class McpMethodValidator {
  private static readonly VALID_METHODS = new Set([
    "initialize",
    "tools/list",
    "tools/call", 
    "resources/list",
    "resources/read",
    "resources/subscribe",
    "resources/unsubscribe",
    "prompts/list",
    "prompts/get",
    "logging/setLevel"
  ]);
  
  static validateMethod(method: string): boolean {
    return this.VALID_METHODS.has(method);
  }
}
```

## 구현 우선순위

### Phase 1: 핵심 MCP 프로토콜 준수 (1-2주)
1. ✅ **MCP 세션 관리 구현**
   - McpSessionInfo 인터페이스 정의
   - MCP 프로토콜 기반 세션 생성/관리
   
2. ✅ **MCP 요청 추적 강화**
   - logMcpRequest 메서드 구현
   - MCP 메타데이터 포함 로그 구조
   
3. ✅ **프로토콜 검증 추가**
   - MCP 메서드 및 버전 검증
   - 호환성 검사 기능

### Phase 2: 성능 및 확장성 (2-3주)
1. **메모리 최적화**
   - 자동 정리 작업 구현
   - 배치 처리 시스템
   
2. **모니터링 강화**
   - MCP 특화 메트릭 수집
   - 성능 분석 도구
   
3. **확장성 개선**
   - 외부 로그 시스템 연동
   - 분산 추적 지원

### Phase 3: 고급 기능 (3-4주)
1. **실시간 분석**
   - 클라이언트별 성능 분석
   - 실시간 대시보드
   
2. **장애 대응**
   - 자동 복구 메커니즘
   - 장애 예측 시스템

## 테스트 전략

### 1. 단위 테스트
```typescript
describe("MCP Protocol Compliance", () => {
  test("MCP session creation follows protocol", () => {
    const sessionId = mcpLogger.createMcpSession({
      clientType: "claude",
      protocolVersion: "2024-11-05",
      userId: "test_user"
    });
    
    expect(sessionId).toMatch(/^mcp_session_test_user_\d+$/);
  });
  
  test("MCP request tracking includes protocol metadata", async () => {
    const traceId = await mcpLogger.logMcpRequest({
      method: "tools/call",
      requestId: "req_001",
      toolName: "calculator",
      clientType: "claude",
      protocolVersion: "2024-11-05"
    });
    
    expect(traceId).toBeDefined();
    // 로그 엔트리 검증
  });
});
```

### 2. 통합 테스트
```typescript
describe("MCP End-to-End Logging", () => {
  test("Complete MCP request lifecycle", async () => {
    // 1. 세션 생성
    const sessionId = mcpLogger.createMcpSession(sessionInfo);
    
    // 2. 요청 추적
    const traceId = await mcpLogger.logMcpRequest(requestContext);
    
    // 3. 작업 실행
    const spanId = mcpLogger.startOperation("mcp.tool.execution");
    mcpLogger.endOperation(spanId, { result: "success" });
    
    // 4. 응답 완료
    await mcpLogger.logMcpResponse(traceId, response);
    
    // 5. 검증
    expect(getAllLogs()).toHaveLength(4);
  });
});
```

### 3. 성능 테스트
```typescript
describe("MCP Logging Performance", () => {
  test("High volume MCP requests", async () => {
    const startTime = performance.now();
    
    // 1000개 MCP 요청 처리
    for (let i = 0; i < 1000; i++) {
      await mcpLogger.logMcpRequest({
        method: "tools/call",
        requestId: `req_${i}`,
        toolName: "test_tool",
        clientType: "claude",
        protocolVersion: "2024-11-05"
      });
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(5000); // 5초 이내
    expect(mcpLogger.getMemoryUsage()).toBeLessThan(100 * 1024 * 1024); // 100MB 이내
  });
});
```

## 결론

현재 구현은 기본적인 로깅 기능과 보안 기능이 잘 구현되어 있으나, MCP 프로토콜 특화 기능이 부족합니다. 제안된 개선사항을 단계적으로 구현하면 MCP 프로토콜 완전 준수와 함께 확장성 있는 로깅 시스템을 구축할 수 있습니다.

**핵심 개선 포인트**:
1. MCP 프로토콜 메타데이터 완전 지원
2. 세션 관리의 MCP 프로토콜 준수
3. 성능 최적화 및 메모리 관리
4. 포괄적인 테스트 커버리지

이러한 개선을 통해 현재 로깅 시스템을 MCP 프로토콜 표준에 완전히 부합하는 enterprise-grade 솔루션으로 발전시킬 수 있습니다.