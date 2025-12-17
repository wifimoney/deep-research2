import type { MastraMessageContentV2, MastraMessageV2 } from '@mastra/core/agent';
import type { MastraMessageV1, StorageThreadType } from '@mastra/core/memory';
import type { ScoreRowData, ScoringSource } from '@mastra/core/scores';
import { MastraStorage } from '@mastra/core/storage';
import type { EvalRow, PaginationInfo, StorageColumn, StorageGetMessagesArg, StorageGetTracesArg, StorageGetTracesPaginatedArg, StorageResourceType, TABLE_NAMES, WorkflowRun, WorkflowRuns, PaginationArgs, StoragePagination, StorageDomains, ThreadSortOptions, AISpanRecord, AITraceRecord, AITracesPaginatedArg, StorageListWorkflowRunsInput } from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import pgPromise from 'pg-promise';
import type { PostgresStoreConfig } from '../shared/config.js';
export type { CreateIndexOptions, IndexInfo } from '@mastra/core/storage';
export declare class PostgresStore extends MastraStorage {
    #private;
    private schema;
    private isConnected;
    stores: StorageDomains;
    constructor(config: PostgresStoreConfig);
    init(): Promise<void>;
    get db(): pgPromise.IDatabase<{}, import("pg-promise/typescript/pg-subset").IClient>;
    get pgp(): pgPromise.IMain<{}, import("pg-promise/typescript/pg-subset").IClient>;
    get supports(): {
        selectByIncludeResourceScope: boolean;
        resourceWorkingMemory: boolean;
        hasColumn: boolean;
        createTable: boolean;
        deleteMessages: boolean;
        aiTracing: boolean;
        indexManagement: boolean;
        getScoresBySpan: boolean;
    };
    /** @deprecated use getEvals instead */
    getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]>;
    getEvals(options?: {
        agentName?: string;
        type?: 'test' | 'live';
    } & PaginationArgs): Promise<PaginationInfo & {
        evals: EvalRow[];
    }>;
    /**
     * @deprecated use getTracesPaginated instead
     */
    getTraces(args: StorageGetTracesArg): Promise<Trace[]>;
    getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & {
        traces: Trace[];
    }>;
    batchTraceInsert({ records }: {
        records: Record<string, any>[];
    }): Promise<void>;
    createTable({ tableName, schema, }: {
        tableName: TABLE_NAMES;
        schema: Record<string, StorageColumn>;
    }): Promise<void>;
    alterTable({ tableName, schema, ifNotExists, }: {
        tableName: TABLE_NAMES;
        schema: Record<string, StorageColumn>;
        ifNotExists: string[];
    }): Promise<void>;
    clearTable({ tableName }: {
        tableName: TABLE_NAMES;
    }): Promise<void>;
    dropTable({ tableName }: {
        tableName: TABLE_NAMES;
    }): Promise<void>;
    insert({ tableName, record }: {
        tableName: TABLE_NAMES;
        record: Record<string, any>;
    }): Promise<void>;
    batchInsert({ tableName, records }: {
        tableName: TABLE_NAMES;
        records: Record<string, any>[];
    }): Promise<void>;
    load<R>({ tableName, keys }: {
        tableName: TABLE_NAMES;
        keys: Record<string, string>;
    }): Promise<R | null>;
    /**
     * Memory
     */
    getThreadById({ threadId }: {
        threadId: string;
    }): Promise<StorageThreadType | null>;
    /**
     * @deprecated use getThreadsByResourceIdPaginated instead
     */
    getThreadsByResourceId(args: {
        resourceId: string;
    } & ThreadSortOptions): Promise<StorageThreadType[]>;
    getThreadsByResourceIdPaginated(args: {
        resourceId: string;
        page: number;
        perPage: number;
    } & ThreadSortOptions): Promise<PaginationInfo & {
        threads: StorageThreadType[];
    }>;
    saveThread({ thread }: {
        thread: StorageThreadType;
    }): Promise<StorageThreadType>;
    updateThread({ id, title, metadata, }: {
        id: string;
        title: string;
        metadata: Record<string, unknown>;
    }): Promise<StorageThreadType>;
    deleteThread({ threadId }: {
        threadId: string;
    }): Promise<void>;
    /**
     * @deprecated use getMessagesPaginated instead
     */
    getMessages(args: StorageGetMessagesArg & {
        format?: 'v1';
    }): Promise<MastraMessageV1[]>;
    getMessages(args: StorageGetMessagesArg & {
        format: 'v2';
    }): Promise<MastraMessageV2[]>;
    getMessagesById({ messageIds, format }: {
        messageIds: string[];
        format: 'v1';
    }): Promise<MastraMessageV1[]>;
    getMessagesById({ messageIds, format }: {
        messageIds: string[];
        format?: 'v2';
    }): Promise<MastraMessageV2[]>;
    getMessagesPaginated(args: StorageGetMessagesArg & {
        format?: 'v1' | 'v2';
    }): Promise<PaginationInfo & {
        messages: MastraMessageV1[] | MastraMessageV2[];
    }>;
    saveMessages(args: {
        messages: MastraMessageV1[];
        format?: undefined | 'v1';
    }): Promise<MastraMessageV1[]>;
    saveMessages(args: {
        messages: MastraMessageV2[];
        format: 'v2';
    }): Promise<MastraMessageV2[]>;
    updateMessages({ messages, }: {
        messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & {
            id: string;
            content?: {
                metadata?: MastraMessageContentV2['metadata'];
                content?: MastraMessageContentV2['content'];
            };
        })[];
    }): Promise<MastraMessageV2[]>;
    deleteMessages(messageIds: string[]): Promise<void>;
    getResourceById({ resourceId }: {
        resourceId: string;
    }): Promise<StorageResourceType | null>;
    saveResource({ resource }: {
        resource: StorageResourceType;
    }): Promise<StorageResourceType>;
    updateResource({ resourceId, workingMemory, metadata, }: {
        resourceId: string;
        workingMemory?: string;
        metadata?: Record<string, unknown>;
    }): Promise<StorageResourceType>;
    /**
     * Workflows
     */
    updateWorkflowResults({ workflowName, runId, stepId, result, runtimeContext, }: {
        workflowName: string;
        runId: string;
        stepId: string;
        result: StepResult<any, any, any, any>;
        runtimeContext: Record<string, any>;
    }): Promise<Record<string, StepResult<any, any, any, any>>>;
    updateWorkflowState({ workflowName, runId, opts, }: {
        workflowName: string;
        runId: string;
        opts: {
            status: string;
            result?: StepResult<any, any, any, any>;
            error?: string;
            suspendedPaths?: Record<string, number[]>;
            waitingPaths?: Record<string, number[]>;
        };
    }): Promise<WorkflowRunState | undefined>;
    persistWorkflowSnapshot({ workflowName, runId, resourceId, snapshot, }: {
        workflowName: string;
        runId: string;
        resourceId?: string;
        snapshot: WorkflowRunState;
    }): Promise<void>;
    loadWorkflowSnapshot({ workflowName, runId, }: {
        workflowName: string;
        runId: string;
    }): Promise<WorkflowRunState | null>;
    getWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns>;
    getWorkflowRunById({ runId, workflowName, }: {
        runId: string;
        workflowName?: string;
    }): Promise<WorkflowRun | null>;
    close(): Promise<void>;
    /**
     * AI Tracing / Observability
     */
    createAISpan(span: AISpanRecord): Promise<void>;
    updateAISpan({ spanId, traceId, updates, }: {
        spanId: string;
        traceId: string;
        updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
    }): Promise<void>;
    getAITrace(traceId: string): Promise<AITraceRecord | null>;
    getAITracesPaginated(args: AITracesPaginatedArg): Promise<{
        pagination: PaginationInfo;
        spans: AISpanRecord[];
    }>;
    batchCreateAISpans(args: {
        records: AISpanRecord[];
    }): Promise<void>;
    batchUpdateAISpans(args: {
        records: {
            traceId: string;
            spanId: string;
            updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
        }[];
    }): Promise<void>;
    batchDeleteAITraces(args: {
        traceIds: string[];
    }): Promise<void>;
    /**
     * Scorers
     */
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
    saveScore(score: ScoreRowData): Promise<{
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