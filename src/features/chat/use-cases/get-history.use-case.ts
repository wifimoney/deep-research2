import type { UseCase } from '../../shared/types/use-case.types.js';
import type { Message } from '../../shared/entities/message.entity.js';
import type * as StorageModule from '../../../../my-app/src/mastra/config/storage.js';
import type * as MemoryModule from '../../../../my-app/src/mastra/config/memory.js';

type Storage = typeof StorageModule.storage;
type Memory = typeof MemoryModule.standardMemory;

// Extract text content helper (copied from memoryService since it's not exported)
function extractTextContent(msg: any): string {
  // If msg itself is a string, return it
  if (typeof msg === 'string') {
    return msg;
  }

  // Try msg.text first (some storage formats)
  if (msg.text && typeof msg.text === 'string') {
    return msg.text;
  }

  let content = msg.content;

  // Case 1: Direct string content
  if (typeof content === 'string') {
    // Check if it's a JSON string that needs parsing
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object') {
          // Recursively extract from parsed object
          return extractTextContent({ content: parsed });
        }
      } catch (e) {
        // Not valid JSON, use as-is
      }
    }
    return content;
  }

  // Case 2: Content is null/undefined
  if (content == null) {
    // Try to get content from other fields
    if (msg.body && typeof msg.body === 'string') {
      return msg.body;
    }
    if (msg.message && typeof msg.message === 'string') {
      return msg.message;
    }
    return '';
  }

  // Case 3: Object with content.content string (our format + Memory format)
  if (typeof content === 'object' && typeof content.content === 'string') {
    return content.content;
  }

  // Case 4: V2 format with format field (check before generic parts array)
  if (typeof content === 'object' && content.format === 2 && Array.isArray(content.parts)) {
    // Handle empty parts array - return empty string (valid empty message)
    if (content.parts.length === 0) {
      return '';
    }
    const extracted = content.parts
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (part.type === 'text' && part.text) return part.text;
        if (part.text) return part.text;
        if (typeof part === 'object' && part.content) return part.content;
        return '';
      })
      .filter(Boolean)
      .join('');
    return extracted;
  }

  // Case 5: Object with parts array (generic, without format field)
  if (typeof content === 'object' && Array.isArray(content.parts)) {
    const text = content.parts
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (part.type === 'text' && part.text) return part.text;
        if (part.text) return part.text;
        if (typeof part === 'object' && part.content) return part.content;
        return '';
      })
      .filter(Boolean)
      .join('');
    if (text) return text;
  }

  // Case 6: Parts array at top level
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (part.type === 'text' && part.text) return part.text;
        if (part.text) return part.text;
        if (typeof part === 'object' && part.content) return part.content;
        return '';
      })
      .filter(Boolean)
      .join('');
  }

  // Case 7: content.text
  if (typeof content === 'object' && typeof content.text === 'string') {
    return content.text;
  }

  // Case 8: PostgreSQL storage might store as JSON string
  if (typeof content === 'object' && typeof content.value === 'string') {
    try {
      const parsed = JSON.parse(content.value);
      if (typeof parsed === 'string') return parsed;
      if (parsed.content && typeof parsed.content === 'string') return parsed.content;
    } catch {
      // Not JSON, continue
    }
  }

  // Case 9: Check if content has a 'data' field (some storage formats)
  if (typeof content === 'object' && content.data) {
    if (typeof content.data === 'string') return content.data;
    if (Array.isArray(content.data)) {
      return content.data
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item.text) return item.text;
          return '';
        })
        .filter(Boolean)
        .join('');
    }
  }

  // Fallback: try to stringify, but avoid circular references
  if (typeof content === 'object') {
    try {
      const stringified = JSON.stringify(content);
      // If it's a very long JSON, it's probably not what we want
      if (stringified.length < 1000) {
        return stringified;
      }
    } catch {
      // Circular reference or other error
    }
  }

  return String(content || '');
}

export interface GetHistoryInput {
  userId: string;
  threadId: string;
}

export interface GetHistoryOutput {
  messages: Message[];
}

export class GetHistoryUseCase implements UseCase<GetHistoryInput, GetHistoryOutput> {
  constructor(
    private readonly storage: Storage,
    private readonly ensureStorageInitialized: typeof StorageModule.ensureStorageInitialized,
    private readonly memory: Memory
  ) {}

  async execute(input: GetHistoryInput): Promise<GetHistoryOutput> {
    await this.ensureStorageInitialized();

    console.log(`[GetHistoryUseCase] getHistory called - threadId: ${input.threadId}, userId: ${input.userId}`);

    const messagesMap = new Map<string, Message>();

    // 1. Mastra Memory (primary)
    if (messagesMap.size === 0) {
      try {
        const hasRecall = typeof (this.memory as any).recall === 'function';
        const hasQuery = typeof (this.memory as any).query === 'function';

        if (hasRecall || hasQuery) {
          // Use query/recall logic
          const result = hasQuery
            ? await (this.memory as any).query({ threadId: input.threadId, resourceId: input.userId, selectBy: { last: 50 } })
            : await (this.memory as any).recall({ threadId: input.threadId, resourceId: input.userId });

          const messages = result.messages || result.uiMessages || [];
          console.log(`[GetHistoryUseCase] Found ${messages.length} messages in Mastra`);

          messages.forEach((msg: any) => {
            if (!messagesMap.has(msg.id) && (msg.role === 'user' || msg.role === 'assistant')) {
              const content = extractTextContent(msg);
              if (content) {
                messagesMap.set(msg.id, {
                  id: msg.id,
                  role: msg.role as 'user' | 'assistant',
                  content,
                  createdAt: msg.createdAt || new Date()
                });
              }
            }
          });
        }
      } catch (error) {
        console.error(`[GetHistoryUseCase] Error reading from Mastra:`, error);
      }
    }

    // Convert map to array and sort
    const finalMessages = Array.from(messagesMap.values()).sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    console.log(`[GetHistoryUseCase] Returning ${finalMessages.length} combined messages`);
    return { messages: finalMessages };
  }
}

