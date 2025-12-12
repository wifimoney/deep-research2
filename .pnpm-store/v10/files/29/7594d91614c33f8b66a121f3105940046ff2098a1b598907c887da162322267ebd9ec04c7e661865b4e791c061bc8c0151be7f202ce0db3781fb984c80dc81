import type { TracingStrategy } from '@mastra/core/ai-tracing';
import { ObservabilityStorage } from '@mastra/core/storage';
import type { AISpanRecord, AITraceRecord, AITracesPaginatedArg, CreateAISpanRecord, PaginationInfo, UpdateAISpanRecord } from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
import type { StoreOperationsPG } from '../operations/index.js';
export declare class ObservabilityPG extends ObservabilityStorage {
    client: IDatabase<{}>;
    private operations;
    private schema?;
    constructor({ client, operations, schema, }: {
        client: IDatabase<{}>;
        operations: StoreOperationsPG;
        schema?: string;
    });
    get aiTracingStrategy(): {
        preferred: TracingStrategy;
        supported: TracingStrategy[];
    };
    createAISpan(span: CreateAISpanRecord): Promise<void>;
    getAITrace(traceId: string): Promise<AITraceRecord | null>;
    updateAISpan({ spanId, traceId, updates, }: {
        spanId: string;
        traceId: string;
        updates: Partial<UpdateAISpanRecord>;
    }): Promise<void>;
    getAITracesPaginated({ filters, pagination, }: AITracesPaginatedArg): Promise<{
        pagination: PaginationInfo;
        spans: AISpanRecord[];
    }>;
    batchCreateAISpans(args: {
        records: CreateAISpanRecord[];
    }): Promise<void>;
    batchUpdateAISpans(args: {
        records: {
            traceId: string;
            spanId: string;
            updates: Partial<UpdateAISpanRecord>;
        }[];
    }): Promise<void>;
    batchDeleteAITraces(args: {
        traceIds: string[];
    }): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map