import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registeredResources } from './register-simple-resource.js';
import { TemplateResourceRegistrationSchema } from './schemas.js';

/**
 * Register Template Resource Tool
 * Registers a parameterized resource using ResourceTemplate with autocomplete
 */

export function registerRegisterTemplateResource(server: McpServer) {
  server.registerTool(
    "register_template_resource",
    {
      title: "Register Template Resource",
      description: "Register a parameterized resource using ResourceTemplate with autocomplete",
      inputSchema: TemplateResourceRegistrationSchema.shape,
    },
    async ({ templateUri, name, description }) => {
      try {
        const template = new ResourceTemplate(templateUri, { 
          list: async () => {
            // Return a list of available resources for this template
            return [
              { uri: templateUri.replace('{id}', '1'), name: `${name} 1` },
              { uri: templateUri.replace('{id}', '2'), name: `${name} 2` },
              { uri: templateUri.replace('{id}', '3'), name: `${name} 3` },
            ];
          },
          complete: {
            id: async (value: string) => {
              // Provide autocomplete suggestions for the 'id' parameter
              return ['1', '2', '3', '123', '456'].filter(id => id.startsWith(value));
            }
          }
        });
        
        server.registerResource(name, template, {
          title: name,
          description: description || `Template resource: ${name}`,
        }, async (uri, params) => ({
          contents: [
            {
              uri: uri.href,
              text: `Template resource with params: ${JSON.stringify(params)}`,
              mimeType: "text/plain",
            },
          ],
        }));

        registeredResources.set(name, { templateUri, name, description, isTemplate: true });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered template resource: ${name} with pattern ${templateUri}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error registering template resource: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}