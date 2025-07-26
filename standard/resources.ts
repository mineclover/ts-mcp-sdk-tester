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
import { logger } from "./logger.js";
import { paginateArray } from "./pagination-utils.js";

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
  logger.logMethodEntry("registerResourcesEndpoints", { serverType: 'McpServer' }, "resources");
  
  registerListResources(server);
  registerListResourceTemplates(server);
  registerReadResource(server);
  registerSubscribeResource(server);
  registerUnsubscribeResource(server);
  
  logger.info("All resource endpoints registered successfully", "resources");
}

/**
 * resources/list endpoint
 * Returns a paginated list of available resources
 */
function registerListResources(server: McpServer) {
  logger.logMethodEntry("registerListResources", undefined, "resources");
  
  server.server.setRequestHandler(
    ListResourcesRequestSchema,
    async (request, extra): Promise<ListResourcesResult> => {
      const traceId = await logger.logEndpointEntry("resources/list", extra.requestId, {
        cursor: request.params?.cursor ? "[present]" : "[none]",
      });

      try {
        const { cursor } = request.params || {};

        // Demo resources from separated demo data
        const allResources: Resource[] = DEMO_RESOURCES;
        logger.debug(`Loading ${allResources.length} total resources`, "resources");

        // Use MCP-compliant pagination
        const paginationResult = paginateArray(allResources, cursor, {
          defaultPageSize: 10,
          maxPageSize: 50,
        });

        const result: ListResourcesResult = {
          resources: paginationResult.items,
          nextCursor: paginationResult.nextCursor,
          _meta: {
            totalCount: paginationResult._meta?.totalCount,
            pageSize: paginationResult._meta?.pageSize,
            startIndex: paginationResult._meta?.startIndex,
            hasMore: paginationResult._meta?.hasMore,
          },
        };

        await logger.logMethodExit("resources/list", {
          requestId: extra.requestId,
          resourceCount: result.resources.length,
          totalCount: result._meta?.totalCount,
          hasMore: result._meta?.hasMore,
        }, "resources", traceId);

        return result;
      } catch (error) {
        await logger.logServerError(
          error instanceof Error ? error : new Error(String(error)),
          "resources/list",
          { requestId: extra.requestId, cursor: request.params?.cursor }
        );
        throw error;
      }
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

      // Use MCP-compliant pagination
      const paginationResult = paginateArray(allTemplates, cursor, {
        defaultPageSize: 10,
        maxPageSize: 50,
      });

      const result: ListResourceTemplatesResult = {
        resourceTemplates: paginationResult.items,
        nextCursor: paginationResult.nextCursor,
        _meta: {
          totalCount: paginationResult._meta?.totalCount,
          pageSize: paginationResult._meta?.pageSize,
          startIndex: paginationResult._meta?.startIndex,
          hasMore: paginationResult._meta?.hasMore,
        },
      };

      return result;
    }
  );
}

/**
 * resources/read endpoint
 * Reads and returns the content of a specific resource
 */
function registerReadResource(server: McpServer) {
  logger.logMethodEntry("registerReadResource", undefined, "resources");
  
  server.server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request, extra): Promise<ReadResourceResult> => {
      const { uri } = request.params;
      
      const traceId = await logger.logEndpointEntry("resources/read", extra.requestId, {
        uri: uri,
        uriScheme: uri.split('://')[0] || 'unknown',
      });

      try {
        logger.debug(`Reading resource: ${uri}`, "resources");
        
        // Get demo resource content from separated demo data
        let contents: (TextResourceContents | BlobResourceContents)[];

        try {
          contents = getDemoResourceContent(uri);
          logger.debug(`Found resource in demo data: ${uri}`, "resources");
        } catch (error) {
          logger.debug(`Resource not in demo data, checking fallback: ${uri}`, "resources");
          
          // Handle additional demo resource types not in main demo data
          if (uri.startsWith("api:///")) {
            logger.debug(`Generating API resource content for: ${uri}`, "resources");
            // Sample API resource
            contents = [
              {
                uri,
                blob: Buffer.from("Sample binary data from API").toString("base64"),
                mimeType: "application/octet-stream",
                _meta: {
                  readTime: new Date().toISOString(),
                  apiEndpoint: uri,
                  generated: true,
                },
              },
            ];
          } else {
            logger.warning(`Resource not found: ${uri}`, "resources");
            throw new Error(`Resource not found: ${uri}`);
          }
        }

        const result: ReadResourceResult = {
          contents,
          _meta: {
            readTime: new Date().toISOString(),
            requestedUri: uri,
            contentCount: contents.length,
          },
        };

        await logger.logMethodExit("resources/read", {
          requestId: extra.requestId,
          uri: uri,
          contentCount: contents.length,
          totalSize: contents.reduce((size, content) => 
            size + ('text' in content ? content.text.length : content.blob.length), 0
          ),
        }, "resources", traceId);

        return result;
      } catch (error) {
        await logger.logServerError(
          error instanceof Error ? error : new Error(String(error)),
          "resources/read",
          { requestId: extra.requestId, uri }
        );
        throw error;
      }
    }
  );
}

/**
 * resources/subscribe endpoint
 * Subscribe to notifications when a resource changes
 */
function registerSubscribeResource(server: McpServer) {
  logger.logMethodEntry("registerSubscribeResource", undefined, "resources");
  
  server.server.setRequestHandler(SubscribeRequestSchema, async (request, extra): Promise<EmptyResult> => {
    const { uri } = request.params;
    
    const traceId = await logger.logEndpointEntry("resources/subscribe", extra.requestId, { uri });

    try {
      logger.info(`Client subscribing to resource: ${uri}`, "resources");
      
      // In a real implementation, this would register the subscription
      // For now, just acknowledge the subscription
      const result: EmptyResult = {
        _meta: {
          subscribedTo: uri,
          subscriptionTime: new Date().toISOString(),
          message: `Subscribed to resource updates for: ${uri}`,
          requestId: extra.requestId,
        },
      };

      await logger.logMethodExit("resources/subscribe", {
        requestId: extra.requestId,
        uri: uri,
        status: "subscribed",
      }, "resources", traceId);

      return result;
    } catch (error) {
      await logger.logServerError(
        error instanceof Error ? error : new Error(String(error)),
        "resources/subscribe",
        { requestId: extra.requestId, uri }
      );
      throw error;
    }
  });
}

/**
 * resources/unsubscribe endpoint
 * Unsubscribe from resource update notifications
 */
function registerUnsubscribeResource(server: McpServer) {
  logger.logMethodEntry("registerUnsubscribeResource", undefined, "resources");
  
  server.server.setRequestHandler(
    UnsubscribeRequestSchema,
    async (request, extra): Promise<EmptyResult> => {
      const { uri } = request.params;
      
      const traceId = await logger.logEndpointEntry("resources/unsubscribe", extra.requestId, { uri });

      try {
        logger.info(`Client unsubscribing from resource: ${uri}`, "resources");
        
        // In a real implementation, this would remove the subscription
        // For now, just acknowledge the unsubscription
        const result: EmptyResult = {
          _meta: {
            unsubscribedFrom: uri,
            unsubscriptionTime: new Date().toISOString(),
            message: `Unsubscribed from resource updates for: ${uri}`,
            requestId: extra.requestId,
          },
        };

        await logger.logMethodExit("resources/unsubscribe", {
          requestId: extra.requestId,
          uri: uri,
          status: "unsubscribed",
        }, "resources", traceId);

        return result;
      } catch (error) {
        await logger.logServerError(
          error instanceof Error ? error : new Error(String(error)),
          "resources/unsubscribe",
          { requestId: extra.requestId, uri }
        );
        throw error;
      }
    }
  );
}
