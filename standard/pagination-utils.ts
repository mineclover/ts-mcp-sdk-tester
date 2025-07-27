/**
 * MCP Pagination Utilities
 *
 * Implements opaque cursor-based pagination as per MCP specification.
 * Provides consistent pagination across all list endpoints.
 */

import { INVALID_PARAMS } from "../spec/current_spec.js";

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  defaultPageSize?: number;
  maxPageSize?: number;
}

/**
 * Pagination result containing items and cursor information
 */
export interface PaginationResult<T> {
  items: T[];
  nextCursor?: string;
  _meta: {
    totalCount: number;
    pageSize: number;
    startIndex: number;
    hasMore: boolean;
  };
}

/**
 * Default pagination configuration
 */
const DEFAULT_CONFIG: Required<PaginationConfig> = {
  defaultPageSize: 10,
  maxPageSize: 100,
};

/**
 * Encode pagination state to opaque cursor string
 */
function encodeCursor(startIndex: number, pageSize: number): string {
  const state = { i: startIndex, s: pageSize };
  return Buffer.from(JSON.stringify(state)).toString("base64");
}

/**
 * Decode opaque cursor string to pagination state
 * Throws error if cursor is invalid (as per MCP spec)
 */
function decodeCursor(cursor: string): { startIndex: number; pageSize: number } {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const state = JSON.parse(decoded);

    if (typeof state.i !== "number" || typeof state.s !== "number") {
      throw new Error("Invalid cursor format");
    }

    if (state.i < 0 || state.s <= 0 || state.s > DEFAULT_CONFIG.maxPageSize) {
      throw new Error("Invalid cursor values");
    }

    return { startIndex: state.i, pageSize: state.s };
  } catch (error) {
    // MCP spec requires -32602 error for invalid cursors
    const mcpError = new Error("Invalid cursor parameter");
    (mcpError as any).code = INVALID_PARAMS;
    throw mcpError;
  }
}

/**
 * Paginate array of items using MCP-compliant cursor-based pagination
 */
export function paginateArray<T>(
  items: T[],
  cursor?: string,
  config: PaginationConfig = {}
): PaginationResult<T> {
  const { defaultPageSize, maxPageSize } = { ...DEFAULT_CONFIG, ...config };

  let startIndex = 0;
  let pageSize = defaultPageSize;

  // Parse cursor if provided
  if (cursor) {
    const decoded = decodeCursor(cursor);
    startIndex = decoded.startIndex;
    pageSize = Math.min(decoded.pageSize, maxPageSize);
  }

  // Calculate slice boundaries
  const endIndex = startIndex + pageSize;
  const paginatedItems = items.slice(startIndex, endIndex);

  // Determine if there are more results
  const hasMore = endIndex < items.length;

  // Generate next cursor if needed
  let nextCursor: string | undefined;
  if (hasMore) {
    nextCursor = encodeCursor(endIndex, pageSize);
  }

  return {
    items: paginatedItems,
    nextCursor,
    _meta: {
      totalCount: items.length,
      pageSize,
      startIndex,
      hasMore,
    },
  };
}

/**
 * Create standardized pagination metadata for responses
 */
export function createPaginationMeta(
  totalCount: number,
  pageSize: number,
  startIndex: number,
  hasMore: boolean
) {
  return {
    totalCount,
    pageSize,
    startIndex,
    hasMore,
    // Additional debug info (can be removed in production)
    paginationInfo: {
      itemsInPage: Math.min(pageSize, Math.max(0, totalCount - startIndex)),
      remainingItems: Math.max(0, totalCount - startIndex - pageSize),
    },
  };
}

/**
 * Validate cursor parameter (for explicit validation if needed)
 */
export function validateCursor(cursor: string): boolean {
  try {
    decodeCursor(cursor);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract pagination parameters from request
 */
export function extractPaginationParams(params: { cursor?: string } = {}) {
  return {
    cursor: params.cursor,
    hasCursor: Boolean(params.cursor),
  };
}
