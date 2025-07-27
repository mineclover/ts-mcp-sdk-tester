# MCP 라이프사이클 관리

Model Context Protocol (MCP) 라이프사이클은 서버와 클라이언트 간의 연결 상태를 관리하는 핵심 기능입니다. 이 문서는 MCP 스펙에 따라 구현된 라이프사이클 관리 시스템에 대해 설명합니다.

## 개요

MCP 라이프사이클은 다음 세 단계로 구성됩니다:

1. **초기화 (Initialization)**: 프로토콜 버전 협상 및 기능 교환
2. **운영 (Operation)**: 정상적인 프로토콜 통신
3. **종료 (Shutdown)**: 연결의 정상적인 종료

## 상태 관리

라이프사이클은 다음 상태들을 가집니다:

```typescript
enum LifecycleState {
  UNINITIALIZED = "uninitialized",    // 초기 상태
  INITIALIZING = "initializing",      // 초기화 진행 중
  INITIALIZED = "initialized",        // 초기화 완료
  OPERATING = "operating",            // 정상 운영 중
  SHUTTING_DOWN = "shutting_down",    // 종료 진행 중
  SHUTDOWN = "shutdown"               // 종료 완료
}
```

### 상태 전환 규칙

- `UNINITIALIZED` → `INITIALIZING`: 서버 초기화 시작
- `INITIALIZING` → `INITIALIZED`: 클라이언트 초기화 요청 처리 완료
- `INITIALIZED` → `OPERATING`: `initialized` 알림 전송 후
- `OPERATING` → `SHUTTING_DOWN`: 종료 요청 수신
- `SHUTTING_DOWN` → `SHUTDOWN`: 종료 핸들러 실행 완료

## 기본 라이프사이클 관리

### LifecycleManager

기본 라이프사이클 매니저는 전역 상태를 관리합니다.

```typescript
import { LifecycleManager, LifecycleState } from '../standard/lifecycle.js';

// 라이프사이클 매니저 초기화
const lifecycleManager = new LifecycleManager();

// 서버 초기화
lifecycleManager.initialize(server, serverInfo);

// 클라이언트 초기화 요청 처리
const response = lifecycleManager.handleInitializeRequest(request);

// 서버 종료
await lifecycleManager.shutdown("Graceful shutdown");
```

### 주요 메서드

#### `initialize(server: McpServer, serverInfo: LifecycleInfo)`

서버를 초기화하고 라이프사이클 관리를 시작합니다.

```typescript
const serverInfo = {
  name: "my-mcp-server",
  title: "My MCP Server",
  version: "1.0.0"
};

lifecycleManager.initialize(server, serverInfo);
```

#### `handleInitializeRequest(request: any)`

클라이언트의 초기화 요청을 처리합니다.

```typescript
const request = {
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {
      roots: { listChanged: true }
    },
    clientInfo: {
      name: "TestClient",
      version: "1.0.0"
    }
  }
};

const response = lifecycleManager.handleInitializeRequest(request);
```

#### `shutdown(reason: string)`

서버를 안전하게 종료합니다.

```typescript
await lifecycleManager.shutdown("User requested shutdown");
```

### 이벤트 핸들링

#### 종료 핸들러 등록

```typescript
lifecycleManager.onShutdown(async (reason) => {
  console.log(`Shutting down: ${reason}`);
  
  // 데이터베이스 연결 종료
  await db.close();
  
  // 임시 파일 정리
  await cleanupTempFiles();
  
  // 로그 기록
  logger.info("Server shutdown completed");
});
```

#### 상태 변경 모니터링

```typescript
lifecycleManager.onStateChange((oldState, newState) => {
  console.log(`State changed: ${oldState} -> ${newState}`);
  
  // 상태별 특별한 처리
  if (newState === LifecycleState.OPERATING) {
    startHealthCheck();
  } else if (newState === LifecycleState.SHUTDOWN) {
    stopHealthCheck();
  }
});
```

## 세션 격리 지원

다중 사용자 환경에서 각 세션의 독립적인 라이프사이클을 관리합니다.

### SessionLifecycleManager

세션별 독립적인 라이프사이클 매니저입니다.

```typescript
import { SessionLifecycleManagerFactory } from '../standard/lifecycle.js';

// 세션별 라이프사이클 매니저 생성
const sessionManager = SessionLifecycleManagerFactory.getSessionLifecycleManager("user123");

// 세션별 초기화
sessionManager.initialize(server, serverInfo);

// 세션별 종료
await sessionManager.shutdown("User session ended");
```

### SessionLifecycleManagerFactory

세션 매니저의 생성, 관리, 정리를 담당합니다.

#### 세션 매니저 생성/반환

```typescript
// 기존 세션이 있으면 반환, 없으면 새로 생성
const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager("user123");
```

#### 모든 세션 매니저 조회

```typescript
const allManagers = SessionLifecycleManagerFactory.getAllSessionLifecycleManagers();
console.log(`Active sessions: ${allManagers.size}`);
```

#### 비활성 세션 정리

```typescript
// 30분 이상 비활성인 세션 정리
const cleanedCount = SessionLifecycleManagerFactory.cleanupInactiveSessions(30 * 60 * 1000);
console.log(`Cleaned ${cleanedCount} inactive sessions`);
```

#### 세션 통계 조회

```typescript
const stats = SessionLifecycleManagerFactory.getSessionLifecycleStats();
console.log(`Total sessions: ${stats.totalSessions}`);
console.log(`Active sessions: ${stats.activeSessions}`);
console.log(`Inactive sessions: ${stats.inactiveSessions}`);
```

## 기능 협상

클라이언트와 서버 간의 기능 교환을 통해 지원되는 기능을 협상합니다.

### 클라이언트 기능

```typescript
const clientCapabilities = {
  roots: { listChanged: true },
  sampling: { listChanged: true },
  elicitation: { listChanged: true }
};
```

### 서버 기능

```typescript
const serverCapabilities = {
  prompts: { listChanged: true },
  resources: { 
    subscribe: true, 
    listChanged: true 
  },
  tools: { listChanged: true },
  logging: {},
  completions: {}
};
```

### 프로토콜 버전 협상

```typescript
// 클라이언트가 요청한 버전
const requestedVersion = "2024-11-05";

// 서버가 지원하는 버전
const supportedVersion = "2024-11-05";

if (requestedVersion !== supportedVersion) {
  throw new Error(`Unsupported protocol version. Server supports: ${supportedVersion}`);
}
```

## 로깅 및 모니터링

### 구조화된 로깅

라이프사이클 이벤트는 구조화된 로깅을 통해 추적됩니다.

```json
{
  "message": "Initialize request received",
  "clientProtocolVersion": "2024-11-05",
  "clientCapabilities": { "roots": { "listChanged": true } },
  "clientInfo": { "name": "TestClient", "version": "1.0.0" },
  "_otel": {
    "timestamp": 1753607512365,
    "resource": {
      "service.name": "mcp-server",
      "service.version": "1.0.0"
    }
  }
}
```

### OpenTelemetry 통합

모든 라이프사이클 이벤트는 OpenTelemetry를 통해 추적됩니다.

```typescript
// 라이프사이클 작업 시작
const traceId = logger.startOperation("lifecycle.initialize", {
  "lifecycle.state.initial": this.state,
  "lifecycle.session.id": sessionId
});

// 라이프사이클 작업 완료
logger.endOperation(traceId, {
  "lifecycle.state.final": this.state,
  "lifecycle.session.initialized": true
});
```

## 성능 고려사항

### 메모리 관리

- 세션 격리는 메모리 사용량을 고려하여 비활성 세션을 주기적으로 정리합니다
- 기본 정리 주기: 30분
- 정리 대상: 비활성 세션, 완료된 작업, 임시 데이터

### 상태 변경 최적화

- 라이프사이클 상태 변경은 원자적으로 처리됩니다
- 불필요한 상태 변경을 방지하기 위한 검증 로직 포함
- 상태 변경 시 이벤트 발생을 최소화

### 종료 처리 최적화

- 종료 핸들러는 타임아웃(기본 5초)을 가집니다
- 병렬 처리로 종료 시간을 단축합니다
- 실패한 종료 핸들러는 로그로 기록하되 전체 종료를 차단하지 않습니다

## 보안 고려사항

### 프로토콜 버전 검증

- 프로토콜 버전 불일치 시 연결을 거부합니다
- 지원하지 않는 기능 요청 시 적절한 오류 응답을 반환합니다

### 세션 격리

- 세션 격리를 통해 사용자 간 데이터 격리를 보장합니다
- 세션별 독립적인 상태 관리로 데이터 누출을 방지합니다
- 세션 종료 시 모든 관련 데이터를 정리합니다

### 리소스 정리

- 종료 시 모든 리소스를 정리합니다
- 메모리 누수 방지를 위한 참조 정리
- 파일 시스템 리소스 정리
- 네트워크 연결 종료

## 오류 처리

### 초기화 오류

```typescript
try {
  const response = lifecycleManager.handleInitializeRequest(request);
} catch (error) {
  if (error.message.includes("Unsupported protocol version")) {
    // 프로토콜 버전 불일치 처리
    return {
      error: {
        code: -32000,
        message: error.message
      }
    };
  }
  throw error;
}
```

### 종료 오류

```typescript
try {
  await lifecycleManager.shutdown("Graceful shutdown");
} catch (error) {
  // 종료 실패 시 강제 종료
  logger.error("Graceful shutdown failed, forcing shutdown", error);
  process.exit(1);
}
```

### 세션 오류

```typescript
try {
  const sessionManager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
  await sessionManager.shutdown("Session error");
} catch (error) {
  // 세션 오류 시 해당 세션만 정리
  logger.error(`Session ${sessionId} error:`, error);
  SessionLifecycleManagerFactory.cleanupSession(sessionId);
}
```

## 테스트

### 기본 라이프사이클 테스트

```bash
bun test tests/lifecycle.test.ts
```

### 세션 격리 테스트

```bash
bun test tests/session-lifecycle.test.ts
```

### 데모 실행

```bash
# 기본 라이프사이클 데모
bun run demo/lifecycle.ts

# 세션 격리 데모
bun run demo/session-lifecycle.ts
```

## API 참조

### LifecycleManager

#### 메서드

- `initialize(server: McpServer, serverInfo: LifecycleInfo)`: 서버 초기화
- `handleInitializeRequest(request: any)`: 클라이언트 초기화 요청 처리
- `markInitialized()`: 초기화 완료 표시
- `shutdown(reason: string)`: 서버 종료
- `onShutdown(handler: ShutdownHandler)`: 종료 핸들러 등록
- `getState()`: 현재 상태 반환
- `getUptime()`: 서버 가동 시간 반환
- `isOperational()`: 운영 상태 확인
- `reset()`: 상태 초기화 (테스트용)

#### 속성

- `protocolVersion`: 지원하는 프로토콜 버전
- `clientCapabilities`: 클라이언트 기능
- `serverCapabilities`: 서버 기능
- `clientInfo`: 클라이언트 정보
- `serverInfo`: 서버 정보

### SessionLifecycleManagerFactory

#### 메서드

- `getSessionLifecycleManager(sessionId: string)`: 세션별 매니저 생성/반환
- `getAllSessionLifecycleManagers()`: 모든 세션 매니저 반환
- `cleanupInactiveSessions(maxInactiveTime?: number)`: 비활성 세션 정리
- `getSessionLifecycleStats()`: 세션 통계 반환
- `cleanupSession(sessionId: string)`: 특정 세션 정리

### 타입 정의

```typescript
interface LifecycleInfo {
  name: string;
  title: string;
  version: string;
}

interface LifecycleCapabilities {
  prompts?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  tools?: { listChanged?: boolean };
  logging?: Record<string, unknown>;
  completions?: Record<string, unknown>;
}

type ShutdownHandler = (reason: string) => Promise<void> | void;
```

## 예제

### 완전한 라이프사이클 예제

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifecycleManager } from "./standard/lifecycle.js";

// MCP 서버 생성
const server = new McpServer({
  name: "example-server",
  version: "1.0.0"
});

// 라이프사이클 매니저 생성
const lifecycleManager = new LifecycleManager();

// 서버 초기화
lifecycleManager.initialize(server, {
  name: "example-server",
  title: "Example MCP Server",
  version: "1.0.0"
});

// 종료 핸들러 등록
lifecycleManager.onShutdown(async (reason) => {
  console.log(`Shutting down: ${reason}`);
  // 정리 작업 수행
});

// 클라이언트 초기화 요청 처리
const request = {
  params: {
    protocolVersion: "2024-11-05",
    capabilities: { roots: { listChanged: true } },
    clientInfo: { name: "TestClient", version: "1.0.0" }
  }
};

try {
  const response = lifecycleManager.handleInitializeRequest(request);
  console.log("Initialization successful:", response);
} catch (error) {
  console.error("Initialization failed:", error);
}

// 서버 종료
await lifecycleManager.shutdown("Example completed");
```

### 세션 격리 예제

```typescript
import { SessionLifecycleManagerFactory } from "./standard/lifecycle.js";

// 여러 사용자 세션 관리
const userSessions = ["user1", "user2", "user3"];

for (const userId of userSessions) {
  const sessionManager = SessionLifecycleManagerFactory.getSessionLifecycleManager(userId);
  
  // 세션별 초기화
  sessionManager.initialize(server, serverInfo);
  
  // 세션별 작업 수행
  // ...
  
  // 세션별 종료
  await sessionManager.shutdown(`User ${userId} session ended`);
}

// 비활성 세션 정리
const cleanedCount = SessionLifecycleManagerFactory.cleanupInactiveSessions();
console.log(`Cleaned ${cleanedCount} inactive sessions`);

// 세션 통계 조회
const stats = SessionLifecycleManagerFactory.getSessionLifecycleStats();
console.log("Session statistics:", stats);
``` 