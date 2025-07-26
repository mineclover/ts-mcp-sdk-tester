import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const HealthCheckSchema = z.object({
  includeDetailedChecks: z.boolean().default(true).describe("Include detailed health checks"),
  checkRegistrations: z.boolean().default(true).describe("Validate all registrations"),
  checkMemory: z.boolean().default(true).describe("Check memory usage"),
});

interface HealthCheckResult {
  status: "healthy" | "warning" | "unhealthy";
  message: string;
  details?: any;
}

export function registerHealthCheck(server: McpServer) {
  server.tool(
    "health_check",
    "Perform comprehensive server health assessment and diagnostics",
    {
      type: "object",
      properties: {
        includeDetailedChecks: {
          type: "boolean",
          description: "Include detailed health checks",
          default: true,
        },
        checkRegistrations: {
          type: "boolean",
          description: "Validate all registrations",
          default: true,
        },
        checkMemory: {
          type: "boolean",
          description: "Check memory usage",
          default: true,
        },
      },
    },
    async (args) => {
      try {
        const params = HealthCheckSchema.parse(args);
        
        const healthReport: any = {
          timestamp: new Date().toISOString(),
          overallStatus: "healthy",
          checks: {},
          summary: {
            totalChecks: 0,
            passed: 0,
            warnings: 0,
            failed: 0,
          },
        };

        const checks: HealthCheckResult[] = [];

        // Basic connectivity check
        const isConnected = server.isConnected();
        checks.push({
          status: isConnected ? "healthy" : "unhealthy",
          message: `Server connection: ${isConnected ? "Connected" : "Disconnected"}`,
        });

        // Memory check
        if (params.checkMemory) {
          const memoryUsage = process.memoryUsage();
          const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
          const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
          const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
          
          let memoryStatus: "healthy" | "warning" | "unhealthy" = "healthy";
          if (heapUsagePercent > 90) {
            memoryStatus = "unhealthy";
          } else if (heapUsagePercent > 75) {
            memoryStatus = "warning";
          }
          
          checks.push({
            status: memoryStatus,
            message: `Memory usage: ${heapUsedMB.toFixed(1)}MB / ${heapTotalMB.toFixed(1)}MB (${heapUsagePercent.toFixed(1)}%)`,
            details: {
              heapUsedMB: heapUsedMB.toFixed(1),
              heapTotalMB: heapTotalMB.toFixed(1),
              heapUsagePercent: heapUsagePercent.toFixed(1),
              rss: (memoryUsage.rss / 1024 / 1024).toFixed(1) + 'MB',
              external: (memoryUsage.external / 1024 / 1024).toFixed(1) + 'MB',
            },
          });
        }

        // Process health check
        if (params.includeDetailedChecks) {
          const uptime = process.uptime();
          checks.push({
            status: "healthy",
            message: `Process uptime: ${Math.round(uptime)}s`,
            details: {
              pid: process.pid,
              nodeVersion: process.version,
              platform: process.platform,
              arch: process.arch,
              uptimeSeconds: Math.round(uptime),
            },
          });
        }

        // Registration validation check
        if (params.checkRegistrations) {
          const serverAny = server as any;
          const toolsCount = (serverAny._registeredTools || new Map()).size;
          const resourcesCount = (serverAny._registeredResources || new Map()).size;
          const promptsCount = (serverAny._registeredPrompts || new Map()).size;
          const resourceTemplatesCount = (serverAny._registeredResourceTemplates || new Map()).size;
          const totalRegistrations = toolsCount + resourcesCount + promptsCount + resourceTemplatesCount;
          
          let registrationStatus: "healthy" | "warning" | "unhealthy" = "healthy";
          if (totalRegistrations === 0) {
            registrationStatus = "warning";
          }
          
          checks.push({
            status: registrationStatus,
            message: `Registrations: ${totalRegistrations} total (${toolsCount} tools, ${resourcesCount} resources, ${promptsCount} prompts, ${resourceTemplatesCount} templates)`,
            details: {
              totalRegistrations,
              toolsCount,
              resourcesCount,
              promptsCount,
              resourceTemplatesCount,
            },
          });
        }

        // Transport check
        if (params.includeDetailedChecks) {
          const serverAny = server as any;
          const transport = serverAny._transport;
          const hasTransport = !!transport;
          
          checks.push({
            status: hasTransport ? "healthy" : "warning",
            message: `Transport: ${hasTransport ? "Available" : "Not available"}`,
            details: {
              hasTransport,
              transportType: transport?.constructor?.name || "unknown",
            },
          });
        }

        // Calculate overall status
        const healthyCount = checks.filter(c => c.status === "healthy").length;
        const warningCount = checks.filter(c => c.status === "warning").length;
        const unhealthyCount = checks.filter(c => c.status === "unhealthy").length;

        healthReport.summary = {
          totalChecks: checks.length,
          passed: healthyCount,
          warnings: warningCount,
          failed: unhealthyCount,
        };

        // Determine overall status
        if (unhealthyCount > 0) {
          healthReport.overallStatus = "unhealthy";
        } else if (warningCount > 0) {
          healthReport.overallStatus = "warning";
        } else {
          healthReport.overallStatus = "healthy";
        }

        healthReport.checks = checks;

        const statusIcon = {
          healthy: "✅",
          warning: "⚠️",
          unhealthy: "❌",
        };

        return {
          content: [
            {
              type: "text" as const,
              text: `${statusIcon[healthReport.overallStatus as keyof typeof statusIcon]} Health Check Results:\n` +
                    `- Overall Status: ${healthReport.overallStatus.toUpperCase()}\n` +
                    `- Checks Passed: ${healthyCount}/${checks.length}\n` +
                    `- Warnings: ${warningCount}\n` +
                    `- Failed: ${unhealthyCount}\n\n` +
                    checks.map(check => `${statusIcon[check.status]} ${check.message}`).join('\n'),
            },
          ],
          structuredContent: healthReport,
          isError: healthReport.overallStatus === "unhealthy",
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error during health check: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}