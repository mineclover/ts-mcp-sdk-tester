#!/usr/bin/env bun

/**
 * Session Lifecycle Demo
 * 
 * Demonstrates session isolation in MCP lifecycle management
 * Shows how multiple user sessions can have independent lifecycle states
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  SessionLifecycleManagerFactory, 
  SessionLifecycleManager,
  LifecycleManager,
  type LifecycleInfo 
} from "../standard/lifecycle.js";
import { logger } from "../standard/logger.js";
import { SessionManager } from "../standard/otel-session.js";

// Demo server configuration
const demoServerInfo: LifecycleInfo = {
  name: "session-lifecycle-demo",
  title: "Session Lifecycle Demo Server",
  version: "1.0.0",
};



/**
 * Create demo server with session lifecycle support
 */
function createDemoServer(): McpServer {
  const server = new McpServer({
    name: demoServerInfo.name,
    version: demoServerInfo.version,
  });

  // Register session lifecycle management
  registerSessionLifecycleManagement(server);

  // Add demo tools for session management
  server.registerTool(
    "get_session_status",
    {
      title: "Get Session Status",
      description: "Get current session lifecycle status",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: "Session status tool - use with session context",
        },
      ],
    })
  );

  server.registerTool(
    "get_all_sessions",
    {
      title: "Get All Sessions",
      description: "Get statistics for all active sessions",
    },
    async () => {
      const stats = SessionLifecycleManagerFactory.getSessionLifecycleStats();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    }
  );

  // Add demo resources
  server.registerResource(
    "session_status",
    "session://status",
    {
      title: "Session Status Resource",
      description: "Current session lifecycle status",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: "Session status resource - use with session context",
        },
      ],
    })
  );

  return server;
}

/**
 * Register session lifecycle management with server
 */
function registerSessionLifecycleManagement(server: McpServer) {
  // Register session-specific tools
  server.registerTool(
    "get_session_lifecycle_state",
    {
      title: "Get Session Lifecycle State",
      description: "Get current session lifecycle state",
    },
    async (params, context) => {
      const sessionId = context?.sessionId;
      if (!sessionId) {
        return {
          content: [
            {
              type: "text",
              text: "No session context available",
            },
          ],
        };
      }

      const sessionManager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      const status = sessionManager.getSessionStatus();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    }
  );

  // Register session cleanup tool
  server.registerTool(
    "cleanup_inactive_sessions",
    {
      title: "Cleanup Inactive Sessions",
      description: "Remove inactive session lifecycle managers",
    },
    async () => {
      const cleanedCount = SessionLifecycleManagerFactory.cleanupInactiveSessions();
      return {
        content: [
          {
            type: "text",
            text: `Cleaned up ${cleanedCount} inactive sessions`,
          },
        ],
      };
    }
  );
}

/**
 * Setup session lifecycle event handlers
 */
function setupSessionLifecycleEventHandlers() {
  // Override session lifecycle manager getState for logging
  const originalGetState = SessionLifecycleManager.prototype.getState;
  SessionLifecycleManager.prototype.getState = function() {
    const state = originalGetState.call(this);
    logger.debug(
      {
        message: "Session lifecycle state accessed",
        sessionId: (this as any).sessionId,
        state,
      },
      "lifecycle"
    );
    return state;
  };
}

/**
 * Simulate multiple user sessions
 */
async function simulateMultipleSessions() {
  console.log("🔄 Simulating multiple user sessions...\n");

  const sessionIds = [
    "user_session_1",
    "user_session_2", 
    "user_session_3",
  ];

  const sessionManagers: SessionLifecycleManager[] = [];

  // Create session lifecycle managers for each user
  for (const sessionId of sessionIds) {
    console.log(`👤 Creating session lifecycle manager for: ${sessionId}`);
    
    const sessionManager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
    sessionManagers.push(sessionManager);

    // Initialize session lifecycle manager
    const mockServer = {} as McpServer;
    sessionManager.initialize(mockServer, demoServerInfo);

    // Simulate client initialization
    const mockRequest = {
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true },
          prompts: { listChanged: true },
        },
        clientInfo: {
          name: `client-${sessionId}`,
          version: "1.0.0",
        },
      },
    };

    try {
      const response = sessionManager.handleInitializeRequest(mockRequest);
      console.log(`✅ Session ${sessionId} initialized successfully`);
      console.log(`   Protocol Version: ${response.protocolVersion}`);
      console.log(`   Client Info: ${response.serverInfo?.name}`);
    } catch (error) {
      console.log(`❌ Session ${sessionId} initialization failed: ${error}`);
    }
  }

  // Show session statistics
  console.log("\n📊 Session Lifecycle Statistics:");
  const stats = SessionLifecycleManagerFactory.getSessionLifecycleStats();
  console.log(JSON.stringify(stats, null, 2));

  // Simulate session operations
  console.log("\n🔄 Simulating session operations...");
  
  for (let i = 0; i < sessionManagers.length; i++) {
    const manager = sessionManagers[i];
    const sessionId = sessionIds[i];
    
    console.log(`\n📝 Session ${sessionId} operations:`);
    console.log(`   State: ${manager.getState()}`);
    console.log(`   Uptime: ${manager.getUptime()}ms`);
    console.log(`   Operational: ${manager.isOperational()}`);
    console.log(`   Protocol Version: ${manager.getProtocolVersion()}`);
    
    // Simulate some session-specific operations
    const clientInfo = manager.getClientInfo();
    const serverInfo = manager.getServerInfo();
    console.log(`   Client: ${clientInfo?.name || 'Unknown'}`);
    console.log(`   Server: ${serverInfo?.name || 'Unknown'}`);
  }

  // Simulate session shutdown
  console.log("\n🔄 Simulating session shutdown...");
  
  for (let i = 0; i < sessionManagers.length; i++) {
    const manager = sessionManagers[i];
    const sessionId = sessionIds[i];
    
    console.log(`\n🛑 Shutting down session: ${sessionId}`);
    await manager.shutdown("Demo session cleanup");
    console.log(`   Final state: ${manager.getState()}`);
  }

  // Show final statistics
  console.log("\n📊 Final Session Statistics:");
  const finalStats = SessionLifecycleManagerFactory.getSessionLifecycleStats();
  console.log(JSON.stringify(finalStats, null, 2));
}

/**
 * Simulate session isolation scenarios
 */
async function simulateSessionIsolation() {
  console.log("\n🔒 Simulating session isolation scenarios...\n");

  // Scenario 1: Different protocol versions
  console.log("📋 Scenario 1: Protocol Version Mismatch");
  
  const session1 = SessionLifecycleManagerFactory.getSessionLifecycleManager("isolation_test_1");
  const mockServer1 = {} as McpServer;
  session1.initialize(mockServer1, demoServerInfo);

  try {
    const incompatibleRequest = {
      params: {
        protocolVersion: "2023-01-01", // Old version
        capabilities: {},
        clientInfo: { name: "old-client", version: "1.0.0" },
      },
    };

    session1.handleInitializeRequest(incompatibleRequest);
    console.log("❌ Should have failed with version mismatch");
  } catch (error) {
    console.log(`✅ Correctly rejected incompatible version: ${error}`);
  }

  // Scenario 2: Concurrent session operations
  console.log("\n📋 Scenario 2: Concurrent Session Operations");
  
  const session2 = SessionLifecycleManagerFactory.getSessionLifecycleManager("isolation_test_2");
  const session3 = SessionLifecycleManagerFactory.getSessionLifecycleManager("isolation_test_3");
  
  const mockServer2 = {} as McpServer;
  const mockServer3 = {} as McpServer;
  
  session2.initialize(mockServer2, demoServerInfo);
  session3.initialize(mockServer3, demoServerInfo);

  // Both sessions should be independent
  console.log(`Session 2 state: ${session2.getState()}`);
  console.log(`Session 3 state: ${session3.getState()}`);
  
  // Shutdown one session, other should remain unaffected
  await session2.shutdown("Test shutdown");
  console.log(`Session 2 state after shutdown: ${session2.getState()}`);
  console.log(`Session 3 state after session 2 shutdown: ${session3.getState()}`);

  // Scenario 3: Session cleanup
  console.log("\n📋 Scenario 3: Session Cleanup");
  
  const allManagers = SessionLifecycleManagerFactory.getAllSessionLifecycleManagers();
  console.log(`Total session managers before cleanup: ${allManagers.size}`);
  
  // Cleanup inactive sessions
  const cleanedCount = SessionLifecycleManagerFactory.cleanupInactiveSessions(0); // Force cleanup
  console.log(`Cleaned up ${cleanedCount} sessions`);
  
  const remainingManagers = SessionLifecycleManagerFactory.getAllSessionLifecycleManagers();
  console.log(`Total session managers after cleanup: ${remainingManagers.size}`);
}

/**
 * Run session lifecycle demo
 */
async function runSessionLifecycleDemo() {
  console.log("🚀 Starting Session Lifecycle Demo\n");
  console.log("=" * 50);
  console.log("Session Lifecycle Management Demo");
  console.log("=" * 50);

  try {
    // Setup event handlers
    setupSessionLifecycleEventHandlers();

    // Create demo server
    console.log("\n🔧 Creating demo server...");
    createDemoServer();
    console.log("✅ Demo server created");

    // Simulate multiple sessions
    await simulateMultipleSessions();

    // Simulate session isolation
    await simulateSessionIsolation();

    console.log("\n✅ Session lifecycle demo completed successfully!");
    
    // Show final server status
    const stats = SessionLifecycleManagerFactory.getSessionLifecycleStats();
    console.log("\n📊 Final Server Status:");
    console.log(JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error("❌ Session lifecycle demo failed:", error);
    process.exit(1);
  }
}

// Run the demo if this file is executed directly
if (import.meta.main) {
  runSessionLifecycleDemo().catch(console.error);
}

export {
  createDemoServer,
  registerSessionLifecycleManagement,
  setupSessionLifecycleEventHandlers,
  simulateMultipleSessions,
  simulateSessionIsolation,
  runSessionLifecycleDemo,
}; 