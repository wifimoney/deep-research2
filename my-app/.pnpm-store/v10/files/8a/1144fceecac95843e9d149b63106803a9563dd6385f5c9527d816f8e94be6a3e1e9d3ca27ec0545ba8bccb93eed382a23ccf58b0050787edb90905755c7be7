import { StoreOperations } from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES, CreateIndexOptions, IndexInfo, StorageIndexStats } from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
export type { CreateIndexOptions, IndexInfo, StorageIndexStats };
export declare class StoreOperationsPG extends StoreOperations {
    client: IDatabase<{}>;
    schemaName?: string;
    private setupSchemaPromise;
    private schemaSetupComplete;
    constructor({ client, schemaName }: {
        client: IDatabase<{}>;
        schemaName?: string;
    });
    hasColumn(table: string, column: string): Promise<boolean>;
    /**
     * Prepares values for insertion, handling JSONB columns by stringifying them
     */
    private prepareValuesForInsert;
    /**
     * Adds timestamp Z columns to a record if timestamp columns exist
     */
    private addTimestampZColumns;
    /**
     * Prepares a value for database operations, handling Date objects and JSON serialization
     * This is schema-aware and only stringifies objects for JSONB columns
     */
    private prepareValue;
    private setupSchema;
    insert({ tableName, record }: {
        tableName: TABLE_NAMES;
        record: Record<string, any>;
    }): Promise<void>;
    clearTable({ tableName }: {
        tableName: TABLE_NAMES;
    }): Promise<void>;
    protected getDefaultValue(type: StorageColumn['type']): string;
    createTable({ tableName, schema, }: {
        tableName: TABLE_NAMES;
        schema: Record<string, StorageColumn>;
    }): Promise<void>;
    /**
     * Set up timestamp triggers for a table to automatically manage createdAt/updatedAt
     */
    private setupTimestampTriggers;
    /**
     * Alters table schema to add columns if they don't exist
     * @param tableName Name of the table
     * @param schema Schema of the table
     * @param ifNotExists Array of column names to add if they don't exist
     */
    alterTable({ tableName, schema, ifNotExists, }: {
        tableName: TABLE_NAMES;
        schema: Record<string, StorageColumn>;
        ifNotExists: string[];
    }): Promise<void>;
    load<R>({ tableName, keys }: {
        tableName: TABLE_NAMES;
        keys: Record<string, string>;
    }): Promise<R | null>;
    batchInsert({ tableName, records }: {
        tableName: TABLE_NAMES;
        records: Record<string, any>[];
    }): Promise<void>;
    dropTable({ tableName }: {
        tableName: TABLE_NAMES;
    }): Promise<void>;
    /**
     * Create a new index on a table
     */
    createIndex(options: CreateIndexOptions): Promise<void>;
    /**
     * Drop an existing index
     */
    dropIndex(indexName: string): Promise<void>;
    /**
     * List indexes for a specific table or all tables
     */
    listIndexes(tableName?: string): Promise<IndexInfo[]>;
    /**
     * Returns definitions for automatic performance indexes
     * These composite indexes cover both filtering and sorting in single index
     */
    protected getAutomaticIndexDefinitions(): CreateIndexOptions[];
    /**
     * Creates automatic indexes for optimal query performance
     * Uses getAutomaticIndexDefinitions() to determine which indexes to create
     */
    createAutomaticIndexes(): Promise<void>;
    /**
     * Get detailed statistics for a specific index
     */
    describeIndex(indexName: string): Promise<StorageIndexStats>;
    /**
     * Update a single record in the database
     */
    update({ tableName, keys, data, }: {
        tableName: TABLE_NAMES;
        keys: Record<string, any>;
        data: Record<string, any>;
    }): Promise<void>;
    /**
     * Update multiple records in a single batch transaction
     */
    batchUpdate({ tableName, updates, }: {
        tableName: TABLE_NAMES;
        updates: Array<{
            keys: Record<string, any>;
            data: Record<string, any>;
        }>;
    }): Promise<void>;
    /**
     * Delete multiple records by keys
     */
    batchDelete({ tableName, keys }: {
        tableName: TABLE_NAMES;
        keys: Record<string, any>[];
    }): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map