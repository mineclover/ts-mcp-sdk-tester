import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  BlobResourceContents,
  EmptyResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceResult,
  Resource,
  ResourceTemplate,
  TextResourceContents,
} from "../spec/current_spec.js";
import { DEMO_RESOURCES, getDemoResourceContent } from "../demo/index.js";

/**
 * Standard MCP Resources Endpoints
 *
 * Implements the core MCP resource management protocol endpoints:
 * - resources/list: List available resources
 * - resources/templates/list: List resource templates
 * - resources/read: Read resource content
 * - resources/subscribe: Subscribe to resource updates
 * - resources/unsubscribe: Unsubscribe from resource updates
 */

export function registerResourcesEndpoints(server: McpServer) {
  registerListResources(server);
  registerListResourceTemplates(server);
  registerReadResource(server);
  registerSubscribeResource(server);
  registerUnsubscribeResource(server);
}

/**
 * resources/list endpoint
 * Returns a paginated list of available resources
 */
function registerListResources(server: McpServer) {
  server.server.setRequestHandler(
    ListResourcesRequestSchema,
    async (request): Promise<ListResourcesResult> => {
      const { cursor } = request.params || {};

      // Demo resources from separated demo data
      const allResources: Resource[] = DEMO_RESOURCES;

      // Simple pagination implementation
      const pageSize = 10;
      let startIndex = 0;

      if (cursor) {
        try {
          startIndex = parseInt(cursor, 10);
        } catch {
          startIndex = 0;
        }
      }

      const endIndex = startIndex + pageSize;
      const resources = allResources.slice(startIndex, endIndex);

      const result: ListResourcesResult = {
        resources,
        _meta: {
          totalCount: allResources.length,
          pageSize,
          startIndex,
        },
      };

      // Add pagination cursor if there are more results
      if (endIndex < allResources.length) {
        result.nextCursor = endIndex.toString();
      }

      return result;
    }
  );
}

/**
 * resources/templates/list endpoint
 * Returns a list of resource templates with URI patterns
 */
function registerListResourceTemplates(server: McpServer) {
  server.server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async (request): Promise<ListResourceTemplatesResult> => {
      const { cursor } = request.params || {};

      // Sample resource templates
      const allTemplates: ResourceTemplate[] = [
        {
          name: "file-template",
          title: "File Resource Template",
          uriTemplate: "file:///{path}",
          description: "Template for file resources",
          mimeType: "text/plain",
        },
        {
          name: "api-template",
          title: "API Resource Template",
          uriTemplate: "api:///{endpoint}/{id}",
          description: "Template for API resources",
          mimeType: "application/json",
        },
      ];

      // Simple pagination implementation
      const pageSize = 10;
      let startIndex = 0;

      if (cursor) {
        try {
          startIndex = parseInt(cursor, 10);
        } catch {
          startIndex = 0;
        }
      }

      const endIndex = startIndex + pageSize;
      const resourceTemplates = allTemplates.slice(startIndex, endIndex);

      const result: ListResourceTemplatesResult = {
        resourceTemplates,
        _meta: {
          totalCount: allTemplates.length,
          pageSize,
          startIndex,
        },
      };

      // Add pagination cursor if there are more results
      if (endIndex < allTemplates.length) {
        result.nextCursor = endIndex.toString();
      }

      return result;
    }
  );
}

/**
 * resources/read endpoint
 * Reads and returns the content of a specific resource
 */
function registerReadResource(server: McpServer) {
  server.server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request): Promise<ReadResourceResult> => {
      const { uri } = request.params;

      // Get demo resource content from separated demo data
      let contents: (TextResourceContents | BlobResourceContents)[];

      try {
        contents = getDemoResourceContent(uri);
      } catch (error) {
        // Handle additional demo resource types not in main demo data
        if (uri.startsWith("api:///")) {
          // Sample API resource
          contents = [
            {
              uri,
              blob: Buffer.from("Sample binary data from API").toString("base64"),
              mimeType: "application/octet-stream",
              _meta: {
                readTime: new Date().toISOString(),
                apiEndpoint: uri,
              },
            },
          ];
        } else {
          throw new Error(`Resource not found: ${uri}`);
        }
      }

      const result: ReadResourceResult = {
        contents,
        _meta: {
          readTime: new Date().toISOString(),
          requestedUri: uri,
        },
      };

      return result;
    }
  );
}

/**
 * resources/subscribe endpoint
 * Subscribe to notifications when a resource changes
 */
function registerSubscribeResource(server: McpServer) {
  server.server.setRequestHandler(SubscribeRequestSchema, async (request): Promise<EmptyResult> => {
    const { uri } = request.params;

    // In a real implementation, this would register the subscription
    // For now, just acknowledge the subscription
    const result: EmptyResult = {
      _meta: {
        subscribedTo: uri,
        subscriptionTime: new Date().toISOString(),
        message: `Subscribed to resource updates for: ${uri}`,
      },
    };

    return result;
  });
}

/**
 * resources/unsubscribe endpoint
 * Unsubscribe from resource update notifications
 */
function registerUnsubscribeResource(server: McpServer) {
  server.server.setRequestHandler(
    UnsubscribeRequestSchema,
    async (request): Promise<EmptyResult> => {
      const { uri } = request.params;

      // In a real implementation, this would remove the subscription
      // For now, just acknowledge the unsubscription
      const result: EmptyResult = {
        _meta: {
          unsubscribedFrom: uri,
          unsubscriptionTime: new Date().toISOString(),
          message: `Unsubscribed from resource updates for: ${uri}`,
        },
      };

      return result;
    }
  );
}
