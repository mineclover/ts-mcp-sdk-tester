import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  lifecycleManager, 
  registerLifecycleManagement,
  getServerStatus,
  type LifecycleInfo,
  type LifecycleCapabilities 
} from "../standard/lifecycle.js";
import { logger } from "../standard/logger.js";

/**
 * MCP Lifecycle Demo
 * 
 * Demonstrates the complete MCP lifecycle according to specification:
 * https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
 * 
 * 1. Initialization - Protocol version negotiation and capability exchange
 * 2. Operation - Normal protocol communication
 * 3. Shutdown - Clean connection termination
 */

// Demo server configuration
const demoServerInfo: LifecycleInfo = {
  name: "demo-lifecycle-server",
  title: "Demo Lifecycle Server",
  version: "1.0.0"
};

// Demo server capabilities
const demoServerCapabilities: LifecycleCapabilities = {
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

/**
 * Create and configure demo MCP server
 */
function createDemoServer(): McpServer {
  const server = new McpServer({
    name: demoServerInfo.name,
    version: demoServerInfo.version,
  });

  // Register lifecycle management
  registerLifecycleManagement(server, demoServerInfo);

  // Add demo tools
  server.registerTool(
    "get_server_status",
    {
      title: "Get Server Status",
      description: "Get current server lifecycle status and information",
    },
    async () => {
      const status = getServerStatus();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(status, null, 2)
        }]
      };
    }
  );

  server.registerTool(
    "get_lifecycle_state",
    {
      title: "Get Lifecycle State",
      description: "Get current lifecycle state",
    },
    async () => {
      const state = lifecycleManager.getState();
      const uptime = lifecycleManager.getUptime();
      const isOperational = lifecycleManager.isOperational();
      
      return {
        content: [{
          type: "text",
          text: `Current State: ${state}\nUptime: ${uptime.toFixed(2)}s\nOperational: ${isOperational}`
        }]
      };
    }
  );

  server.registerTool(
    "get_capabilities",
    {
      title: "Get Capabilities",
      description: "Get negotiated client and server capabilities",
    },
    async () => {
      const clientCapabilities = lifecycleManager.getClientCapabilities();
      const serverCapabilities = lifecycleManager.getServerCapabilities();
      const protocolVersion = lifecycleManager.getProtocolVersion();
      
      return {
        content: [{
          type: "text",
          text: `Protocol Version: ${protocolVersion}\n\nClient Capabilities:\n${JSON.stringify(clientCapabilities, null, 2)}\n\nServer Capabilities:\n${JSON.stringify(serverCapabilities, null, 2)}`
        }]
      };
    }
  );

  server.registerTool(
    "get_client_info",
    {
      title: "Get Client Info",
      description: "Get client information from initialization",
    },
    async () => {
      const clientInfo = lifecycleManager.getClientInfo();
      const serverInfo = lifecycleManager.getServerInfo();
      
      return {
        content: [{
          type: "text",
          text: `Client Info:\n${JSON.stringify(clientInfo, null, 2)}\n\nServer Info:\n${JSON.stringify(serverInfo, null, 2)}`
        }]
      };
    }
  );

  // Add demo resources
  server.registerResource(
    "lifecycle_status",
    "lifecycle://status",
    {
      title: "Lifecycle Status",
      description: "Current lifecycle status and information",
      mimeType: "application/json"
    },
    async (uri) => {
      const status = getServerStatus();
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(status, null, 2)
        }]
      };
    }
  );

  server.registerResource(
    "lifecycle_capabilities",
    "lifecycle://capabilities",
    {
      title: "Lifecycle Capabilities",
      description: "Negotiated capabilities information",
      mimeType: "application/json"
    },
    async (uri) => {
      const capabilities = {
        client: lifecycleManager.getClientCapabilities(),
        server: lifecycleManager.getServerCapabilities(),
        protocolVersion: lifecycleManager.getProtocolVersion(),
      };
      
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(capabilities, null, 2)
        }]
      };
    }
  );

  // Add demo prompts
  server.registerPrompt(
    "lifecycle_status_prompt",
    {
      title: "Lifecycle Status Prompt",
      description: "Generate a prompt to check server lifecycle status",
    },
    () => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: "Please check the current lifecycle status of the MCP server and provide a summary of its operational state."
        }
      }]
    })
  );

  return server;
}

/**
 * Demo lifecycle event handlers
 */
function setupLifecycleEventHandlers() {
  // Register shutdown handlers
  lifecycleManager.onShutdown(async () => {
    logger.info("Demo server shutdown handler: Cleaning up demo resources", "demo.lifecycle");
    // Simulate cleanup work
    await new Promise(resolve => setTimeout(resolve, 100));
    logger.info("Demo server shutdown handler: Cleanup completed", "demo.lifecycle");
  });

  lifecycleManager.onShutdown(async () => {
    logger.info("Demo server shutdown handler: Saving final status", "demo.lifecycle");
    const finalStatus = getServerStatus();
    logger.info({
      message: "Final server status before shutdown",
      status: finalStatus
    }, "demo.lifecycle");
  });

  // Log lifecycle state changes
  const originalGetState = lifecycleManager.getState.bind(lifecycleManager);
  lifecycleManager.getState = function() {
    const state = originalGetState();
    logger.debug({
      message: "Lifecycle state accessed",
      currentState: state,
      uptime: lifecycleManager.getUptime()
    }, "demo.lifecycle");
    return state;
  };
}

/**
 * Demo initialization simulation
 */
function simulateClientInitialization() {
  logger.info("Simulating client initialization", "demo.lifecycle");
  
  // Simulate initialize request
  const mockInitializeRequest = {
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: {
          listChanged: true
        },
        sampling: {},
        elicitation: {}
      },
      clientInfo: {
        name: "DemoClient",
        title: "Demo Client",
        version: "1.0.0"
      }
    }
  };

  try {
    const response = lifecycleManager.handleInitializeRequest(mockInitializeRequest);
    logger.info({
      message: "Client initialization simulated successfully",
      response: response
    }, "demo.lifecycle");
  } catch (error) {
    logger.error({
      message: "Client initialization simulation failed",
      error: error instanceof Error ? error.message : String(error)
    }, "demo.lifecycle");
  }
}

/**
 * Demo operation simulation
 */
function simulateOperationPhase() {
  logger.info("Simulating operation phase", "demo.lifecycle");
  
  // Simulate some operations
  setTimeout(() => {
    if (lifecycleManager.isOperational()) {
      logger.info("Server is operational - simulating normal operations", "demo.lifecycle");
      
      // Simulate periodic status checks
      const statusCheck = setInterval(() => {
        const status = getServerStatus();
        logger.debug({
          message: "Periodic status check",
          uptime: status.uptime,
          state: status.state
        }, "demo.lifecycle");
        
        // Stop after 10 seconds
        if (status.uptime > 10) {
          clearInterval(statusCheck);
          logger.info("Operation phase simulation completed", "demo.lifecycle");
        }
      }, 1000);
    }
  }, 1000);
}

/**
 * Demo shutdown simulation
 */
function simulateGracefulShutdown() {
  logger.info("Simulating graceful shutdown", "demo.lifecycle");
  
  setTimeout(async () => {
    await lifecycleManager.shutdown("Demo shutdown simulation");
    logger.info("Graceful shutdown simulation completed", "demo.lifecycle");
  }, 5000);
}

/**
 * Main demo function
 */
async function runLifecycleDemo() {
  logger.info("Starting MCP Lifecycle Demo", "demo.lifecycle");
  
  try {
    // Setup lifecycle event handlers
    setupLifecycleEventHandlers();
    
    // Create demo server
    const server = createDemoServer();
    
    // Simulate client initialization
    simulateClientInitialization();
    
    // Simulate operation phase
    simulateOperationPhase();
    
    // Simulate graceful shutdown after 10 seconds
    simulateGracefulShutdown();
    
    // Connect to transport (for stdio demo)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info("Lifecycle demo server started successfully", "demo.lifecycle");
    
  } catch (error) {
    logger.error({
      message: "Lifecycle demo failed",
      error: error instanceof Error ? error.message : String(error)
    }, "demo.lifecycle");
  }
}

// Export for use in other modules
export {
  createDemoServer,
  setupLifecycleEventHandlers,
  simulateClientInitialization,
  simulateOperationPhase,
  simulateGracefulShutdown,
  runLifecycleDemo,
  demoServerInfo,
  demoServerCapabilities
};

// Run demo if this file is executed directly
if (import.meta.main) {
  runLifecycleDemo().catch(error => {
    console.error("Demo failed:", error);
    process.exit(1);
  });
} 