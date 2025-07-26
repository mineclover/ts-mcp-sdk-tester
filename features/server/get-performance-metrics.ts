import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Simple performance tracking state
let performanceState = {
  startTime: Date.now(),
  requestCount: 0,
  lastRequestTime: 0,
  totalResponseTime: 0,
  errors: 0,
  requestsByType: new Map<string, number>(),
  responseTimesByType: new Map<string, number[]>(),
};

export function registerGetPerformanceMetrics(server: McpServer) {
  server.tool(
    "get_performance_metrics",
    "Get performance metrics and statistics about server operation",
    {
      type: "object",
      properties: {
        reset: {
          type: "boolean",
          description: "Reset metrics after reading",
          default: false,
        },
        includeBreakdown: {
          type: "boolean",
          description: "Include detailed breakdown by request type",
          default: true,
        },
      },
    },
    async (args) => {
      try {
        const reset = args?.reset === true;
        const includeBreakdown = args?.includeBreakdown !== false;
        
        const now = Date.now();
        const uptimeMs = now - performanceState.startTime;
        const uptimeSeconds = Math.round(uptimeMs / 1000);
        
        // Get memory usage
        const memoryUsage = process.memoryUsage();
        
        // Calculate average response time
        const avgResponseTime = performanceState.requestCount > 0 
          ? Math.round(performanceState.totalResponseTime / performanceState.requestCount)
          : 0;
        
        // Calculate requests per second
        const requestsPerSecond = uptimeSeconds > 0 
          ? (performanceState.requestCount / uptimeSeconds).toFixed(2)
          : "0";

        const metrics: any = {
          timestamp: new Date().toISOString(),
          uptime: {
            milliseconds: uptimeMs,
            seconds: uptimeSeconds,
            formatted: formatUptime(uptimeSeconds),
          },
          requests: {
            total: performanceState.requestCount,
            errors: performanceState.errors,
            successRate: performanceState.requestCount > 0 
              ? ((performanceState.requestCount - performanceState.errors) / performanceState.requestCount * 100).toFixed(2) + '%'
              : '100%',
            requestsPerSecond: parseFloat(requestsPerSecond),
          },
          performance: {
            averageResponseTimeMs: avgResponseTime,
            lastRequestTime: performanceState.lastRequestTime ? new Date(performanceState.lastRequestTime).toISOString() : null,
            timeSinceLastRequest: performanceState.lastRequestTime ? now - performanceState.lastRequestTime : null,
          },
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB',
            arrayBuffers: Math.round((memoryUsage as any).arrayBuffers / 1024 / 1024) + ' MB',
          },
          system: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
          },
        };

        if (includeBreakdown) {
          metrics.breakdown = {
            requestsByType: Object.fromEntries(performanceState.requestsByType),
            responseTimeStats: Object.fromEntries(
              Array.from(performanceState.responseTimesByType.entries()).map(([type, times]) => [
                type,
                {
                  count: times.length,
                  average: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
                  min: times.length > 0 ? Math.min(...times) : 0,
                  max: times.length > 0 ? Math.max(...times) : 0,
                }
              ])
            ),
          };
        }

        // Reset metrics if requested
        if (reset) {
          performanceState = {
            startTime: now,
            requestCount: 0,
            lastRequestTime: 0,
            totalResponseTime: 0,
            errors: 0,
            requestsByType: new Map(),
            responseTimesByType: new Map(),
          };
          metrics.metricsReset = true;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Performance Metrics:\n` +
                    `- Uptime: ${metrics.uptime.formatted}\n` +
                    `- Total Requests: ${metrics.requests.total}\n` +
                    `- Success Rate: ${metrics.requests.successRate}\n` +
                    `- Avg Response Time: ${metrics.performance.averageResponseTimeMs}ms\n` +
                    `- Requests/sec: ${metrics.requests.requestsPerSecond}\n` +
                    `- Memory (Heap): ${metrics.memory.heapUsed}`,
            },
          ],
          structuredContent: metrics,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting performance metrics: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

// Helper function to track requests (to be called from other tools)
export function trackRequest(type: string, responseTime: number, isError: boolean = false) {
  performanceState.requestCount++;
  performanceState.lastRequestTime = Date.now();
  performanceState.totalResponseTime += responseTime;
  
  if (isError) {
    performanceState.errors++;
  }
  
  // Track by type
  performanceState.requestsByType.set(type, (performanceState.requestsByType.get(type) || 0) + 1);
  
  if (!performanceState.responseTimesByType.has(type)) {
    performanceState.responseTimesByType.set(type, []);
  }
  performanceState.responseTimesByType.get(type)!.push(responseTime);
  
  // Keep only last 100 response times per type to prevent memory leak
  const times = performanceState.responseTimesByType.get(type)!;
  if (times.length > 100) {
    times.splice(0, times.length - 100);
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}