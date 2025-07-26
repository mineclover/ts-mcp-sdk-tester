import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registeredTools } from "./register-simple-tool.js";
import { ParameterizedToolRegistrationSchema } from "./schemas.js";

/**
 * Register Parameterized Tool
 * Registers a tool with parameters for testing
 */

export function registerRegisterParameterizedTool(server: McpServer) {
  server.registerTool(
    "register_parameterized_tool",
    {
      title: "Register Parameterized Tool",
      description: "Register a tool with parameters for testing",
      inputSchema: ParameterizedToolRegistrationSchema.shape,
    },
    async ({ name, description, paramName, paramDescription, paramType }) => {
      try {
        const schema: any = {};

        switch (paramType) {
          case "string":
            schema[paramName] = z.string().describe(paramDescription);
            break;
          case "number":
            schema[paramName] = z.number().describe(paramDescription);
            break;
          case "boolean":
            schema[paramName] = z.boolean().describe(paramDescription);
            break;
        }

        server.registerTool(
          name,
          {
            title: name,
            description: description,
            inputSchema: schema,
          },
          async (params: any) => ({
            content: [
              {
                type: "text" as const,
                text: `Tool ${name} called with parameters: ${JSON.stringify(params)}`,
              },
            ],
          })
        );

        registeredTools.set(name, {
          description,
          paramName,
          paramDescription,
          paramType,
          hasParams: true,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered parameterized tool: ${name}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error registering parameterized tool: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
