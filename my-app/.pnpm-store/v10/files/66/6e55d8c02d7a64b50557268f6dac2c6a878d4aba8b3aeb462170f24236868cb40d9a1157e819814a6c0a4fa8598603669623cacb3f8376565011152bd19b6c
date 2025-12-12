import { MastraVector } from '@mastra/core/vector';
import type { IndexStats, QueryResult, QueryVectorParams, CreateIndexParams, UpsertVectorParams, DescribeIndexParams, DeleteIndexParams, DeleteVectorParams, DeleteVectorsParams, UpdateVectorParams } from '@mastra/core/vector';
import * as pg from 'pg';
import type { PgVectorConfig } from '../shared/config.js';
import type { PGVectorFilter } from './filter.js';
import type { IndexConfig, IndexType } from './types.js';
export interface PGIndexStats extends IndexStats {
    type: IndexType;
    config: {
        m?: number;
        efConstruction?: number;
        lists?: number;
        probes?: number;
    };
}
interface PgQueryVectorParams extends QueryVectorParams<PGVectorFilter> {
    minScore?: number;
    /**
     * HNSW search parameter. Controls the size of the dynamic candidate
     * list during search. Higher values improve accuracy at the cost of speed.
     */
    ef?: number;
    /**
     * IVFFlat probe parameter. Number of cells to visit during search.
     * Higher values improve accuracy at the cost of speed.
     */
    probes?: number;
}
interface PgCreateIndexParams extends CreateIndexParams {
    indexConfig?: IndexConfig;
    buildIndex?: boolean;
}
interface PgDefineIndexParams {
    indexName: string;
    metric: 'cosine' | 'euclidean' | 'dotproduct';
    indexConfig: IndexConfig;
}
export declare class PgVector extends MastraVector<PGVectorFilter> {
    pool: pg.Pool;
    private describeIndexCache;
    private createdIndexes;
    private mutexesByName;
    private schema?;
    private setupSchemaPromise;
    private installVectorExtensionPromise;
    private vectorExtensionInstalled;
    private vectorExtensionSchema;
    private schemaSetupComplete;
    private cacheWarmupPromise;
    constructor(config: PgVectorConfig);
    private getMutexByName;
    /**
     * Detects which schema contains the vector extension
     */
    private detectVectorExtensionSchema;
    /**
     * Gets the properly qualified vector type name
     */
    private getVectorTypeName;
    private getTableName;
    private getSchemaName;
    transformFilter(filter?: PGVectorFilter): PGVectorFilter;
    getIndexInfo({ indexName }: DescribeIndexParams): Promise<PGIndexStats>;
    query({ indexName, queryVector, topK, filter, includeVector, minScore, ef, probes, }: PgQueryVectorParams): Promise<QueryResult[]>;
    upsert({ indexName, vectors, metadata, ids, deleteFilter, }: UpsertVectorParams<PGVectorFilter>): Promise<string[]>;
    private hasher;
    private getIndexCacheKey;
    private cachedIndexExists;
    private setupSchema;
    createIndex({ indexName, dimension, metric, indexConfig, buildIndex, }: PgCreateIndexParams): Promise<void>;
    buildIndex({ indexName, metric, indexConfig }: PgDefineIndexParams): Promise<void>;
    private setupIndex;
    private installVectorExtension;
    listIndexes(): Promise<string[]>;
    /**
     * Retrieves statistics about a vector index.
     *
     * @param {string} indexName - The name of the index to describe
     * @returns A promise that resolves to the index statistics including dimension, count and metric
     */
    describeIndex({ indexName }: DescribeIndexParams): Promise<PGIndexStats>;
    deleteIndex({ indexName }: DeleteIndexParams): Promise<void>;
    truncateIndex({ indexName }: DeleteIndexParams): Promise<void>;
    disconnect(): Promise<void>;
    /**
     * Updates a vector by its ID with the provided vector and/or metadata.
     * @param indexName - The name of the index containing the vector.
     * @param id - The ID of the vector to update.
     * @param update - An object containing the vector and/or metadata to update.
     * @param update.vector - An optional array of numbers representing the new vector.
     * @param update.metadata - An optional record containing the new metadata.
     * @returns A promise that resolves when the update is complete.
     * @throws Will throw an error if no updates are provided or if the update operation fails.
     */
    updateVector({ indexName, id, filter, update }: UpdateVectorParams<PGVectorFilter>): Promise<void>;
    /**
     * Deletes a vector by its ID.
     * @param indexName - The name of the index containing the vector.
     * @param id - The ID of the vector to delete.
     * @returns A promise that resolves when the deletion is complete.
     * @throws Will throw an error if the deletion operation fails.
     */
    deleteVector({ indexName, id }: DeleteVectorParams): Promise<void>;
    /**
     * Delete vectors matching a metadata filter.
     * @param indexName - The name of the index containing the vectors.
     * @param filter - The filter to match vectors for deletion.
     * @returns A promise that resolves when the deletion is complete.
     * @throws Will throw an error if the deletion operation fails.
     */
    deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<PGVectorFilter>): Promise<void>;
}
export {};
//# sourceMappingURL=index.d.ts.map