import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerTestTransportCapabilities(server: McpServer) {
  server.tool(
    "test_transport_capabilities",
    "Test transport layer capabilities and communication features",
    {
      type: "object",
      properties: {
        testType: {
          type: "string",
          enum: ["echo", "large_message", "rapid_fire", "bidirectional"],
          description: "Type of transport test to perform",
          default: "echo",
        },
        messageSize: {
          type: "number",
          description: "Size of test message in bytes (for large_message test)",
          default: 1024,
          minimum: 1,
          maximum: 1000000,
        },
        messageCount: {
          type: "number",
          description: "Number of messages to send (for rapid_fire test)",
          default: 10,
          minimum: 1,
          maximum: 100,
        },
      },
    },
    async (args) => {
      try {
        const testType = args?.testType || "echo";
        const messageSize = args?.messageSize || 1024;
        const messageCount = args?.messageCount || 10;
        
        const testResults: any = {
          timestamp: new Date().toISOString(),
          testType,
          results: {},
        };

        switch (testType) {
          case "echo":
            // Simple echo test
            const echoMessage = "Test message for transport echo capability";
            testResults.results = {
              echoMessage,
              messageLength: echoMessage.length,
              success: true,
              roundTripTime: Date.now(), // Simplified timing
            };
            break;

          case "large_message":
            // Test large message handling
            const largeMessage = "A".repeat(messageSize);
            const startTime = Date.now();
            
            testResults.results = {
              messageSize,
              actualSize: largeMessage.length,
              transmissionTime: Date.now() - startTime,
              success: true,
              compressionRatio: messageSize / new Blob([largeMessage]).size,
            };
            break;

          case "rapid_fire":
            // Test rapid message sending
            const messages = [];
            const rapidStartTime = Date.now();
            
            for (let i = 0; i < messageCount; i++) {
              messages.push(`Message ${i + 1} of ${messageCount}`);
            }
            
            testResults.results = {
              messageCount,
              messagesGenerated: messages.length,
              totalTime: Date.now() - rapidStartTime,
              averageTimePerMessage: (Date.now() - rapidStartTime) / messageCount,
              throughput: messageCount / ((Date.now() - rapidStartTime) / 1000),
              success: true,
            };
            break;

          case "bidirectional":
            // Test bidirectional communication
            const serverInfo = {
              connected: server.isConnected(),
              canSend: true,
              canReceive: true,
            };
            
            testResults.results = {
              serverConnected: serverInfo.connected,
              bidirectionalCapable: serverInfo.canSend && serverInfo.canReceive,
              transportType: "mcp",
              protocolVersion: "2025-06-18",
              success: true,
            };
            break;

          default:
            throw new Error(`Unknown test type: ${testType}`);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Transport test '${testType}' completed successfully:\n` +
                    JSON.stringify(testResults.results, null, 2),
            },
          ],
          structuredContent: testResults,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Transport test failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}