import type { UseCase } from '../../shared/types/use-case.types.js';
import type * as StorageModule from '../../../../my-app/src/mastra/config/storage.js';
import type * as WorkingMemoryServiceModule from '../../../../my-app/src/services/workingMemoryService.js';

type Storage = typeof StorageModule.storage;
type WorkingMemoryService = {
  clearWorkingMemory: typeof WorkingMemoryServiceModule.clearWorkingMemory;
};

export interface DeleteThreadInput {
  userId: string;
  threadId: string;
}

export interface DeleteThreadOutput {
  success: boolean;
}

export class DeleteThreadUseCase implements UseCase<DeleteThreadInput, DeleteThreadOutput> {
  constructor(
    private readonly storage: Storage,
    private readonly ensureStorageInitialized: typeof StorageModule.ensureStorageInitialized,
    private readonly workingMemoryService: WorkingMemoryService
  ) {}

  async execute(input: DeleteThreadInput): Promise<DeleteThreadOutput> {
    await this.ensureStorageInitialized();

    if (!input.threadId || !input.userId) {
      throw new Error('threadId and userId are required');
    }

    // Delete the thread from storage
    await this.storage.deleteThread({ threadId: input.threadId });

    // Also clear working memory for this thread
    await this.workingMemoryService.clearWorkingMemory(input.userId, input.threadId);

    return {
      success: true,
    };
  }
}

