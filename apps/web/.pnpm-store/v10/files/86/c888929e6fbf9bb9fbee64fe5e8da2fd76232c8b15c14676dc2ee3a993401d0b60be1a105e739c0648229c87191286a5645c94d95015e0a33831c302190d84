import type { PaginationInfo, StorageGetTracesArg, StorageGetTracesPaginatedArg } from '@mastra/core/storage';
import { TracesStorage } from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { IDatabase } from 'pg-promise';
import type { StoreOperationsPG } from '../operations/index.js';
export declare class TracesPG extends TracesStorage {
    client: IDatabase<{}>;
    private operations;
    private schema?;
    constructor({ client, operations, schema, }: {
        client: IDatabase<{}>;
        operations: StoreOperationsPG;
        schema?: string;
    });
    getTraces(args: StorageGetTracesArg): Promise<Trace[]>;
    getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & {
        traces: Trace[];
    }>;
    batchTraceInsert({ records }: {
        records: Record<string, any>[];
    }): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map