# MCP 서버 ID 체계 및 컨텍스트 가이드

## 개요

MCP 서버는 분산 추적과 세션 관리를 위해 세 가지 핵심 식별자를 사용합니다. 이 문서는 각 식별자의 정의, 용도, 생성 규칙, 그리고 상호 관계를 명확하게 설명합니다.

## 핵심 식별자 정의

### 1. Session ID (세션 아이디)

**정의**: 클라이언트와 서버 간의 전체 연결 세션을 식별하는 고유 식별자

**형식**: `sess_{timestamp}_{random}`

**예시**: `sess_1753546615332_hhais2xo9sp`

**생성 규칙**:
- `sess_`: 고정 접두사
- `{timestamp}`: 밀리초 단위 Unix 타임스탬프
- `{random}`: 8-12자리 랜덤 알파숫자 문자열

**생명주기**:
- **생성**: 클라이언트 연결 시점
- **지속**: 전체 연결 세션 동안 유지
- **종료**: 클라이언트 연결 해제 시점

**용도**:
- 동일 클라이언트의 모든 요청을 그룹화
- 세션별 메트릭 및 로깅 수집
- 클라이언트별 상태 관리
- 디버깅 시 클라이언트 추적

```typescript
// Session ID 생성 예시
function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `sess_${timestamp}_${random}`;
}

// 사용 예시
logger.setSessionContext("sess_1753546615332_hhais2xo9sp");
```

### 2. Trace ID (트레이스 아이디)

**정의**: 단일 요청 처리 과정 전체를 추적하는 분산 추적 식별자

**형식**: 128비트 (32자리 16진수)

**예시**: `002c08b9d7041c1800044749c7bb5bb8`

**생성 규칙**:
- W3C Trace Context 표준 준수
- 128비트 = 32자리 16진수 문자열
- 구조: `{high64bits}{low64bits}`
- OpenTelemetry 호환

**생명주기**:
- **생성**: MCP 엔드포인트 호출 시점 (`logEndpointEntry`)
- **지속**: 해당 요청의 모든 하위 작업 동안 유지
- **종료**: 요청 완료 시점 (`logMethodExit`)

**용도**:
- 단일 요청의 전체 처리 흐름 추적
- 성능 분석 및 병목점 식별
- 오류 발생 시 전체 실행 경로 추적
- 분산 시스템에서 요청 전파 추적

```typescript
// Trace ID 사용 예시
const traceId = await logger.logEndpointEntry("tools/call", "req-001", params);
// ... 비즈니스 로직 실행 ...
await logger.logMethodExit("tools/call", result, "tools", traceId);
```

### 3. Span ID (스팬 아이디)

**정의**: Trace 내의 개별 작업 단위를 식별하는 식별자

**형식**: 64비트 (16자리 16진수)

**예시**: `00b2deaa23f22b58`

**생성 규칙**:
- 64비트 = 16자리 16진수 문자열
- 각 작업마다 고유한 Span ID 생성
- 부모-자식 관계를 통한 계층 구조 형성

**생명주기**:
- **생성**: 개별 작업 시작 시점 (`startOperation`)
- **지속**: 해당 작업 진행 동안 유지
- **종료**: 작업 완료 시점 (`endOperation`)

**용도**:
- Trace 내의 개별 작업 구분
- 작업 간 부모-자식 관계 추적
- 세부 성능 측정
- 작업 단위 오류 추적

```typescript
// Span ID 사용 예시 (자동 생성)
const spanId = logger.startOperation("database.query", {
  table: "users",
  operation: "SELECT"
});

// 작업 완료
logger.endOperation(spanId, {
  rowsReturned: 15,
  duration: 45
});
```

## 식별자 간 관계

### 계층 구조

```
Session ID (최상위)
└── Trace ID (요청 레벨)
    ├── Span ID (작업 1)
    ├── Span ID (작업 2)
    └── Span ID (작업 3)
        └── Span ID (하위 작업)
```

### 관계 매핑

```typescript
interface TraceContext {
  sessionId: string;    // sess_1753546615332_hhais2xo9sp
  traceId: string;      // 002c08b9d7041c1800044749c7bb5bb8
  spanId: string;       // 00b2deaa23f22b58
  parentSpanId?: string; // 부모 Span ID (있는 경우)
}
```

### 로그에서의 표현

```json
{
  "message": "Tool execution completed",
  "_session": {
    "sessionId": "sess_1753546615332_hhais2xo9sp",
    "clientId": "web-client-123",
    "transportType": "http"
  },
  "_trace": {
    "traceId": "002c08b9d7041c1800044749c7bb5bb8",
    "spanId": "00b2deaa23f22b58", 
    "parentSpanId": "001a5c9d8e7f4b23",
    "operationName": "mcp.tools/call"
  }
}
```

## 실제 사용 시나리오

### 시나리오 1: 단순 요청 처리

```typescript
// 1. 세션 컨텍스트 설정 (연결 시)
logger.setSessionContext("sess_1753546615332_hhais2xo9sp");

// 2. 요청 시작 (Trace ID 생성)
const traceId = await logger.logEndpointEntry("tools/list", "req-001");

// 3. 작업 실행 (Span ID 생성)
const validationSpan = logger.startOperation("input.validation");
// ... 검증 로직 ...
logger.endOperation(validationSpan, { result: "valid" });

const fetchSpan = logger.startOperation("data.fetch"); 
// ... 데이터 조회 ...
logger.endOperation(fetchSpan, { count: 10 });

// 4. 요청 완료
await logger.logMethodExit("tools/list", result, "tools", traceId);
```

**생성되는 식별자**:
- Session ID: `sess_1753546615332_hhais2xo9sp` (연결 동안 유지)
- Trace ID: `002c08b9d7041c1800044749c7bb5bb8` (이 요청만)
- Span ID 1: `00b2deaa23f22b58` (검증 작업)
- Span ID 2: `00c3fbb34e8g5c69` (데이터 조회)

### 시나리오 2: 중첩 작업 처리

```typescript
// 메인 요청
const mainTraceId = await logger.logEndpointEntry("resources/read", "req-002");

// 상위 작업
const processSpan = logger.startOperation("file.processing");

  // 하위 작업 1
  const validateSpan = logger.startOperation("file.validation", {
    parentSpanId: processSpan
  });
  logger.endOperation(validateSpan);

  // 하위 작업 2  
  const readSpan = logger.startOperation("file.read", {
    parentSpanId: processSpan
  });
  logger.endOperation(readSpan);

logger.endOperation(processSpan);

await logger.logMethodExit("resources/read", result, "resources", mainTraceId);
```

**계층 구조**:
```
Trace: 002c08b9d7041c1800044749c7bb5bb8
├── Span: 00b2deaa23f22b58 (file.processing) 
    ├── Span: 00c3fbb34e8g5c69 (file.validation)
    └── Span: 00d4gcc45f9h6d7a (file.read)
```

## 디버깅 활용법

### 1. Session 기반 추적

```bash
# 특정 세션의 모든 활동 조회
grep "sess_1753546615332_hhais2xo9sp" server.log | jq '.'

# 세션 내 모든 요청 목록
grep "sess_1753546615332_hhais2xo9sp" server.log | jq '._trace.traceId' | sort -u
```

### 2. Trace 기반 분석

```bash
# 특정 요청의 전체 흐름 추적
grep "002c08b9d7041c18" server.log | jq '{time: .timestamp, operation: ._trace.operationName, span: ._trace.spanId}'

# 요청 성능 분석
grep "002c08b9d7041c18" server.log | jq '._trace.attributes."mcp.duration.ms"'
```

### 3. Span 기반 세부 분석

```bash
# 특정 작업의 세부 정보
grep "00b2deaa23f22b58" server.log | jq '{message, attributes: ._trace.attributes}'

# 작업 계층 구조 분석
grep "002c08b9d7041c18" server.log | jq '{span: ._trace.spanId, parent: ._trace.parentSpanId, op: ._trace.operationName}'
```

## 성능 및 저장 고려사항

### 메모리 사용량

| 식별자 타입 | 크기 | 수량 (동시) | 총 메모리 |
|------------|------|------------|----------|
| Session ID | ~30 bytes | 100 sessions | ~3KB |
| Trace ID | ~32 bytes | 1000 traces | ~32KB |  
| Span ID | ~16 bytes | 5000 spans | ~80KB |
| **총계** | | | **~115KB** |

### 정리 정책

- **Session**: 연결 해제 시 즉시 정리
- **Trace**: 완료 후 5분 후 정리
- **Span**: 부모 Trace 정리 시 함께 정리

### 인덱싱 권장사항

```sql
-- 로그 저장소 인덱스 권장사항
CREATE INDEX idx_session_time ON logs(session_id, timestamp);
CREATE INDEX idx_trace_time ON logs(trace_id, timestamp);  
CREATE INDEX idx_span_parent ON logs(span_id, parent_span_id);
```

## 모범 사례

### ✅ 권장사항

```typescript
// 1. 일관된 컨텍스트 전파
const traceId = await logger.logEndpointEntry(endpoint, requestId, params);
// ... 모든 하위 작업에서 동일한 traceId 사용
await logger.logMethodExit(endpoint, result, category, traceId);

// 2. 의미 있는 작업 명명
const spanId = logger.startOperation("user.authentication.jwt_validation");

// 3. 적절한 속성 포함
logger.endOperation(spanId, {
  "auth.result": "success",
  "auth.user.id": userId,
  "auth.duration.ms": duration
});
```

### ❌ 피해야 할 사항

```typescript
// 1. Trace ID 손실
const traceId = await logger.logEndpointEntry("tools/call", requestId);
// ... 
await logger.logMethodExit("tools/call", result, "tools"); // traceId 누락!

// 2. 모호한 작업 명명
const spanId = logger.startOperation("process"); // 너무 일반적

// 3. 컨텍스트 정보 누락
logger.endOperation(spanId); // 결과 정보 없음
```

## 문제 해결

### 일반적인 문제들

1. **Trace ID가 null**
   - 원인: OTel이 비활성화됨
   - 해결: 환경변수 확인 또는 테스트 환경에서는 정상 동작

2. **Session ID 중복**
   - 원인: 시간 동기화 문제
   - 해결: 랜덤 부분 길이 증가

3. **Span 계층 구조 깨짐**
   - 원인: parentSpanId 전달 누락
   - 해결: 중첩 작업 시 명시적 parent 지정

### 테스트 환경에서의 주의사항

테스트 환경에서는 OTel이 비활성화될 수 있으므로 Trace ID와 Span ID가 `null`을 반환할 수 있습니다. 이는 정상적인 동작이며, 로깅 시스템은 ID가 `null`이어도 정상적으로 작동합니다.

```typescript
// 테스트 환경 대응 예시
const traceId = await logger.logEndpointEntry("test/endpoint", "req-001");
// traceId가 null일 수 있지만 로깅은 계속 작동함
await logger.logMethodExit("test/endpoint", result, "test", traceId);
```

이 가이드를 통해 MCP 서버의 식별자 체계를 완전히 이해하고 효과적으로 활용할 수 있습니다.