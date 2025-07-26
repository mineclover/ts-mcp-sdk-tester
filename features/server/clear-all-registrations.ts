import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const ClearAllRegistrationsSchema = z.object({
  registryType: z.enum(["all", "tools", "resources", "prompts", "resourceTemplates"])
    .default("all")
    .describe("Type of registry to clear"),
  confirm: z.boolean().default(false).describe("Confirmation required to prevent accidental clearing"),
});

export function registerClearAllRegistrations(server: McpServer) {
  server.tool(
    "clear_all_registrations",
    "Clear all registrations from the server for testing isolation. Requires confirmation.",
    {
      type: "object",
      properties: {
        registryType: {
          type: "string",
          enum: ["all", "tools", "resources", "prompts", "resourceTemplates"],
          description: "Type of registry to clear",
          default: "all",
        },
        confirm: {
          type: "boolean",
          description: "Confirmation required to prevent accidental clearing",
          default: false,
        },
      },
      required: ["confirm"],
    },
    async (args) => {
      try {
        const params = ClearAllRegistrationsSchema.parse(args);
        
        if (!params.confirm) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Clear operation requires confirmation. Set 'confirm: true' to proceed.",
              },
            ],
            isError: true,
          };
        }

        // Access internal registries (private members)
        const serverAny = server as any;
        
        const beforeCounts = {
          tools: (serverAny._registeredTools || new Map()).size,
          resources: (serverAny._registeredResources || new Map()).size,
          resourceTemplates: (serverAny._registeredResourceTemplates || new Map()).size,
          prompts: (serverAny._registeredPrompts || new Map()).size,
        };
        
        let clearedInfo: any = {
          timestamp: new Date().toISOString(),
          registryType: params.registryType,
          beforeCounts,
          cleared: {},
        };

        // Clear tools registry
        if (params.registryType === "all" || params.registryType === "tools") {
          const tools = serverAny._registeredTools || new Map();
          const toolNames = Array.from(tools.keys());
          tools.clear();
          clearedInfo.cleared.tools = {
            count: beforeCounts.tools,
            names: toolNames,
          };
        }

        // Clear resources registry
        if (params.registryType === "all" || params.registryType === "resources") {
          const resources = serverAny._registeredResources || new Map();
          const resourceUris = Array.from(resources.keys());
          resources.clear();
          clearedInfo.cleared.resources = {
            count: beforeCounts.resources,
            uris: resourceUris,
          };
        }

        // Clear resource templates registry
        if (params.registryType === "all" || params.registryType === "resourceTemplates") {
          const resourceTemplates = serverAny._registeredResourceTemplates || new Map();
          const templateUris = Array.from(resourceTemplates.keys());
          resourceTemplates.clear();
          clearedInfo.cleared.resourceTemplates = {
            count: beforeCounts.resourceTemplates,
            templates: templateUris,
          };
        }

        // Clear prompts registry
        if (params.registryType === "all" || params.registryType === "prompts") {
          const prompts = serverAny._registeredPrompts || new Map();
          const promptNames = Array.from(prompts.keys());
          prompts.clear();
          clearedInfo.cleared.prompts = {
            count: beforeCounts.prompts,
            names: promptNames,
          };
        }

        // Get after counts
        const afterCounts = {
          tools: (serverAny._registeredTools || new Map()).size,
          resources: (serverAny._registeredResources || new Map()).size,
          resourceTemplates: (serverAny._registeredResourceTemplates || new Map()).size,
          prompts: (serverAny._registeredPrompts || new Map()).size,
        };
        
        clearedInfo.afterCounts = afterCounts;
        
        const totalCleared = Object.values(clearedInfo.cleared).reduce((sum, registry: any) => sum + (registry?.count || 0), 0);

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully cleared ${params.registryType} registrations:\n` +
                    `- Total items cleared: ${totalCleared}\n` +
                    `- Tools cleared: ${clearedInfo.cleared.tools?.count || 0}\n` +
                    `- Resources cleared: ${clearedInfo.cleared.resources?.count || 0}\n` +
                    `- Resource Templates cleared: ${clearedInfo.cleared.resourceTemplates?.count || 0}\n` +
                    `- Prompts cleared: ${clearedInfo.cleared.prompts?.count || 0}`,
            },
          ],
          structuredContent: clearedInfo,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error clearing registrations: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}