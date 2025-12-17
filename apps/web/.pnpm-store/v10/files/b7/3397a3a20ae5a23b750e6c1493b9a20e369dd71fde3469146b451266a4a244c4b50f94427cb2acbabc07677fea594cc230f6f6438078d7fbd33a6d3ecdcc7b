import type { ScoreRowData, ScoringSource } from '@mastra/core/scores';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import { ScoresStorage } from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
import type { StoreOperationsPG } from '../operations/index.js';
export declare class ScoresPG extends ScoresStorage {
    client: IDatabase<{}>;
    private operations;
    private schema?;
    constructor({ client, operations, schema, }: {
        client: IDatabase<{}>;
        operations: StoreOperationsPG;
        schema?: string;
    });
    getScoreById({ id }: {
        id: string;
    }): Promise<ScoreRowData | null>;
    getScoresByScorerId({ scorerId, pagination, entityId, entityType, source, }: {
        scorerId: string;
        pagination: StoragePagination;
        entityId?: string;
        entityType?: string;
        source?: ScoringSource;
    }): Promise<{
        pagination: PaginationInfo;
        scores: ScoreRowData[];
    }>;
    saveScore(score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
        score: ScoreRowData;
    }>;
    getScoresByRunId({ runId, pagination, }: {
        runId: string;
        pagination: StoragePagination;
    }): Promise<{
        pagination: PaginationInfo;
        scores: ScoreRowData[];
    }>;
    getScoresByEntityId({ entityId, entityType, pagination, }: {
        pagination: StoragePagination;
        entityId: string;
        entityType: string;
    }): Promise<{
        pagination: PaginationInfo;
        scores: ScoreRowData[];
    }>;
    getScoresBySpan({ traceId, spanId, pagination, }: {
        traceId: string;
        spanId: string;
        pagination: StoragePagination;
    }): Promise<{
        pagination: PaginationInfo;
        scores: ScoreRowData[];
    }>;
}
//# sourceMappingURL=index.d.ts.map