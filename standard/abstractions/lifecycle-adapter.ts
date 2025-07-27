/**
 * Lifecycle 관리를 위한 SessionManager 어댑터
 * 
 * 기존 lifecycle.ts가 사용하던 SessionLifecycleManager를
 * 중앙화된 SessionManager로 대체하기 위한 어댑터입니다.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../logger.js";
import { globalSessionManager, type SessionInfo } from "./session-manager.js";
import { APP_CONFIG } from "../constants.js";

export enum LifecycleState {
  UNINITIALIZED = "uninitialized",
  INITIALIZING = "initializing", 
  INITIALIZED = "initialized",
  OPERATING = "operating",
  SHUTTING_DOWN = "shutting_down",
  SHUTDOWN = "shutdown",
}

export interface LifecycleCapabilities {
  // Client capabilities
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, unknown>;
  elicitation?: Record<string, unknown>;
  experimental?: Record<string, unknown>;
  
  // Server capabilities  
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
  logging?: Record<string, unknown>;
  completions?: Record<string, unknown>;
}

export interface LifecycleInfo {
  name: string;
  title?: string;
  version: string;
}

/**
 * SessionManager를 사용하는 Lifecycle 어댑터
 * 세션별 라이프사이클 관리를 중앙 세션 매니저에 위임합니다.
 */
export class SessionLifecycleAdapter {
  private sessionId: string;
  private server: McpServer | null = null;
  private shutdownHandlers: Array<() => Promise<void> | void> = [];
  
  // 라이프사이클 특화 데이터는 세션 매니저의 메타데이터로 저장
  private serverInfo: LifecycleInfo | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    
    // 세션이 없으면 생성
    let session = globalSessionManager.getSession(sessionId);
    if (!session) {
      globalSessionManager.createSession("unknown", undefined, []);
      globalSessionManager.updateSession(sessionId, { sessionId });
      session = globalSessionManager.getSession(sessionId);
    }
    
    logger.debug(`Session lifecycle adapter created for session: ${sessionId}`, "lifecycle");
  }

  /**
   * 초기화
   */
  initialize(server: McpServer, serverInfo: LifecycleInfo) {
    const currentState = this.getState();
    if (currentState !== LifecycleState.UNINITIALIZED) {
      logger.warning(`Session lifecycle already initialized in state: ${currentState} for session: ${this.sessionId}`, "lifecycle");
      return;
    }

    this.server = server;
    this.serverInfo = serverInfo;
    
    // 세션 매니저에 라이프사이클 상태 업데이트
    globalSessionManager.updateSession(this.sessionId, {
      lifecycleState: LifecycleState.INITIALIZING,
      protocolVersion: APP_CONFIG.protocol,
    });

    logger.info(
      {
        message: "Session lifecycle adapter initialized",
        sessionId: this.sessionId,
        state: LifecycleState.INITIALIZING,
        serverInfo,
      },
      "lifecycle"
    );
  }

  /**
   * 현재 라이프사이클 상태 조회
   */
  getState(): LifecycleState {
    const session = globalSessionManager.getSession(this.sessionId);
    return (session?.lifecycleState as LifecycleState) || LifecycleState.UNINITIALIZED;
  }

  /**
   * 세션 가동 시간 조회
   */
  getUptime(): number {
    const session = globalSessionManager.getSession(this.sessionId);
    if (!session) return 0;
    return Date.now() - session.createdAt;
  }

  /**
   * 운영 중인지 확인
   */
  isOperational(): boolean {
    return this.getState() === LifecycleState.OPERATING;
  }

  /**
   * 프로토콜 버전 조회
   */
  getProtocolVersion(): string {
    const session = globalSessionManager.getSession(this.sessionId);
    return session?.protocolVersion || APP_CONFIG.protocol;
  }

  /**
   * 클라이언트 정보 조회
   */
  getClientInfo(): LifecycleInfo | null {
    const session = globalSessionManager.getSession(this.sessionId);
    return session?.clientInfo || null;
  }

  /**
   * 서버 정보 조회
   */
  getServerInfo(): LifecycleInfo | null {
    return this.serverInfo;
  }

  /**
   * 종료 핸들러 등록
   */
  onShutdown(handler: () => Promise<void> | void) {
    this.shutdownHandlers.push(handler);
    
    logger.debug(
      {
        message: "Shutdown handler registered for session",
        sessionId: this.sessionId,
        handlerCount: this.shutdownHandlers.length,
      },
      "lifecycle"
    );
  }

  /**
   * 세션 종료
   */
  async shutdown(reason: string = "Session shutdown requested") {
    const currentState = this.getState();
    if (currentState === LifecycleState.SHUTTING_DOWN || currentState === LifecycleState.SHUTDOWN) {
      logger.warning(
        {
          message: "Session lifecycle already shutting down",
          sessionId: this.sessionId,
          currentState,
        },
        "lifecycle"
      );
      return;
    }

    logger.info(
      {
        message: "Starting session lifecycle shutdown",
        sessionId: this.sessionId,
        reason,
        state: currentState,
        uptime: this.getUptime(),
      },
      "lifecycle"
    );

    // 라이프사이클 상태 업데이트
    globalSessionManager.updateSession(this.sessionId, {
      lifecycleState: LifecycleState.SHUTTING_DOWN,
    });

    try {
      // 종료 핸들러 실행
      if (this.shutdownHandlers.length > 0) {
        const shutdownPromises = this.shutdownHandlers.map(async (handler, index) => {
          try {
            await Promise.resolve(handler());
            logger.debug(
              {
                message: "Session shutdown handler completed",
                sessionId: this.sessionId,
                handlerIndex: index,
              },
              "lifecycle"
            );
          } catch (error) {
            logger.warning(
              {
                message: "Session shutdown handler failed",
                sessionId: this.sessionId,
                handlerIndex: index,
                error: error instanceof Error ? error.message : String(error),
              },
              "lifecycle"
            );
          }
        });

        await Promise.all(shutdownPromises);
      }

      // 라이프사이클 상태를 종료로 변경
      globalSessionManager.updateSession(this.sessionId, {
        lifecycleState: LifecycleState.SHUTDOWN,
      });

      this.server = null;

      logger.info(
        {
          message: "Session lifecycle shutdown completed",
          sessionId: this.sessionId,
          state: LifecycleState.SHUTDOWN,
          totalUptime: this.getUptime(),
        },
        "lifecycle"
      );

      // 세션 매니저에서 세션 종료
      globalSessionManager.terminateSession(this.sessionId, reason);

    } catch (error) {
      logger.error(
        {
          message: "Session lifecycle shutdown failed",
          sessionId: this.sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        "lifecycle"
      );
      throw error;
    }
  }

  /**
   * 초기화 완료 표시
   */
  markInitialized() {
    const currentState = this.getState();
    if (currentState !== LifecycleState.INITIALIZING) {
      logger.warning(
        {
          message: "Cannot mark session as initialized - not in initializing state",
          sessionId: this.sessionId,
          currentState,
        },
        "lifecycle"
      );
      return;
    }

    globalSessionManager.updateSession(this.sessionId, {
      lifecycleState: LifecycleState.INITIALIZED,
    });
    
    logger.info(
      {
        message: "Session marked as initialized",
        sessionId: this.sessionId,
        state: LifecycleState.INITIALIZED,
      },
      "lifecycle"
    );
  }

  /**
   * 초기화 완료 후 운영 상태로 전환
   */
  markOperating() {
    globalSessionManager.updateSession(this.sessionId, {
      lifecycleState: LifecycleState.OPERATING,
    });
  }

  /**
   * 초기화 요청 처리
   */
  handleInitializeRequest(request: any): any {
    const currentState = this.getState();
    if (currentState === LifecycleState.SHUTTING_DOWN || currentState === LifecycleState.SHUTDOWN) {
      throw new Error("Session is shutting down");
    }

    logger.info(
      {
        message: "Session initialize request received",
        sessionId: this.sessionId,
        clientProtocolVersion: request.params.protocolVersion,
        clientCapabilities: request.params.capabilities,
        clientInfo: request.params.clientInfo,
      },
      "lifecycle"
    );

    // 버전 협상
    const requestedVersion = request.params.protocolVersion;
    const supportedVersion = this.getProtocolVersion();
    
    if (requestedVersion !== supportedVersion) {
      logger.warning(
        {
          message: "Protocol version mismatch for session",
          sessionId: this.sessionId,
          requested: requestedVersion,
          supported: supportedVersion,
        },
        "lifecycle"
      );

      throw new Error(`Unsupported protocol version. Server supports: ${supportedVersion}`);
    }

    // 클라이언트 정보 저장
    globalSessionManager.updateSession(this.sessionId, {
      clientInfo: request.params.clientInfo,
      capabilities: request.params.capabilities?.tools || [],
    });

    // 서버 capabilities 정의
    const serverCapabilities: LifecycleCapabilities = {
      prompts: {
        listChanged: true,
      },
      resources: {
        subscribe: true,
        listChanged: true,
      },
      tools: {
        listChanged: true,
      },
      logging: {},
      completions: {},
    };

    logger.info(
      {
        message: "Session initialize request processed successfully",
        sessionId: this.sessionId,
        negotiatedVersion: supportedVersion,
        clientCapabilities: request.params.capabilities,
        serverCapabilities,
      },
      "lifecycle"
    );

    // 초기화 완료 표시
    this.markInitialized();
    this.markOperating();

    return {
      protocolVersion: supportedVersion,
      capabilities: serverCapabilities,
      serverInfo: this.serverInfo,
      instructions: "MCP server ready for operation",
    };
  }

  /**
   * 세션 상태 조회
   */
  getSessionStatus() {
    const session = globalSessionManager.getSession(this.sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId: this.sessionId,
      state: this.getState(),
      uptime: this.getUptime(),
      protocolVersion: this.getProtocolVersion(),
      clientInfo: this.getClientInfo(),
      serverInfo: this.getServerInfo(),
      session: session,
    };
  }

  /**
   * 재설정 (테스트용)
   */
  reset() {
    globalSessionManager.updateSession(this.sessionId, {
      lifecycleState: LifecycleState.UNINITIALIZED,
      protocolVersion: APP_CONFIG.protocol,
      clientInfo: undefined,
    });
    
    this.server = null;
    this.shutdownHandlers = [];
    this.serverInfo = null;

    logger.debug(
      {
        message: "Session lifecycle adapter reset to initial state",
        sessionId: this.sessionId,
      },
      "lifecycle"
    );
  }
}

/**
 * 라이프사이클 어댑터 팩토리
 * SessionLifecycleManagerFactory를 대체합니다.
 */
export class LifecycleAdapterFactory {
  private static adapters = new Map<string, SessionLifecycleAdapter>();

  /**
   * 세션 라이프사이클 어댑터 가져오기 또는 생성
   */
  static getAdapter(sessionId: string): SessionLifecycleAdapter {
    let adapter = this.adapters.get(sessionId);
    
    if (!adapter) {
      adapter = new SessionLifecycleAdapter(sessionId);
      this.adapters.set(sessionId, adapter);
      
      logger.debug(
        {
          message: "Created new session lifecycle adapter",
          sessionId,
          totalAdapters: this.adapters.size,
        },
        "lifecycle"
      );
    }
    
    return adapter;
  }

  /**
   * 어댑터 제거
   */
  static removeAdapter(sessionId: string): void {
    const adapter = this.adapters.get(sessionId);
    if (adapter) {
      // 종료 처리
      adapter.shutdown("Session cleanup").catch(error => {
        logger.warning(
          {
            message: "Error during session lifecycle adapter shutdown",
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          "lifecycle"
        );
      });
      
      this.adapters.delete(sessionId);
      
      logger.debug(
        {
          message: "Removed session lifecycle adapter",
          sessionId,
          remainingAdapters: this.adapters.size,
        },
        "lifecycle"
      );
    }
  }

  /**
   * 모든 어댑터 가져오기
   */
  static getAllAdapters(): Map<string, SessionLifecycleAdapter> {
    return new Map(this.adapters);
  }

  /**
   * 통계 정보
   */
  static getStats() {
    const adapters = Array.from(this.adapters.values());
    const stats = {
      total: adapters.length,
      operational: 0,
      initializing: 0,
      initialized: 0,
      shuttingDown: 0,
      shutdown: 0,
    };

    for (const adapter of adapters) {
      const state = adapter.getState();
      switch (state) {
        case LifecycleState.OPERATING:
          stats.operational++;
          break;
        case LifecycleState.INITIALIZING:
          stats.initializing++;
          break;
        case LifecycleState.INITIALIZED:
          stats.initialized++;
          break;
        case LifecycleState.SHUTTING_DOWN:
          stats.shuttingDown++;
          break;
        case LifecycleState.SHUTDOWN:
          stats.shutdown++;
          break;
      }
    }

    return stats;
  }

  /**
   * 비활성 세션 정리
   */
  static cleanupInactiveSessions(maxInactiveTime: number = 30 * 60 * 1000): number {
    let cleanedCount = 0;

    for (const [sessionId, adapter] of this.adapters.entries()) {
      const uptime = adapter.getUptime();
      if (uptime > maxInactiveTime && !adapter.isOperational()) {
        this.removeAdapter(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(
        {
          message: "Cleaned up inactive session lifecycle adapters",
          cleanedCount,
          maxInactiveTime,
        },
        "lifecycle"
      );
    }

    return cleanedCount;
  }
}

/**
 * 기존 코드와의 호환성을 위한 별칭
 */
export const SessionLifecycleManager = SessionLifecycleAdapter;
export const SessionLifecycleManagerFactory = LifecycleAdapterFactory;