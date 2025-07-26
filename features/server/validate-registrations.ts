import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const ValidateRegistrationsSchema = z.object({
  registryType: z.enum(["all", "tools", "resources", "prompts", "resourceTemplates"])
    .default("all")
    .describe("Type of registry to validate"),
  strictMode: z.boolean().default(false).describe("Enable strict validation rules"),
});

interface ValidationIssue {
  type: "error" | "warning" | "info";
  registry: string;
  item: string;
  message: string;
  details?: any;
}

export function registerValidateRegistrations(server: McpServer) {
  server.tool(
    "validate_registrations",
    "Validate all registrations for proper configuration and detect potential issues",
    {
      type: "object",
      properties: {
        registryType: {
          type: "string",
          enum: ["all", "tools", "resources", "prompts", "resourceTemplates"],
          description: "Type of registry to validate",
          default: "all",
        },
        strictMode: {
          type: "boolean",
          description: "Enable strict validation rules",
          default: false,
        },
      },
    },
    async (args) => {
      try {
        const params = ValidateRegistrationsSchema.parse(args);
        
        // Access internal registries (private members)
        const serverAny = server as any;
        const issues: ValidationIssue[] = [];
        
        const validationResults: any = {
          timestamp: new Date().toISOString(),
          registryType: params.registryType,
          strictMode: params.strictMode,
          issues: [],
          summary: {
            totalIssues: 0,
            errors: 0,
            warnings: 0,
            infos: 0,
          },
        };

        // Validate tools registry
        if (params.registryType === "all" || params.registryType === "tools") {
          const tools = serverAny._registeredTools || new Map();
          
          for (const [name, tool] of tools.entries()) {
            // Check required fields
            if (!tool.description || tool.description.trim() === "") {
              issues.push({
                type: "warning",
                registry: "tools",
                item: name,
                message: "Tool has empty or missing description",
              });
            }
            
            // Check input schema
            if (!tool.inputSchema) {
              issues.push({
                type: "error",
                registry: "tools",
                item: name,
                message: "Tool missing input schema",
              });
            } else {
              if (tool.inputSchema.type !== "object") {
                issues.push({
                  type: "error",
                  registry: "tools",
                  item: name,
                  message: "Tool input schema must be of type 'object'",
                });
              }
            }
            
            // Check for proper naming
            if (params.strictMode) {
              if (!/^[a-z][a-z0-9_]*$/.test(name)) {
                issues.push({
                  type: "warning",
                  registry: "tools",
                  item: name,
                  message: "Tool name should follow snake_case convention",
                });
              }
            }
          }
        }

        // Validate resources registry
        if (params.registryType === "all" || params.registryType === "resources") {
          const resources = serverAny._registeredResources || new Map();
          
          for (const [uri, resource] of resources.entries()) {
            // Check URI format
            try {
              new URL(uri);
            } catch {
              issues.push({
                type: "error",
                registry: "resources",
                item: uri,
                message: "Invalid URI format",
              });
            }
            
            // Check required fields
            if (!resource.name || resource.name.trim() === "") {
              issues.push({
                type: "warning",
                registry: "resources",
                item: uri,
                message: "Resource has empty or missing name",
              });
            }
            
            // Check MIME type format
            if (resource.mimeType && !/^[a-zA-Z][a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*$/.test(resource.mimeType)) {
              issues.push({
                type: "warning",
                registry: "resources",
                item: uri,
                message: "Invalid MIME type format",
                details: { mimeType: resource.mimeType },
              });
            }
          }
        }

        // Validate resource templates registry
        if (params.registryType === "all" || params.registryType === "resourceTemplates") {
          const resourceTemplates = serverAny._registeredResourceTemplates || new Map();
          
          for (const [template, resource] of resourceTemplates.entries()) {
            // Check URI template format (basic check for {variable} patterns)
            if (!/\{[^}]+\}/.test(template)) {
              issues.push({
                type: "warning",
                registry: "resourceTemplates",
                item: template,
                message: "URI template doesn't contain variable placeholders",
              });
            }
            
            // Check required fields
            if (!resource.name || resource.name.trim() === "") {
              issues.push({
                type: "warning",
                registry: "resourceTemplates",
                item: template,
                message: "Resource template has empty or missing name",
              });
            }
          }
        }

        // Validate prompts registry
        if (params.registryType === "all" || params.registryType === "prompts") {
          const prompts = serverAny._registeredPrompts || new Map();
          
          for (const [name, prompt] of prompts.entries()) {
            // Check required fields
            if (!prompt.description || prompt.description.trim() === "") {
              issues.push({
                type: "warning",
                registry: "prompts",
                item: name,
                message: "Prompt has empty or missing description",
              });
            }
            
            // Check arguments
            if (prompt.arguments) {
              for (const arg of prompt.arguments) {
                if (!arg.name || arg.name.trim() === "") {
                  issues.push({
                    type: "error",
                    registry: "prompts",
                    item: name,
                    message: "Prompt argument has empty or missing name",
                  });
                }
              }
            }
            
            // Check for proper naming
            if (params.strictMode) {
              if (!/^[a-z][a-z0-9_]*$/.test(name)) {
                issues.push({
                  type: "warning",
                  registry: "prompts",
                  item: name,
                  message: "Prompt name should follow snake_case convention",
                });
              }
            }
          }
        }

        // Calculate summary
        validationResults.issues = issues;
        validationResults.summary = {
          totalIssues: issues.length,
          errors: issues.filter(i => i.type === "error").length,
          warnings: issues.filter(i => i.type === "warning").length,
          infos: issues.filter(i => i.type === "info").length,
        };

        const hasErrors = validationResults.summary.errors > 0;
        const hasWarnings = validationResults.summary.warnings > 0;

        return {
          content: [
            {
              type: "text" as const,
              text: `Validation Results for ${params.registryType}:\n` +
                    `- Total Issues: ${validationResults.summary.totalIssues}\n` +
                    `- Errors: ${validationResults.summary.errors}\n` +
                    `- Warnings: ${validationResults.summary.warnings}\n` +
                    `- Status: ${hasErrors ? "FAILED" : hasWarnings ? "PASSED WITH WARNINGS" : "PASSED"}`,
            },
          ],
          structuredContent: validationResults,
          isError: hasErrors,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error validating registrations: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}