import type { UseCase } from '../../shared/types/use-case.types.js';
import type { Thread } from '../../shared/entities/thread.entity.js';
import type * as StorageModule from '../../../../my-app/src/mastra/config/storage.js';

type Storage = typeof StorageModule.storage;

export interface UpdateThreadTitleInput {
  threadId: string;
  title: string;
}

export interface UpdateThreadTitleOutput {
  thread: Thread;
}

export class UpdateThreadTitleUseCase implements UseCase<UpdateThreadTitleInput, UpdateThreadTitleOutput> {
  constructor(
    private readonly storage: Storage,
    private readonly ensureStorageInitialized: typeof StorageModule.ensureStorageInitialized
  ) {}

  async execute(input: UpdateThreadTitleInput): Promise<UpdateThreadTitleOutput> {
    await this.ensureStorageInitialized();

    if (!input.threadId || !input.title) {
      throw new Error('threadId and title are required');
    }

    const existing = await this.storage.getThreadById({ threadId: input.threadId });
    if (!existing) {
      throw new Error(`Thread ${input.threadId} not found`);
    }

    await this.storage.updateThread({
      id: input.threadId,
      title: input.title,
      metadata: existing.metadata || {},
    });

    return {
      thread: {
        id: existing.id,
        title: input.title,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      },
    };
  }
}

