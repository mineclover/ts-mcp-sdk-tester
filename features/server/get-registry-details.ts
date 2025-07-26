import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const GetRegistryDetailsSchema = z.object({
  includeDetails: z.boolean().default(true).describe("Include detailed information about registrations"),
  registryType: z.enum(["all", "tools", "resources", "prompts", "resourceTemplates"])
    .default("all")
    .describe("Type of registry to inspect"),
});

export function registerGetRegistryDetails(server: McpServer) {
  server.tool(
    "get_registry_details",
    "Get detailed information about internal server registries for comprehensive testing",
    {
      type: "object",
      properties: {
        includeDetails: {
          type: "boolean",
          description: "Include detailed information about registrations",
          default: true,
        },
        registryType: {
          type: "string",
          enum: ["all", "tools", "resources", "prompts", "resourceTemplates"],
          description: "Type of registry to inspect",
          default: "all",
        },
      },
    },
    async (args) => {
      try {
        const params = GetRegistryDetailsSchema.parse(args);
        
        // Access internal registries (private members)
        const serverAny = server as any;
        
        const registryInfo: any = {
          timestamp: new Date().toISOString(),
          registryType: params.registryType,
          includeDetails: params.includeDetails,
        };

        // Get tools registry
        if (params.registryType === "all" || params.registryType === "tools") {
          const tools = serverAny._registeredTools || new Map();
          registryInfo.tools = {
            count: tools.size,
            names: Array.from(tools.keys()),
          };
          
          if (params.includeDetails) {
            registryInfo.tools.details = Array.from(tools.entries()).map(([name, tool]: [string, any]) => ({
              name,
              description: tool.description,
              hasInputSchema: !!tool.inputSchema,
              hasOutputSchema: !!tool.outputSchema,
              annotations: tool.annotations,
              inputSchemaProperties: tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties) : [],
              requiredParams: tool.inputSchema?.required || [],
            }));
          }
        }

        // Get resources registry
        if (params.registryType === "all" || params.registryType === "resources") {
          const resources = serverAny._registeredResources || new Map();
          registryInfo.resources = {
            count: resources.size,
            uris: Array.from(resources.keys()),
          };
          
          if (params.includeDetails) {
            registryInfo.resources.details = Array.from(resources.entries()).map(([uri, resource]: [string, any]) => ({
              uri,
              name: resource.name,
              description: resource.description,
              mimeType: resource.mimeType,
              size: resource.size,
              annotations: resource.annotations,
            }));
          }
        }

        // Get resource templates registry
        if (params.registryType === "all" || params.registryType === "resourceTemplates") {
          const resourceTemplates = serverAny._registeredResourceTemplates || new Map();
          registryInfo.resourceTemplates = {
            count: resourceTemplates.size,
            templates: Array.from(resourceTemplates.keys()),
          };
          
          if (params.includeDetails) {
            registryInfo.resourceTemplates.details = Array.from(resourceTemplates.entries()).map(([template, resource]: [string, any]) => ({
              uriTemplate: template,
              name: resource.name,
              description: resource.description,
              mimeType: resource.mimeType,
              annotations: resource.annotations,
            }));
          }
        }

        // Get prompts registry
        if (params.registryType === "all" || params.registryType === "prompts") {
          const prompts = serverAny._registeredPrompts || new Map();
          registryInfo.prompts = {
            count: prompts.size,
            names: Array.from(prompts.keys()),
          };
          
          if (params.includeDetails) {
            registryInfo.prompts.details = Array.from(prompts.entries()).map(([name, prompt]: [string, any]) => ({
              name,
              description: prompt.description,
              hasArguments: !!prompt.arguments && prompt.arguments.length > 0,
              argumentCount: prompt.arguments?.length || 0,
              arguments: prompt.arguments?.map((arg: any) => ({
                name: arg.name,
                description: arg.description,
                required: arg.required,
              })) || [],
            }));
          }
        }

        // Calculate total registrations
        const totalCount = (registryInfo.tools?.count || 0) +
                          (registryInfo.resources?.count || 0) +
                          (registryInfo.resourceTemplates?.count || 0) +
                          (registryInfo.prompts?.count || 0);

        registryInfo.summary = {
          totalRegistrations: totalCount,
          toolsCount: registryInfo.tools?.count || 0,
          resourcesCount: registryInfo.resources?.count || 0,
          resourceTemplatesCount: registryInfo.resourceTemplates?.count || 0,
          promptsCount: registryInfo.prompts?.count || 0,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: `Registry Details (${params.registryType}):\n` +
                    `- Total Registrations: ${totalCount}\n` +
                    `- Tools: ${registryInfo.tools?.count || 0}\n` +
                    `- Resources: ${registryInfo.resources?.count || 0}\n` +
                    `- Resource Templates: ${registryInfo.resourceTemplates?.count || 0}\n` +
                    `- Prompts: ${registryInfo.prompts?.count || 0}`,
            },
          ],
          structuredContent: registryInfo,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting registry details: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}