/**
 * MCP 페이지네이션 시스템 추상화 패턴
 * 
 * 프로토콜 테스트를 위한 메모리 효율적인 페이지네이션을 제공합니다.
 * 스트리밍 방식으로 메모리 사용량을 최소화합니다.
 */

import { paginateArray, type PaginationResult, type PaginationConfig } from "../pagination-utils.js";
import { logger } from "../logger.js";

/**
 * 스트리밍 페이지네이션 데이터 소스 인터페이스
 * 메모리 효율적인 대용량 데이터 처리 지원
 */
export interface StreamingDataSource<T> {
  /**
   * 전체 데이터 개수 조회
   */
  getTotalCount(): Promise<number>;

  /**
   * 특정 범위의 데이터 조회 (스트리밍)
   */
  getItems(startIndex: number, pageSize: number): Promise<T[]>;
}

/**
 * 스트리밍 기반 페이지네이션 데이터 소스
 * 메모리 효율적인 대용량 데이터 처리
 */
export class StreamingPaginatedDataSource<T> implements StreamingDataSource<T> {
  constructor(
    private countProvider: () => Promise<number>,
    private itemsProvider: (startIndex: number, pageSize: number) => Promise<T[]>
  ) {}

  async getTotalCount(): Promise<number> {
    return this.countProvider();
  }

  async getItems(startIndex: number, pageSize: number): Promise<T[]> {
    return this.itemsProvider(startIndex, pageSize);
  }
}

/**
 * 간단한 MCP 페이지네이션 실행기
 * 메모리 효율적인 프로토콜 테스트용
 */
export class McpPaginator<T> {
  constructor(
    private dataSource: StreamingDataSource<T>,
    private config: PaginationConfig = {}
  ) {}

  /**
   * 스트리밍 페이지네이션 실행
   */
  async paginate(cursor?: string): Promise<PaginationResult<T>> {
    const spanId = logger.startOperation("mcp.pagination.execute", {
      hasCursor: Boolean(cursor),
      defaultPageSize: this.config.defaultPageSize || 10,
      maxPageSize: this.config.maxPageSize || 100,
    });

    try {
      const result = await this.executeStreamingPagination(cursor);
      
      logger.endOperation(spanId, {
        success: true,
        itemCount: result.items.length,
        totalCount: result._meta.totalCount,
        hasMore: result._meta.hasMore,
      });

      return result;

    } catch (error) {
      logger.endOperation(spanId, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async executeStreamingPagination(cursor?: string): Promise<PaginationResult<T>> {
    // 커서 디코딩
    let startIndex = 0;
    let pageSize = this.config.defaultPageSize || 10;

    if (cursor) {
      // 커서에서 페이지네이션 정보 추출 (기존 로직 재사용)
      const tempResult = paginateArray([], cursor, this.config);
      startIndex = tempResult._meta.startIndex;
      pageSize = tempResult._meta.pageSize;
    }

    // 스트리밍 데이터 조회 (메모리 효율적)
    const [totalCount, items] = await Promise.all([
      this.dataSource.getTotalCount(),
      this.dataSource.getItems(startIndex, pageSize + 1), // +1로 hasMore 확인
    ]);

    // hasMore 계산
    const hasMore = items.length > pageSize;
    const resultItems = hasMore ? items.slice(0, pageSize) : items;

    // 다음 커서 생성
    let nextCursor: string | undefined;
    if (hasMore) {
      const nextStartIndex = startIndex + pageSize;
      const nextPageData = { i: nextStartIndex, s: pageSize };
      nextCursor = Buffer.from(JSON.stringify(nextPageData)).toString("base64");
    }

    return {
      items: resultItems,
      nextCursor,
      _meta: {
        totalCount,
        pageSize,
        startIndex,
        hasMore,
      },
    };
  }
}

/**
 * 간단한 MCP 페이지네이션 데코레이터
 */
export function McpPaginated<T>(
  dataSourceFactory: () => StreamingDataSource<T>,
  config: PaginationConfig = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (request: any, extra: any) {
      const { cursor } = request.params || {};
      
      const dataSource = dataSourceFactory();
      const paginator = new McpPaginator(dataSource, config);
      
      return paginator.paginate(cursor);
    };

    return descriptor;
  };
}

/**
 * 편의 함수들 - 메모리 효율적인 프로토콜 테스트용
 */

/**
 * 배열에서 간단한 페이지네이션
 */
export function createArrayPaginator<T>(
  items: T[],
  config?: PaginationConfig
): McpPaginator<T> {
  const dataSource = new StreamingPaginatedDataSource(
    async () => items.length,
    async (startIndex, pageSize) => items.slice(startIndex, startIndex + pageSize)
  );
  return new McpPaginator(dataSource, config);
}

/**
 * 비동기 데이터 소스에서 페이지네이션
 */
export function createAsyncPaginator<T>(
  countProvider: () => Promise<number>,
  itemsProvider: (startIndex: number, pageSize: number) => Promise<T[]>,
  config?: PaginationConfig
): McpPaginator<T> {
  const dataSource = new StreamingPaginatedDataSource(countProvider, itemsProvider);
  return new McpPaginator(dataSource, config);
}