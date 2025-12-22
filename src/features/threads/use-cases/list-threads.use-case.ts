import type { UseCase } from '../../shared/types/use-case.types.js';
import type { Thread } from '../../shared/entities/thread.entity.js';
import type * as StorageModule from '../../../../my-app/src/mastra/config/storage.js';

type Storage = typeof StorageModule.storage;

export interface ListThreadsInput {
  userId: string;
}

export interface ListThreadsOutput {
  threads: Thread[];
}

export class ListThreadsUseCase implements UseCase<ListThreadsInput, ListThreadsOutput> {
  constructor(
    private readonly storage: Storage,
    private readonly ensureStorageInitialized: typeof StorageModule.ensureStorageInitialized
  ) {}

  async execute(input: ListThreadsInput): Promise<ListThreadsOutput> {
    await this.ensureStorageInitialized();

    try {
      // Beta storage API changed: try a set of possible methods
      const threads =
        (await (this.storage as any).getThreadsByResource?.({ resourceId: input.userId })) ??
        (await (this.storage as any).getThreads?.({ resourceId: input.userId })) ??
        (await (this.storage as any).listThreads?.({ resourceId: input.userId })) ??
        (await (this.storage as any).getThreadsByResourceId?.({ resourceId: input.userId })) ??
        [];

      // Ensure threads is an array before mapping
      if (!Array.isArray(threads)) {
        console.error(`[ListThreadsUseCase] getThreads returned non-array:`, typeof threads, threads);
        return { threads: [] };
      }

      console.log(`[ListThreadsUseCase] Found ${threads.length} threads for user ${input.userId}`);

      // Map and sort threads by updatedAt descending (most recent first)
      const mappedThreads: Thread[] = threads
        .map((t: any) => ({
          id: t.id,
          title: t.title || 'New Chat',
          createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt),
          updatedAt: t.updatedAt instanceof Date ? t.updatedAt : new Date(t.updatedAt || t.createdAt),
        }))
        .sort((a, b) => {
          // Sort by updatedAt descending (most recent first)
          const timeA = a.updatedAt.getTime();
          const timeB = b.updatedAt.getTime();
          return timeB - timeA;
        });

      console.log(`[ListThreadsUseCase] Returning ${mappedThreads.length} sorted threads`);
      return { threads: mappedThreads };
    } catch (error) {
      console.error(`[ListThreadsUseCase] Error getting threads:`, error);
      return { threads: [] };
    }
  }
}

