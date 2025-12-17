import type { StepResult, StorageListWorkflowRunsInput, WorkflowRun, WorkflowRuns, WorkflowRunState } from '@mastra/core';
import { WorkflowsStorage } from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
import type { StoreOperationsPG } from '../operations/index.js';
export declare class WorkflowsPG extends WorkflowsStorage {
    client: IDatabase<{}>;
    private operations;
    private schema;
    constructor({ client, operations, schema, }: {
        client: IDatabase<{}>;
        operations: StoreOperationsPG;
        schema: string;
    });
    updateWorkflowResults({}: {
        workflowName: string;
        runId: string;
        stepId: string;
        result: StepResult<any, any, any, any>;
        runtimeContext: Record<string, any>;
    }): Promise<Record<string, StepResult<any, any, any, any>>>;
    updateWorkflowState({}: {
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
    getWorkflowRunById({ runId, workflowName, }: {
        runId: string;
        workflowName?: string;
    }): Promise<WorkflowRun | null>;
    getWorkflowRuns({ workflowName, fromDate, toDate, limit, offset, resourceId, status, }?: StorageListWorkflowRunsInput): Promise<WorkflowRuns>;
}
//# sourceMappingURL=index.d.ts.map