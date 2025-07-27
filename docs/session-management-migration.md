# 세션 관리 단일 책임 원칙 마이그레이션 가이드

## 개요

기존의 분산된 세션 관리 시스템을 단일 책임 원칙에 따라 중앙화된 `SessionManager`로 통합합니다.

## 문제점

기존 시스템에서는 세션 관리가 여러 곳에 분산되어 있었습니다:

1. **otel-session.ts** - OpenTelemetry용 SessionManager
2. **lifecycle.ts** - SessionLifecycleManager 
3. **logging-utils.ts** - McpSessionContext
4. **abstractions/session-manager.ts** - 새로운 통합 SessionManager

이는 단일 책임 원칙을 위반하며 다음과 같은 문제를 야기합니다:
- 세션 정보의 불일치
- 중복된 세션 관리 로직
- 복잡한 의존성 관계
- 유지보수의 어려움

## 해결책: 중앙화된 SessionManager

### 1. 통합 SessionManager 구조

```typescript
// standard/abstractions/session-manager.ts
export class SessionManager {
  // 모든 세션 관리를 담당하는 단일 클래스
  createSession(clientType: string, userId?: string, capabilities?: string[]): string
  activateSession(sessionId: string): boolean
  updateSession(sessionId: string, updates: Partial<SessionInfo>): boolean
  terminateSession(sessionId: string, reason?: string): boolean
  // ... 기타 세션 관리 메서드
}

export const globalSessionManager = new SessionManager();
```

### 2. Lifecycle 어댑터 패턴

기존 코드와의 호환성을 위해 어댑터 패턴을 사용합니다:

```typescript
// standard/abstractions/lifecycle-adapter.ts
export class SessionLifecycleAdapter {
  constructor(sessionId: string) {
    // 중앙 SessionManager에 위임
    this.sessionId = sessionId;
  }
  
  // 기존 인터페이스를 유지하면서 내부적으로 globalSessionManager 사용
  getState(): LifecycleState {
    const session = globalSessionManager.getSession(this.sessionId);
    return session?.lifecycleState || LifecycleState.UNINITIALIZED;
  }
}
```

## 마이그레이션 단계

### 1단계: 새로운 SessionManager 사용

**Before:**
```typescript
import { McpSessionContext } from "../logging-utils.js";

const sessionContext = new McpSessionContext(sessionId, clientType, userId);
sessionContext.activate();
```

**After:**
```typescript
import { globalSessionManager, createAndActivateSession } from "../abstractions/session-manager.js";

const sessionId = createAndActivateSession(clientType, userId, capabilities);
```

### 2단계: Lifecycle 관리 업데이트

**Before:**
```typescript
import { SessionLifecycleManager } from "../lifecycle.js";

const lifecycleManager = new SessionLifecycleManager(sessionId);
lifecycleManager.initialize(server, serverInfo);
```

**After:**
```typescript
import { SessionLifecycleAdapter } from "../abstractions/lifecycle-adapter.js";

const lifecycleAdapter = new SessionLifecycleAdapter(sessionId);
lifecycleAdapter.initialize(server, serverInfo);
```

### 3단계: 로깅 시스템 업데이트

**Before:**
```typescript
const toolLogger = new McpToolLogger(sessionContext);
```

**After:**
```typescript
const toolLogger = new McpToolLogger(); // 내부적으로 globalSessionManager 사용
```

## 주요 변경사항

### 1. 세션 생성 및 활성화

```typescript
// 새로운 방식
const sessionId = globalSessionManager.createSession("claude", "user_123", ["tools"]);
globalSessionManager.activateSession(sessionId);

// 또는 편의 함수 사용
const sessionId = createAndActivateSession("claude", "user_123", ["tools"]);
```

### 2. 세션 정보 조회

```typescript
// 현재 활성 세션
const activeSession = globalSessionManager.getActiveSession();

// 특정 세션
const session = globalSessionManager.getSession(sessionId);

// 모든 세션
const allSessions = globalSessionManager.getAllSessions();
```

### 3. 세션 이벤트 처리

```typescript
// 세션 이벤트 구독
const unsubscribe = globalSessionManager.onSessionEvent((event) => {
  switch (event.type) {
    case "created":
      console.log(`세션 생성: ${event.sessionId}`);
      break;
    case "terminated":
      console.log(`세션 종료: ${event.sessionId}`);
      break;
  }
});
```

### 4. 세션별 작업 실행

```typescript
// 특정 세션 컨텍스트에서 작업 실행
await withSession(sessionId, async () => {
  // 이 블록 내에서는 지정된 세션이 활성화됨
  await executeMcpTask("task_name", async () => {
    // 작업 실행
  });
});
```

## 호환성 유지

### 1. McpSessionContext (Deprecated)

기존 코드와의 호환성을 위해 McpSessionContext는 유지되지만 deprecated로 표시됩니다:

```typescript
// @deprecated - globalSessionManager 사용을 권장
export class McpSessionContext {
  activate(): void {
    // 내부적으로 globalSessionManager 호출
    logger.setSessionContext(this.sessionId);
  }
}
```

### 2. 별칭 제공

```typescript
// 기존 이름으로도 사용 가능
export const SessionLifecycleManager = SessionLifecycleAdapter;
export const SessionLifecycleManagerFactory = LifecycleAdapterFactory;
```

## 장점

1. **단일 책임 원칙**: 세션 관리가 하나의 클래스에 집중
2. **일관성**: 모든 세션 정보가 중앙에서 관리됨
3. **확장성**: 새로운 세션 기능 추가가 용이
4. **메모리 효율성**: 중복 제거 및 자동 정리 기능
5. **디버깅 용이성**: 세션 이벤트 추적 및 통계 기능

## 주의사항

1. **세션 ID 관리**: 세션 ID는 자동 생성되므로 직접 생성하지 마세요
2. **메모리 정리**: 장시간 비활성 세션은 자동으로 정리됩니다
3. **이벤트 핸들러**: 메모리 누수 방지를 위해 unsubscribe를 호출하세요
4. **에러 처리**: 세션이 존재하지 않을 경우를 항상 처리하세요

## 테스트 방법

```typescript
// 세션 관리 테스트
describe("Centralized Session Management", () => {
  it("should create and manage sessions centrally", async () => {
    // 세션 생성
    const sessionId = createAndActivateSession("test-client", "test-user");
    
    // 세션 조회
    const session = globalSessionManager.getSession(sessionId);
    expect(session).toBeDefined();
    expect(session.clientType).toBe("test-client");
    
    // 세션 업데이트
    globalSessionManager.updateSession(sessionId, { 
      capabilities: ["tools", "resources"] 
    });
    
    // 세션 종료
    globalSessionManager.terminateSession(sessionId, "test complete");
  });
});
```

## 결론

중앙화된 SessionManager를 통해 세션 관리의 복잡성을 줄이고, 코드의 유지보수성을 향상시킬 수 있습니다. 단일 책임 원칙을 따르는 이 접근법은 더 나은 아키텍처와 확장성을 제공합니다.