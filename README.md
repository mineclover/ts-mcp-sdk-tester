# MCP TypeScript SDK Tester

Model Context Protocol (MCP) TypeScript SDK의 테스트 및 데모 프로젝트입니다.

## 프로젝트 구조

```
.
├── standard/           # 핵심 MCP 구현
│   ├── lifecycle.ts   # 라이프사이클 관리
│   ├── auth.ts        # 인증 관리
│   ├── transports.ts  # 통신 프로토콜
│   └── ...
├── demo/              # 데모 애플리케이션
│   ├── lifecycle.ts   # 기본 라이프사이클 데모
│   └── session-lifecycle.ts  # 세션 격리 데모
├── tests/             # 테스트 파일
│   ├── lifecycle.test.ts      # 기본 라이프사이클 테스트
│   └── session-lifecycle.test.ts  # 세션 격리 테스트
└── spec.txt           # 작업 진행 상황
```

## 라이프사이클 관리

### 개요

MCP 라이프사이클은 서버와 클라이언트 간의 연결 상태를 관리하는 핵심 기능입니다. 이 프로젝트는 MCP 스펙에 따라 다음 세 단계를 구현합니다:

1. **초기화 (Initialization)**: 프로토콜 버전 협상 및 기능 교환
2. **운영 (Operation)**: 정상적인 프로토콜 통신
3. **종료 (Shutdown)**: 연결의 정상적인 종료

### 주요 기능

#### 1. 기본 라이프사이클 관리 (`LifecycleManager`)

```typescript
import { LifecycleManager, LifecycleState } from './standard/lifecycle.js';

// 라이프사이클 매니저 초기화
const lifecycleManager = new LifecycleManager();

// 서버 초기화
lifecycleManager.initialize(server, serverInfo);

// 클라이언트 초기화 요청 처리
const response = lifecycleManager.handleInitializeRequest(request);

// 서버 종료
await lifecycleManager.shutdown("Graceful shutdown");
```

#### 2. 세션 격리 지원 (`SessionLifecycleManager`)

다중 사용자 환경에서 각 세션의 독립적인 라이프사이클을 관리합니다:

```typescript
import { SessionLifecycleManagerFactory } from './standard/lifecycle.js';

// 세션별 라이프사이클 매니저 생성
const sessionManager = SessionLifecycleManagerFactory.getSessionLifecycleManager("user123");

// 세션별 초기화
sessionManager.initialize(server, serverInfo);

// 세션별 종료
await sessionManager.shutdown("User session ended");

// 비활성 세션 정리
const cleanedCount = SessionLifecycleManagerFactory.cleanupInactiveSessions();
```

### 상태 관리

라이프사이클은 다음 상태들을 가집니다:

- `UNINITIALIZED`: 초기 상태
- `INITIALIZING`: 초기화 진행 중
- `INITIALIZED`: 초기화 완료
- `OPERATING`: 정상 운영 중
- `SHUTTING_DOWN`: 종료 진행 중
- `SHUTDOWN`: 종료 완료

### 기능 협상

클라이언트와 서버 간의 기능 교환을 통해 지원되는 기능을 협상합니다:

```typescript
// 클라이언트 기능
const clientCapabilities = {
  roots: { listChanged: true },
  sampling: { listChanged: true },
  elicitation: { listChanged: true }
};

// 서버 기능
const serverCapabilities = {
  prompts: { listChanged: true },
  resources: { subscribe: true, listChanged: true },
  tools: { listChanged: true },
  logging: {},
  completions: {}
};
```

### 이벤트 핸들링

라이프사이클 이벤트를 처리하기 위한 핸들러를 등록할 수 있습니다:

```typescript
// 종료 핸들러 등록
lifecycleManager.onShutdown(async (reason) => {
  console.log(`Shutting down: ${reason}`);
  // 정리 작업 수행
});

// 상태 변경 모니터링
lifecycleManager.onStateChange((oldState, newState) => {
  console.log(`State changed: ${oldState} -> ${newState}`);
});
```

## 데모 실행

### 기본 라이프사이클 데모

```bash
bun run demo/lifecycle.ts
```

### 세션 격리 데모

```bash
bun run demo/session-lifecycle.ts
```

## 테스트 실행

### 기본 라이프사이클 테스트

```bash
bun test tests/lifecycle.test.ts
```

### 세션 격리 테스트

```bash
bun test tests/session-lifecycle.test.ts
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

## 로깅

라이프사이클 이벤트는 구조화된 로깅을 통해 추적됩니다:

```json
{
  "message": "Initialize request received",
  "clientProtocolVersion": "2024-11-05",
  "clientCapabilities": { "roots": { "listChanged": true } },
  "clientInfo": { "name": "TestClient", "version": "1.0.0" }
}
```

## 성능 고려사항

- 세션 격리는 메모리 사용량을 고려하여 비활성 세션을 주기적으로 정리합니다
- 라이프사이클 상태 변경은 원자적으로 처리됩니다
- 종료 핸들러는 타임아웃(기본 5초)을 가집니다

## 보안 고려사항

- 프로토콜 버전 불일치 시 연결을 거부합니다
- 세션 격리를 통해 사용자 간 데이터 격리를 보장합니다
- 종료 시 모든 리소스를 정리합니다

## 라이센스

MIT License


