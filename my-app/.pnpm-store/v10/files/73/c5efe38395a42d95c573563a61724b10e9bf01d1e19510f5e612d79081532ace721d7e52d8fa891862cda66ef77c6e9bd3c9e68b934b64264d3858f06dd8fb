import type { PaginationArgs, StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
export declare function getSchemaName(schema?: string): string | undefined;
export declare function getTableName({ indexName, schemaName }: {
    indexName: string;
    schemaName?: string;
}): string;
/**
 * Build date range filter for queries
 */
export declare function buildDateRangeFilter(dateRange: PaginationArgs['dateRange'], fieldName: string): Record<string, any>;
/**
 * Prepare WHERE clause for PostgreSQL queries
 */
export declare function prepareWhereClause(filters: Record<string, any>, _schema?: Record<string, StorageColumn>): {
    sql: string;
    args: any[];
};
/**
 * Transform SQL row to record format, handling JSON columns
 */
export declare function transformFromSqlRow<T>({ tableName, sqlRow, }: {
    tableName: TABLE_NAMES;
    sqlRow: Record<string, any>;
}): T;
//# sourceMappingURL=utils.d.ts.map