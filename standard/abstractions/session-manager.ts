/**
 * MCP 세션 관리 전용 매니저
 * 
 * 세션의 생성, 관리, 추적을 단일 책임으로 담당합니다.
 * 프로토콜 테스트를 위한 메모리 효율적인 설계입니다.
 */

import { logger } from "../logger.js";
import type { McpEndpointContext } from "./logging-patterns.js";

/**
 * 세션 정보 인터페이스
 */
export interface SessionInfo {
  sessionId: string;
  clientType: string;
  userId?: string;
  capabilities: string[];
  createdAt: number;
  lastActiveAt: number;
  // Lifecycle 관련 추가 정보
  connectionId?: string;
  transportType?: "stdio" | "http" | "websocket";
  protocolVersion?: string;
  clientInfo?: {
    name: string;
    version: string;
    title?: string;
  };
  lifecycleState?: string;
}

/**
 * 세션 이벤트 타입
 */
export type SessionEvent = 
  | { type: "created"; sessionId: string; clientType: string }
  | { type: "activated"; sessionId: string }
  | { type: "updated"; sessionId: string; changes: Partial<SessionInfo> }
  | { type: "terminated"; sessionId: string; reason?: string };

/**
 * 세션 관리자 - 단일 책임으로 세션을 관리
 */
export class SessionManager {
  private sessions: Map<string, SessionInfo> = new Map();
  private activeSessionId?: string;
  private eventHandlers: ((event: SessionEvent) => void)[] = [];

  /**
   * 새 세션 생성
   */
  createSession(
    clientType: string,
    userId?: string,
    capabilities: string[] = []
  ): string {
    const traceId = logger.startOperation("session.create", {
      "session.client_type": clientType,
      "session.user_id": userId || "anonymous",
      "session.capabilities.count": capabilities.length,
      "session.capabilities": capabilities.join(","),
    });

    try {
      const timestamp = Date.now();
      const sessionId = `mcp_session_${userId || clientType}_${timestamp}`;
      
      const sessionInfo: SessionInfo = {
        sessionId,
        clientType,
        userId,
        capabilities,
        createdAt: timestamp,
        lastActiveAt: timestamp,
      };

      this.sessions.set(sessionId, sessionInfo);
      this.notifyEvent({ type: "created", sessionId, clientType });
      
      logger.info(`Session created: ${sessionId}`, "session", {
        clientType,
        userId,
        capabilities,
      });

      if (traceId) {
        logger.endOperation(traceId, {
          "session.id": sessionId,
          "session.created_at": timestamp,
          "session.success": true,
        });
      }

      return sessionId;
    } catch (error) {
      if (traceId) {
        logger.endOperation(traceId, {
          "session.success": false,
          "session.error": error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  /**
   * 세션 활성화
   */
  activateSession(sessionId: string): boolean {
    const traceId = logger.startOperation("session.activate", {
      "session.id": sessionId,
      "session.previous_active": this.activeSessionId || "none",
    });

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        logger.warning(`Attempted to activate non-existent session: ${sessionId}`, "session");
        
        if (traceId) {
          logger.endOperation(traceId, {
            "session.success": false,
            "session.error": "session_not_found",
          });
        }
        return false;
      }

      const previousActiveId = this.activeSessionId;
      this.activeSessionId = sessionId;
      session.lastActiveAt = Date.now();
      
      // logger에 세션 컨텍스트 설정
      logger.setSessionContext(sessionId);
      
      this.notifyEvent({ type: "activated", sessionId });
      logger.debug(`Session activated: ${sessionId}`, "session");
      
      if (traceId) {
        logger.endOperation(traceId, {
          "session.success": true,
          "session.client_type": session.clientType,
          "session.user_id": session.userId || "anonymous",
          "session.last_active_at": session.lastActiveAt,
          "session.previous_active_id": previousActiveId || "none",
        });
      }
      
      return true;
    } catch (error) {
      if (traceId) {
        logger.endOperation(traceId, {
          "session.success": false,
          "session.error": error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  /**
   * 현재 활성 세션 정보 조회
   */
  getActiveSession(): SessionInfo | undefined {
    if (!this.activeSessionId) {
      return undefined;
    }
    return this.sessions.get(this.activeSessionId);
  }

  /**
   * 특정 세션 정보 조회
   */
  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 세션 정보 업데이트
   */
  updateSession(sessionId: string, updates: Partial<SessionInfo>): boolean {
    const traceId = logger.startOperation("session.update", {
      "session.id": sessionId,
      "session.update_fields": Object.keys(updates).join(","),
    });

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        logger.warning(`Attempted to update non-existent session: ${sessionId}`, "session");
        
        if (traceId) {
          logger.endOperation(traceId, {
            "session.success": false,
            "session.error": "session_not_found",
          });
        }
        return false;
      }

      const previousState = { ...session };
      Object.assign(session, updates, {
        lastActiveAt: Date.now(),
      });

      this.notifyEvent({ type: "updated", sessionId, changes: updates });
      logger.debug(`Session updated: ${sessionId}`, "session", updates);
      
      if (traceId) {
        logger.endOperation(traceId, {
          "session.success": true,
          "session.updates": JSON.stringify(updates),
          "session.last_active_at": session.lastActiveAt,
        });
      }
      
      return true;
    } catch (error) {
      if (traceId) {
        logger.endOperation(traceId, {
          "session.success": false,
          "session.error": error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  /**
   * 세션 종료
   */
  terminateSession(sessionId: string, reason?: string): boolean {
    const traceId = logger.startOperation("session.terminate", {
      "session.id": sessionId,
      "session.termination_reason": reason || "unspecified",
      "session.was_active": this.activeSessionId === sessionId,
    });

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        if (traceId) {
          logger.endOperation(traceId, {
            "session.success": false,
            "session.error": "session_not_found",
          });
        }
        return false;
      }

      const sessionLifetime = Date.now() - session.createdAt;
      const wasActive = this.activeSessionId === sessionId;

      this.sessions.delete(sessionId);
      
      if (this.activeSessionId === sessionId) {
        this.activeSessionId = undefined;
      }

      this.notifyEvent({ type: "terminated", sessionId, reason });
      logger.info(`Session terminated: ${sessionId}`, "session", { reason });
      
      if (traceId) {
        logger.endOperation(traceId, {
          "session.success": true,
          "session.lifetime_ms": sessionLifetime,
          "session.client_type": session.clientType,
          "session.user_id": session.userId || "anonymous",
          "session.was_active": wasActive,
          "session.remaining_sessions": this.sessions.size,
        });
      }
      
      return true;
    } catch (error) {
      if (traceId) {
        logger.endOperation(traceId, {
          "session.success": false,
          "session.error": error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  /**
   * 엔드포인트 컨텍스트 생성 (세션 정보 포함)
   */
  createEndpointContext(
    endpoint: string,
    requestId: string,
    category: string = "mcp"
  ): McpEndpointContext {
    const session = this.getActiveSession();
    
    return {
      endpoint,
      requestId,
      category,
      sessionId: session?.sessionId,
      userId: session?.userId,
      clientType: session?.clientType,
    };
  }

  /**
   * 로그 데이터에 세션 정보 추가
   */
  enrichLogData(data: Record<string, unknown>): Record<string, unknown> {
    const session = this.getActiveSession();
    if (!session) {
      return data;
    }

    return {
      ...data,
      sessionId: session.sessionId,
      clientType: session.clientType,
      userId: session.userId,
      capabilities: session.capabilities,
    };
  }

  /**
   * 이벤트 핸들러 등록
   */
  onSessionEvent(handler: (event: SessionEvent) => void): () => void {
    this.eventHandlers.push(handler);
    
    // 구독 해제 함수 반환
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index >= 0) {
        this.eventHandlers.splice(index, 1);
      }
    };
  }

  /**
   * 모든 세션 정보 조회 (디버깅/모니터링용)
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 오래된 세션 정리 (메모리 효율성)
   */
  cleanupInactiveSessions(maxInactiveMs: number = 3600000): number {
    const traceId = logger.startOperation("session.cleanup", {
      "session.cleanup.max_inactive_ms": maxInactiveMs,
      "session.cleanup.total_sessions": this.sessions.size,
    });

    try {
      const now = Date.now();
      let cleanedCount = 0;
      const inactiveSessions: string[] = [];

      for (const [sessionId, session] of this.sessions.entries()) {
        if (now - session.lastActiveAt > maxInactiveMs) {
          inactiveSessions.push(sessionId);
          this.terminateSession(sessionId, "inactive");
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} inactive sessions`, "session");
      }

      if (traceId) {
        logger.endOperation(traceId, {
          "session.cleanup.success": true,
          "session.cleanup.cleaned_count": cleanedCount,
          "session.cleanup.remaining_sessions": this.sessions.size,
          "session.cleanup.inactive_sessions": inactiveSessions.join(","),
        });
      }

      return cleanedCount;
    } catch (error) {
      if (traceId) {
        logger.endOperation(traceId, {
          "session.cleanup.success": false,
          "session.cleanup.error": error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  /**
   * 세션 통계 조회
   */
  getStatistics() {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => now - s.lastActiveAt < 300000).length, // 5분 이내 활동
      clientTypes: sessions.reduce((acc, s) => {
        acc[s.clientType] = (acc[s.clientType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      averageSessionDuration: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (s.lastActiveAt - s.createdAt), 0) / sessions.length
        : 0,
    };
  }

  private notifyEvent(event: SessionEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error("Session event handler error", "session", {
          event,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

/**
 * 전역 세션 매니저 인스턴스
 */
export const globalSessionManager = new SessionManager();

/**
 * 편의 함수: 새 세션 생성 및 활성화
 */
export function createAndActivateSession(
  clientType: string,
  userId?: string,
  capabilities: string[] = []
): string {
  const sessionId = globalSessionManager.createSession(clientType, userId, capabilities);
  globalSessionManager.activateSession(sessionId);
  return sessionId;
}

/**
 * 편의 함수: 현재 세션 컨텍스트로 함수 실행
 */
export async function withSession<T>(
  sessionId: string,
  task: () => Promise<T>
): Promise<T> {
  const traceId = logger.startOperation("session.with_session", {
    "session.target_id": sessionId,
    "session.current_active_id": globalSessionManager.getActiveSession()?.sessionId || "none",
  });

  const previousSessionId = globalSessionManager.getActiveSession()?.sessionId;
  
  try {
    globalSessionManager.activateSession(sessionId);
    const result = await task();
    
    if (traceId) {
      logger.endOperation(traceId, {
        "session.success": true,
        "session.task_completed": true,
        "session.restored_to": previousSessionId || "none",
      });
    }
    
    return result;
  } catch (error) {
    if (traceId) {
      logger.endOperation(traceId, {
        "session.success": false,
        "session.task_error": error instanceof Error ? error.message : String(error),
        "session.restored_to": previousSessionId || "none",
      });
    }
    throw error;
  } finally {
    // 이전 세션으로 복원
    if (previousSessionId && previousSessionId !== sessionId) {
      globalSessionManager.activateSession(previousSessionId);
    }
  }
}