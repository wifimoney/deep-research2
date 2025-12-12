import { LegacyEvalsStorage } from '@mastra/core/storage';
import type { PaginationArgs, PaginationInfo, EvalRow } from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
export declare class LegacyEvalsPG extends LegacyEvalsStorage {
    private client;
    private schema;
    constructor({ client, schema }: {
        client: IDatabase<{}>;
        schema: string;
    });
    /** @deprecated use getEvals instead */
    getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]>;
    getEvals(options?: {
        agentName?: string;
        type?: 'test' | 'live';
    } & PaginationArgs): Promise<PaginationInfo & {
        evals: EvalRow[];
    }>;
}
//# sourceMappingURL=index.d.ts.map