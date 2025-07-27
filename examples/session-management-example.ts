/**
 * 세션 관리 단일 책임 원칙 적용 예시
 * 
 * SessionManager를 사용하여 세션 관리를 중앙화합니다.
 */

import {
  // 세션 관리
  globalSessionManager,
  createAndActivateSession,
  withSession,
  
  // 엔드포인트 관련
  McpEndpointBase,
  executeMcpEndpoint,
  executeMcpTask,
  
  // 타입
  type SessionEvent,
} from "../standard/abstractions/index.js";

/**
 * 세션 이벤트 모니터링 설정
 */
function setupSessionMonitoring() {
  // 세션 이벤트 구독
  const unsubscribe = globalSessionManager.onSessionEvent((event: SessionEvent) => {
    switch (event.type) {
      case "created":
        console.log(`새 세션 생성: ${event.sessionId} (${event.clientType})`);
        break;
      case "activated":
        console.log(`세션 활성화: ${event.sessionId}`);
        break;
      case "terminated":
        console.log(`세션 종료: ${event.sessionId} - ${event.reason || "정상 종료"}`);
        break;
    }
  });

  // 주기적으로 비활성 세션 정리 (1시간마다)
  const cleanupInterval = setInterval(() => {
    const cleaned = globalSessionManager.cleanupInactiveSessions(3600000); // 1시간
    if (cleaned > 0) {
      console.log(`${cleaned}개의 비활성 세션이 정리되었습니다.`);
    }
  }, 3600000);

  return { unsubscribe, cleanupInterval };
}

/**
 * 세션 기반 엔드포인트 예시
 */
class SessionAwareToolsEndpoint extends McpEndpointBase {
  async listTools(request: any, extra: any) {
    // 세션 매니저가 자동으로 현재 세션 정보를 포함
    const context = this.createEndpointContext("tools/list", extra.requestId, "tools");
    
    return executeMcpEndpoint(
      context,
      async () => {
        // 현재 세션 정보 확인
        const currentSession = globalSessionManager.getActiveSession();
        console.log(`현재 세션: ${currentSession?.sessionId} (${currentSession?.clientType})`);
        
        // 도구 목록 반환
        return {
          tools: [
            { name: "calculator", description: "계산기" },
            { name: "weather", description: "날씨 조회" },
          ],
        };
      },
      request.params
    );
  }
}

/**
 * 다중 세션 처리 예시
 */
async function handleMultipleSessions() {
  // 여러 클라이언트의 세션 생성
  const claudeSession = createAndActivateSession("claude", "user_123");
  const vscodeSession = globalSessionManager.createSession("vscode", "user_456");
  const cursorSession = globalSessionManager.createSession("cursor", "user_789");

  console.log("\n=== 생성된 세션들 ===");
  globalSessionManager.getAllSessions().forEach(session => {
    console.log(`- ${session.sessionId}: ${session.clientType} (${session.userId})`);
  });

  // Claude 세션에서 작업 실행
  await withSession(claudeSession, async () => {
    console.log("\n=== Claude 세션에서 작업 실행 ===");
    await executeMcpTask("claude_task", async () => {
      console.log("Claude 전용 작업 수행 중...");
      return { result: "claude_result" };
    });
  });

  // VSCode 세션으로 전환
  await withSession(vscodeSession, async () => {
    console.log("\n=== VSCode 세션에서 작업 실행 ===");
    await executeMcpTask("vscode_task", async () => {
      console.log("VSCode 전용 작업 수행 중...");
      return { result: "vscode_result" };
    });
  });

  // 세션 통계 출력
  console.log("\n=== 세션 통계 ===");
  console.log(globalSessionManager.getStatistics());
}

/**
 * 세션별 권한 관리 예시
 */
class SessionBasedAuthExample {
  // 세션별 권한 저장
  private sessionPermissions = new Map<string, Set<string>>();

  /**
   * 세션에 권한 부여
   */
  grantPermission(sessionId: string, permission: string) {
    const session = globalSessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
    }

    if (!this.sessionPermissions.has(sessionId)) {
      this.sessionPermissions.set(sessionId, new Set());
    }
    
    this.sessionPermissions.get(sessionId)!.add(permission);
    
    // 세션 정보 업데이트
    globalSessionManager.updateSession(sessionId, {
      capabilities: [...session.capabilities, permission],
    });
  }

  /**
   * 현재 세션의 권한 확인
   */
  hasPermission(permission: string): boolean {
    const session = globalSessionManager.getActiveSession();
    if (!session) {
      return false;
    }

    const permissions = this.sessionPermissions.get(session.sessionId);
    return permissions?.has(permission) || false;
  }

  /**
   * 권한이 필요한 작업 실행
   */
  async executePrivilegedOperation(operation: string) {
    if (!this.hasPermission(`execute:${operation}`)) {
      const session = globalSessionManager.getActiveSession();
      throw new Error(
        `권한이 없습니다: ${operation} (세션: ${session?.sessionId || "없음"})`
      );
    }

    return executeMcpTask(`privileged_${operation}`, async () => {
      console.log(`권한이 확인된 작업 실행: ${operation}`);
      return { success: true };
    });
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log("=== 세션 관리 예시 시작 ===\n");

  // 세션 모니터링 설정
  const { unsubscribe, cleanupInterval } = setupSessionMonitoring();

  try {
    // 1. 기본 세션 생성 및 사용
    const sessionId = createAndActivateSession("example-client", "demo_user", ["tools", "resources"]);
    console.log(`\n생성된 세션 ID: ${sessionId}`);

    // 2. 엔드포인트에서 세션 사용
    const endpoint = new SessionAwareToolsEndpoint(sessionId);
    const toolsResult = await endpoint.listTools({ params: {} }, { requestId: "req_123" });
    console.log("\n도구 목록:", toolsResult);

    // 3. 다중 세션 처리
    await handleMultipleSessions();

    // 4. 세션 기반 권한 관리
    console.log("\n=== 세션 기반 권한 관리 ===");
    const auth = new SessionBasedAuthExample();
    
    // 현재 세션에 권한 부여
    const currentSession = globalSessionManager.getActiveSession()!;
    auth.grantPermission(currentSession.sessionId, "execute:sensitive-operation");
    
    // 권한이 있는 작업 실행
    await auth.executePrivilegedOperation("sensitive-operation");
    
    // 권한이 없는 작업 시도
    try {
      await auth.executePrivilegedOperation("unauthorized-operation");
    } catch (error) {
      console.log(`예상된 에러: ${error instanceof Error ? error.message : error}`);
    }

    // 5. 세션 종료
    globalSessionManager.terminateSession(sessionId, "데모 완료");

  } finally {
    // 정리
    unsubscribe();
    clearInterval(cleanupInterval);
  }

  console.log("\n=== 세션 관리 예시 완료 ===");
}

// 실행
if (import.meta.main) {
  main().catch(console.error);
}