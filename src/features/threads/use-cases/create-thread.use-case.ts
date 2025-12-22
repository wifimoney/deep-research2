import type { UseCase } from '../../shared/types/use-case.types.js';
import type { Thread } from '../../shared/entities/thread.entity.js';
import type * as StorageModule from '../../../../my-app/src/mastra/config/storage.js';

type Storage = typeof StorageModule.storage;

export interface CreateThreadInput {
  userId: string;
  title?: string;
}

export interface CreateThreadOutput {
  thread: Thread;
}

export class CreateThreadUseCase implements UseCase<CreateThreadInput, CreateThreadOutput> {
  constructor(
    private readonly storage: Storage,
    private readonly ensureStorageInitialized: typeof StorageModule.ensureStorageInitialized
  ) {}

  async execute(input: CreateThreadInput): Promise<CreateThreadOutput> {
    await this.ensureStorageInitialized();

    // Generate thread ID
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Try to get existing thread from storage
    const existing = await this.storage.getThreadById({ threadId });

    if (existing) {
      return {
        thread: {
          id: existing.id,
          title: existing.title,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        },
      };
    }

    // Create thread through storage to ensure proper integration
    const thread = await this.storage.saveThread({
      thread: {
        id: threadId,
        resourceId: input.userId,
        title: input.title || 'New Chat',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      thread: {
        id: thread.id,
        title: thread.title,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      },
    };
  }
}

