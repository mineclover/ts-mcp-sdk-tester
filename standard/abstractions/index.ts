/**
 * MCP 핵심 유틸리티 추상화 통합 인덱스
 * 
 * 로깅, 페이지네이션, 핑 시스템의 모든 추상화 패턴을 통합하여 제공합니다.
 * 이 파일을 통해 모든 MCP 엔드포인트에서 일관된 패턴을 사용할 수 있습니다.
 */

// === 로깅 시스템 추상화 ===
export {
  // 핵심 패턴
  executeMcpEndpoint,
  executeMcpOperation,
  executeMcpTask,
  measureMcpOperation,
  
  // 데코레이터
  McpEndpoint,
  McpOperation,
  
  // 타입
  type McpEndpointContext,
  type McpOperationContext,
} from "./logging-patterns.js";

export {
  // 세션 관리 (deprecated)
  McpSessionContext,
  
  // 특화 로거들
  McpToolLogger,
  McpResourceLogger,
  McpAuthLogger,
  McpTransportLogger,
  
  // 편의 함수
  logMcpTask,
  debugLog,
  logSlowOperation,
} from "./logging-utils.js";

// === 세션 관리 시스템 ===
export {
  // 세션 매니저
  SessionManager,
  globalSessionManager,
  
  // 편의 함수
  createAndActivateSession,
  withSession,
  
  // 타입
  type SessionInfo,
  type SessionEvent,
} from "./session-manager.js";

// === 라이프사이클 관리 어댑터 ===
export {
  // 라이프사이클 어댑터
  SessionLifecycleAdapter,
  LifecycleAdapterFactory,
  
  // 호환성 별칭
  SessionLifecycleAdapter as SessionLifecycleManager,
  LifecycleAdapterFactory as SessionLifecycleManagerFactory,
  
  // 열거형 및 타입
  LifecycleState,
  type LifecycleCapabilities,
  type LifecycleInfo,
} from "./lifecycle-adapter.js";

// === 페이지네이션 시스템 추상화 ===
export {
  // 핵심 패턴
  McpPaginator,
  StreamingPaginatedDataSource,
  
  // 데코레이터
  McpPaginated,
  
  // 편의 함수
  createArrayPaginator,
  createAsyncPaginator,
  
  // 타입
  type StreamingDataSource,
} from "./pagination-patterns.js";

// === 핑 시스템 추상화 ===
export {
  // 핵심 패턴
  McpHealthManager,
  McpPingResponseBuilder,
  PingMetricsTracker,
  globalPingTracker,
  
  // 헬스체커들
  MemoryHealthChecker,
  CpuHealthChecker,
  UptimeHealthChecker,
  
  // 데코레이터
  McpPing,
  
  // 편의 함수
  quickHealthCheck,
  createCustomHealthChecker,
  createDatabaseHealthChecker,
  createExternalServiceHealthChecker,
  
  // 타입 및 열거형
  HealthStatus,
  type HealthCheckResult,
  type HealthChecker,
} from "./ping-patterns.js";

// === 통합 MCP 엔드포인트 베이스 클래스 ===

/**
 * MCP 엔드포인트를 위한 기본 베이스 클래스
 * 모든 추상화 패턴이 통합된 고수준 인터페이스를 제공합니다.
 */
export abstract class McpEndpointBase {
  protected sessionId?: string;
  protected toolLogger: McpToolLogger;
  protected resourceLogger: McpResourceLogger;
  protected authLogger: McpAuthLogger;
  protected transportLogger: McpTransportLogger;

  constructor(sessionId?: string) {
    this.sessionId = sessionId;
    this.toolLogger = new McpToolLogger();
    this.resourceLogger = new McpResourceLogger();
    this.authLogger = new McpAuthLogger();
    this.transportLogger = new McpTransportLogger();

    // 세션 활성화
    if (sessionId) {
      globalSessionManager.activateSession(sessionId);
    }
  }

  /**
   * 세션 설정
   */
  setSession(sessionId: string): void {
    this.sessionId = sessionId;
    globalSessionManager.activateSession(sessionId);
  }

  /**
   * 엔드포인트 실행 컨텍스트 생성
   */
  protected createEndpointContext(
    endpoint: string,
    requestId: string,
    category: string = "mcp"
  ): McpEndpointContext {
    return globalSessionManager.createEndpointContext(endpoint, requestId, category);
  }

  /**
   * 페이지네이션 실행 (배열 기반)
   */
  protected async executePagination<T>(
    items: T[],
    cursor?: string,
    config?: import("../pagination-utils.js").PaginationConfig
  ) {
    const paginator = createArrayPaginator(items, config);
    return paginator.paginate(cursor);
  }

  /**
   * 비동기 페이지네이션 실행
   */
  protected async executeAsyncPagination<T>(
    countProvider: () => Promise<number>,
    itemsProvider: (startIndex: number, pageSize: number) => Promise<T[]>,
    cursor?: string,
    config?: import("../pagination-utils.js").PaginationConfig
  ) {
    const paginator = createAsyncPaginator(countProvider, itemsProvider, config);
    return paginator.paginate(cursor);
  }

  /**
   * 도구 실행
   */
  protected async executeTool<T>(
    toolName: string,
    args: Record<string, unknown>,
    execution: () => Promise<T>
  ): Promise<T> {
    return this.toolLogger.logToolExecution(toolName, args, execution);
  }

  /**
   * 리소스 접근
   */
  protected async accessResource<T>(
    resourceUri: string,
    operation: "read" | "list" | "subscribe",
    execution: () => Promise<T>
  ): Promise<T> {
    return this.resourceLogger.logResourceAccess(resourceUri, operation, execution);
  }

  /**
   * 작업 성능 측정 (메모리 효율적)
   */
  protected async measureOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return measureMcpOperation(operationName, operation);
  }

  /**
   * 헬스 상태 조회
   */
  async getHealthStatus() {
    return quickHealthCheck();
  }

  /**
   * 성능 메트릭 조회 (기본 정보만)
   */
  getPerformanceMetrics() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}

// === 편의 팩토리 함수들 ===

/**
 * 표준 MCP 헬스 매니저 생성
 */
export function createStandardHealthManager(
  version?: string,
  environment?: string,
  customCheckers: HealthChecker[] = []
): McpHealthManager {
  const healthManager = new McpHealthManager(version, environment);
  
  // 커스텀 헬스체커들 추가
  customCheckers.forEach(checker => {
    healthManager.addChecker(checker);
  });

  return healthManager;
}

/**
 * 표준 MCP 세션 생성
 * @deprecated createAndActivateSession()을 사용하세요
 */
export function createMcpSession(
  clientType: string,
  userId?: string,
  capabilities: string[] = []
): McpSessionContext {
  const sessionId = createAndActivateSession(clientType, userId, capabilities);
  const session = globalSessionManager.getSession(sessionId);
  
  return new McpSessionContext(
    session!.sessionId, 
    session!.clientType, 
    session!.userId, 
    session!.capabilities
  );
}

/**
 * 표준 MCP 엔드포인트 설정 객체
 */
export interface McpEndpointConfig {
  sessionId?: string;
  healthManager?: McpHealthManager;
  includeHealthInPing?: boolean;
}

/**
 * 표준 설정으로 MCP 엔드포인트 베이스 생성
 */
export function createMcpEndpointBase(config: McpEndpointConfig = {}): McpEndpointBase {
  class ConfiguredMcpEndpoint extends McpEndpointBase {
    public healthManager?: McpHealthManager;

    constructor() {
      super(config.sessionId);
      this.healthManager = config.healthManager;
    }

    async getHealthStatus() {
      if (this.healthManager) {
        return this.healthManager.getStatusSummary();
      }
      return quickHealthCheck();
    }
  }

  return new ConfiguredMcpEndpoint();
}

// === 전역 인스턴스들 ===

/**
 * 전역 표준 헬스 매니저
 */
export const globalHealthManager = createStandardHealthManager(
  process.env.npm_package_version,
  process.env.NODE_ENV || "development"
);

/**
 * 전역 표준 설정
 */
export const standardMcpConfig: McpEndpointConfig = {
  healthManager: globalHealthManager,
  includeHealthInPing: true,
};

// === 타입 정의 ===

/**
 * MCP 추상화 시스템에서 사용하는 모든 타입의 통합 네임스페이스
 */
export namespace McpAbstractions {
  // 로깅 관련 타입
  export type EndpointContext = McpEndpointContext;
  export type OperationContext = McpOperationContext;
  export type SessionContext = McpSessionContext;

  // 페이지네이션 관련 타입
  export type Paginator<T> = McpPaginator<T>;
  export type DataSource<T> = StreamingDataSource<T>;

  // 핑/헬스체크 관련 타입
  export type HealthManager = McpHealthManager;
  export type PingResponseBuilder = McpPingResponseBuilder;
  export type PingTracker = PingMetricsTracker;
  export type HealthResult = HealthCheckResult;

  // 통합 타입
  export type EndpointBase = McpEndpointBase;
  export type EndpointConfig = McpEndpointConfig;
}