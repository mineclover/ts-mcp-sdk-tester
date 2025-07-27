# MCP SDK Tester 종합 문서

## 📋 개요

이 문서는 MCP (Model Context Protocol) 사양을 완전히 준수하는 테스트 서버의 설계, 구현, 그리고 활용 방법을 종합적으로 다룹니다. 중앙화된 세션 관리, 메모리 효율적인 추상화 패턴, 그리고 MCP Transport 사양 준수를 통해 프로덕션급 MCP 서버 구현을 제공합니다.

## 📚 문서 구조

### 1. 🏗️ [아키텍처 및 플로우](./architecture-flow.md)
**MCP SDK Tester의 전체 아키텍처 설계**
- 컴포넌트 간 관계 및 데이터 흐름
- 요청 처리 라이프사이클
- 확장성 및 성능 고려사항

### 2. 🎯 [추상화 패턴 가이드](./abstractions-guide.md)
**메모리 효율적인 추상화 시스템**
- 중앙화된 세션 관리 및 단일 책임 원칙
- 스트리밍 기반 페이지네이션 (배치 작업 제거)
- 프로토콜 테스트 최적화된 헬스체크

**핵심 구성요소**:
```typescript
// 통합 추상화 시스템
export { 
  globalSessionManager,      // 중앙화된 세션 관리
  executeMcpTask,           // 메모리 효율적 작업 실행
  StreamingPaginatedDataSource, // 스트리밍 페이지네이션
  McpHealthManager          // 헬스 상태 관리
} from "./abstractions/index.js";
```

### 3. 🔄 [세션 관리 마이그레이션](./session-management-migration.md)
**단일 책임 원칙 기반 세션 관리**
- 중앙화된 SessionManager 구현
- 기존 코드와의 호환성 유지
- 어댑터 패턴을 통한 점진적 마이그레이션

**주요 개선사항**:
```typescript
// 중앙화된 세션 관리
const sessionId = globalSessionManager.createSession("claude", "user_123", ["tools"]);
globalSessionManager.activateSession(sessionId);

// 세션별 작업 실행
await withSession(sessionId, async () => {
  await executeMcpTask("task_name", async () => {
    // 작업 실행
  });
});
```

### 4. 🚀 [MCP Transport 사양 준수](./mcp-transport-compliance.md)
**MCP Transport 사양 (2025-06-18) 완전 준수**
- stdio 및 Streamable HTTP Transport 구현
- 세션 관리 및 보안 요구사항
- JSON-RPC 2.0 메시지 형식 준수

**준수 현황**:
- ✅ JSON-RPC 2.0 메시지 형식
- ✅ UTF-8 인코딩 지원  
- ✅ 세션 ID 헤더 지원
- ✅ Origin 헤더 검증
- ✅ 로컬호스트 바인딩 보안

### 5. 🔧 [라이프사이클 관리](./lifecycle.md)
**서버 라이프사이클 및 상태 관리**
- 초기화, 운영, 종료 단계별 관리
- Graceful shutdown 구현
- 상태 추적 및 모니터링

## 🎯 핵심 가치 제안

### 1. **MCP 사양 완전 준수 (2025-06-18)**
- stdio 및 Streamable HTTP Transport 완전 구현
- JSON-RPC 2.0 메시지 형식 및 UTF-8 인코딩
- 세션 관리 및 보안 요구사항 준수
- MCP Inspector 호환성

### 2. **중앙화된 세션 관리**
- 단일 책임 원칙 기반 SessionManager
- 메모리 효율적인 세션 생명주기 관리
- 분산 추적 및 OpenTelemetry 통합
- Graceful shutdown 및 자동 정리

### 3. **메모리 효율적 추상화**
- 스트리밍 기반 페이지네이션 (배치 작업 제거)
- 단순하고 재사용 가능한 패턴
- 프로토콜 테스트에 최적화된 설계
- 확장 가능한 컴포넌트 아키텍처

### 4. **프로덕션급 안정성**
- 포괄적인 에러 처리 및 복구
- CORS 보안 및 인증 시스템
- 헬스 체크 및 모니터링
- TypeScript 타입 안전성

## 🚀 빠른 시작

### 1. 서버 빌드 및 실행
```bash
# 프로젝트 빌드
bun run build

# stdio transport로 실행 (MCP Inspector용)
./dist/mcp-sdk-tester

# HTTP transport로 실행 (웹 기반 테스트용)
./dist/mcp-sdk-tester --port 3000
```

### 2. MCP Inspector로 테스트
```bash
# HTTP transport 연결
npx @modelcontextprotocol/inspector http://localhost:3000/mcp

# stdio transport 연결 (별도 터미널)
npx @modelcontextprotocol/inspector ./dist/mcp-sdk-tester
```

### 3. 기본 API 사용
```typescript
import { 
  globalSessionManager, 
  executeMcpTask,
  StreamingPaginatedDataSource 
} from "./standard/abstractions/index.js";

// 세션 생성 및 관리
const sessionId = globalSessionManager.createSession("claude", "user_123", ["tools"]);
globalSessionManager.activateSession(sessionId);

// 메모리 효율적 작업 실행
await executeMcpTask("process_request", async () => {
  // 비즈니스 로직 실행
  return { result: "success" };
});

// 스트리밍 페이지네이션
const dataSource = new StreamingPaginatedDataSource(
  () => Promise.resolve(1000), // 총 개수
  (start, size) => Promise.resolve(items.slice(start, start + size))
);
```

### 4. 상태 확인
```bash
# 헬스 체크
curl http://localhost:3000/health

# 서버 정보
curl http://localhost:3000/info

# 직접 MCP 요청
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

## 📊 성능 특성

### 메모리 효율성 (프로토콜 테스트 최적화)
| 구성 요소 | 특징 | 메모리 사용량 | 설명 |
|-----------|------|--------------|------|
| 중앙화된 세션 | 단일 책임 | ~1KB/세션 | 중복 제거된 효율적 관리 |
| 스트리밍 페이지네이션 | 배치 제거 | ~512B/요청 | 메모리 기반 처리 제거 |
| 헬스 체커 | 경량화 | ~256B | 기본 메트릭만 수집 |
| Transport 세션 | 정리 자동화 | ~2KB/연결 | 자동 정리 및 추적 |
| **총계** | | **최소화** | **프로토콜 테스트에 최적화** |

### 처리 성능
- **세션 생성**: <1ms (중앙화된 관리)
- **MCP 요청 처리**: <5ms 오버헤드
- **페이지네이션**: 스트리밍, 메모리 제한 없음
- **Transport 전환**: stdio ↔ HTTP 즉시 지원

## 🔧 구성 옵션

### Transport 설정
```bash
# stdio transport (기본값)
./dist/mcp-sdk-tester

# HTTP transport
./dist/mcp-sdk-tester --port 3000

# 커스텀 설정
./dist/mcp-sdk-tester --transport streamable --port 8080
```

### 환경별 설정
```typescript
// 개발 환경
const sessionId = globalSessionManager.createSession(
  "development-client", 
  "dev-user", 
  ["tools", "resources", "debug"]
);

// 프로덕션 환경
const sessionId = globalSessionManager.createSession(
  "claude", 
  "user_123", 
  ["tools", "resources"]
);
```

## 🧪 테스트 및 검증

### MCP 사양 준수 검증
- ✅ **MCP Transport 사양 (2025-06-18)** 완전 준수
- ✅ **JSON-RPC 2.0** 메시지 형식 검증
- ✅ **세션 관리** 중앙화 및 단일 책임 원칙
- ✅ **메모리 효율성** 스트리밍 기반 구현
- ✅ **보안 요구사항** CORS, 인증, 로컬호스트 바인딩

### 테스트 실행
```bash
# 프로젝트 빌드 및 검증
bun run build

# MCP Inspector로 기능 테스트
npx @modelcontextprotocol/inspector ./dist/mcp-sdk-tester

# HTTP 엔드포인트 테스트
./dist/mcp-sdk-tester --port 3000 &
curl http://localhost:3000/health
```

### 호환성 검증
```bash
# MCP Inspector 호환성
npx @modelcontextprotocol/inspector http://localhost:3000/mcp

# 표준 MCP 클라이언트 호환성
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: test-session" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {...}}'
```

## 🗂️ 파일 구조

```
docs/
├── README.md                          # 종합 개요 (이 파일)
├── architecture-flow.md               # 아키텍처 설계
├── abstractions-guide.md              # 추상화 패턴 가이드
├── session-management-migration.md    # 세션 관리 마이그레이션
├── mcp-transport-compliance.md        # MCP Transport 사양 준수
└── lifecycle.md                       # 라이프사이클 관리

standard/
├── abstractions/                      # 추상화 시스템
│   ├── index.ts                      # 통합 추상화 내보내기
│   ├── session-manager.ts            # 중앙화된 세션 관리
│   ├── lifecycle-adapter.ts          # 라이프사이클 어댑터
│   ├── logging-patterns.ts           # 메모리 효율적 로깅
│   ├── pagination-patterns.ts        # 스트리밍 페이지네이션
│   └── ping-patterns.ts              # 헬스 체크 패턴
├── transports.ts                     # MCP Transport 구현
├── lifecycle.ts                      # 라이프사이클 관리
├── index.ts                          # 표준 엔드포인트 등록
└── constants.ts                      # 애플리케이션 상수

index.ts                               # 메인 진입점
```

## 🛣️ 개발 로드맵

### Phase 1: 기반 구조 구축 ✅
- [x] MCP Transport 사양 (2025-06-18) 완전 준수
- [x] stdio 및 Streamable HTTP Transport 구현
- [x] JSON-RPC 2.0 메시지 형식 지원
- [x] 기본 보안 및 CORS 설정

### Phase 2: 세션 관리 개선 ✅
- [x] 중앙화된 SessionManager 구현
- [x] 단일 책임 원칙 적용
- [x] 어댑터 패턴을 통한 기존 코드 호환성
- [x] Transport 시스템 세션 관리 통합

### Phase 3: 메모리 효율성 최적화 ✅
- [x] 스트리밍 기반 페이지네이션 구현
- [x] 배치 작업 제거 및 메모리 최적화
- [x] 추상화 패턴 단순화
- [x] 프로토콜 테스트 최적화

### Phase 4: 프로덕션 안정성 ✅
- [x] Graceful shutdown 구현
- [x] 에러 처리 및 복구 메커니즘
- [x] 헬스 체크 및 모니터링
- [x] serverInfo 매개변수 누락 문제 해결

### Phase 5: 문서화 및 호환성 ✅
- [x] 종합적인 문서 체계 구축
- [x] MCP Inspector 호환성 검증
- [x] 사용 가이드 및 예시 제공
- [x] 최신 변경사항 반영 (중앙화된 SessionManager, Transport 리팩토링)

### 향후 계획
- [ ] 확장된 MCP 기능 지원 (elicitation, sampling)
- [ ] 성능 모니터링 대시보드
- [ ] 고급 디버깅 도구
- [ ] 클러스터 모드 지원

## 🤝 기여 방법

1. **MCP 사양 준수**: 새로운 MCP 기능 구현 시 최신 사양 참조
2. **메모리 효율성**: 프로토콜 테스트 목적에 맞는 경량화된 구현
3. **단일 책임 원칙**: 각 컴포넌트의 명확한 역할 분리
4. **문서화**: 코드 변경 시 관련 문서 동시 업데이트

## 📞 지원 및 사용법

### 빠른 시작
```bash
# 1. 빌드
bun run build

# 2. 테스트
./dist/mcp-sdk-tester --port 3000
curl http://localhost:3000/health

# 3. MCP Inspector 연결
npx @modelcontextprotocol/inspector http://localhost:3000/mcp
```

### 문서 참조
- **전체 아키텍처**: [architecture-flow.md](./architecture-flow.md)
- **세션 관리**: [session-management-migration.md](./session-management-migration.md)
- **Transport 구현**: [mcp-transport-compliance.md](./mcp-transport-compliance.md)
- **추상화 패턴**: [abstractions-guide.md](./abstractions-guide.md)

---

**MCP SDK Tester**는 Model Context Protocol 사양을 완전히 준수하며, 메모리 효율적이고 확장 가능한 프로토콜 테스트 서버를 제공합니다.