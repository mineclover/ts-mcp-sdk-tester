import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import type { 
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceResult,
  EmptyResult,
  Resource,
  ResourceTemplate,
  TextResourceContents,
  BlobResourceContents
} from "../spec/current_spec.js";

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
      
      // Sample resources for demonstration
      const allResources: Resource[] = [
        {
          name: "test-resource-1",
          title: "Test Resource 1",
          uri: "test://resource1",
          description: "A sample test resource for demonstration",
          mimeType: "text/plain",
          size: 100,
        },
        {
          name: "test-resource-2", 
          title: "Test Resource 2",
          uri: "test://resource2",
          description: "Another sample test resource",
          mimeType: "application/json",
          size: 200,
        },
        {
          name: "sample-file",
          title: "Sample File Resource",
          uri: "file:///sample.txt",
          description: "Sample file resource",
          mimeType: "text/plain",
          size: 150,
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
      
      // Sample resource data based on URI
      let contents: (TextResourceContents | BlobResourceContents)[];
      
      if (uri === "test://resource1") {
        contents = [{
          uri,
          text: "This is the content of test resource 1.\nIt contains sample text data.",
          mimeType: "text/plain",
          _meta: { 
            readTime: new Date().toISOString(),
            size: 54,
          },
        }];
      } else if (uri === "test://resource2") {
        contents = [{
          uri,
          text: JSON.stringify({
            message: "This is test resource 2",
            data: { 
              value: 42, 
              active: true,
              timestamp: new Date().toISOString(),
            }
          }, null, 2),
          mimeType: "application/json",
          _meta: { 
            readTime: new Date().toISOString(),
            size: 120,
          },
        }];
      } else if (uri.startsWith("file:///")) {
        // Sample file resource
        const filename = uri.split("/").pop() || "unknown";
        contents = [{
          uri,
          text: `Content of file: ${filename}\nThis is simulated file content.`,
          mimeType: "text/plain",
          _meta: { 
            readTime: new Date().toISOString(),
            filename,
          },
        }];
      } else if (uri.startsWith("api:///")) {
        // Sample API resource
        contents = [{
          uri,
          blob: Buffer.from("Sample binary data from API").toString("base64"),
          mimeType: "application/octet-stream",
          _meta: { 
            readTime: new Date().toISOString(),
            apiEndpoint: uri,
          },
        }];
      } else {
        throw new Error(`Resource not found: ${uri}`);
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
  server.server.setRequestHandler(
    SubscribeRequestSchema,
    async (request): Promise<EmptyResult> => {
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
    }
  );
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