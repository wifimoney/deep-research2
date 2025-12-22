import type { UseCase } from '../../shared/types/use-case.types.js';
import type { Message } from '../../shared/entities/message.entity.js';
import type * as StorageModule from '../../../../my-app/src/mastra/config/storage.js';
import type * as ChatAgentModule from '../../../../my-app/src/agents/chatAgent.js';
import type * as WorkingMemoryServiceModule from '../../../../my-app/src/services/workingMemoryService.js';
import type * as ConfigModule from '../../../../my-app/src/mastra/config/config.js';
import type * as MemoryServiceModule from '../../../../my-app/src/services/memoryService.js';

type Storage = typeof StorageModule.storage;
type ChatAgent = typeof ChatAgentModule.chatAgent;
type WorkingMemoryService = {
  getWorkingMemorySummary: typeof WorkingMemoryServiceModule.getWorkingMemorySummary;
};
type MemoryService = {
  getOrCreateThread: typeof MemoryServiceModule.getOrCreateThread;
};

export interface SendMessageInput {
  userId: string;
  threadId: string;
  message: string;
  includeWorkingMemory?: boolean;
  googleTokens?: any;
}

export interface SendMessageOutput {
  userMessage: Message;
  assistantMessage: Message;
  threadId: string;
  workingMemorySummary?: string;
}

export class SendMessageUseCase implements UseCase<SendMessageInput, SendMessageOutput> {
  constructor(
    private readonly storage: Storage,
    private readonly ensureStorageInitialized: typeof StorageModule.ensureStorageInitialized,
    private readonly chatAgent: ChatAgent,
    private readonly workingMemoryService: WorkingMemoryService,
    private readonly apiKeysConfig: typeof ConfigModule.apiKeysConfig,
    private readonly memoryService: MemoryService
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    // Check for required environment variables
    if (!this.apiKeysConfig.hasAiKey) {
      throw new Error('API key not configured. Please set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable in your .env file.');
    }

    // Validate inputs
    if (!input.userId) throw new Error('sendMessage: userId is required');
    if (!input.threadId) throw new Error('sendMessage: threadId is required');
    if (!input.message || input.message.trim().length === 0) throw new Error('sendMessage: Cannot send empty message');

    console.log(`[SendMessageUseCase] sendMessage called for thread ${input.threadId}, user ${input.userId}`);

    // Ensure storage is initialized
    try {
      await this.ensureStorageInitialized();
    } catch (error) {
      console.error('[SendMessageUseCase] Storage initialization failed:', error);
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Ensure thread exists (both in Mastra and Drizzle)
    try {
      await this.memoryService.getOrCreateThread(input.threadId, input.userId);
    } catch (error) {
      console.error('[SendMessageUseCase] Thread creation failed:', error);
      throw new Error(`Failed to create or access thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const now = new Date();
    const userMsgId = `msg-${Date.now()}-user`;

    // 1. Store USER message in Mastra Memory
    try {
      console.log(`[SendMessageUseCase] Storing USER message in Mastra Memory...`);
      await this.storage.saveMessages({
        messages: [{
          id: userMsgId,
          threadId: input.threadId,
          resourceId: input.userId, // Required by Mastra storage
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: input.message }] },
          createdAt: now,
          type: 'text'
        }]
      });
      console.log(`[SendMessageUseCase] USER message stored in Mastra`);
    } catch (error) {
      console.error(`[SendMessageUseCase] Failed to store user message in Mastra:`, error);
    }

    // Build enhanced message with working memory
    let enhancedMessage = input.message;
    let workingMemorySummary: string | undefined;

    if (input.includeWorkingMemory) {
      try {
        workingMemorySummary = await this.workingMemoryService.getWorkingMemorySummary(input.userId, input.threadId);
        if (workingMemorySummary && workingMemorySummary.trim().length > 50) {
          enhancedMessage = `${workingMemorySummary}\n\n---\n\nUser Message: ${input.message}`;
        }
      } catch (err) {
        console.warn('[SendMessageUseCase] Failed to get working memory:', err);
      }
    }

    // Generate response
    console.log(`[SendMessageUseCase] Generating response...`);
    let responseText = '';

    try {
      // We use generateLegacy but we ignore its internal storage side-effects since we do it manually
      // We pass threadId/resourceId just in case it helps retrieval
      const response = await this.chatAgent.generateLegacy(enhancedMessage, {
        resourceId: input.userId,
        threadId: input.threadId,
        googleTokens: input.googleTokens,
      } as any);

      if (!response || !response.text) {
        throw new Error('AI agent returned an invalid response');
      }

      responseText = response.text;
    } catch (error) {
      console.error(`[SendMessageUseCase] Error generating response:`, error);
      throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const assistantMsgId = `msg-${Date.now()}-assistant`;
    const assistantCreatedAt = new Date();

    // 2. Store ASSISTANT message in Mastra Memory
    try {
      console.log(`[SendMessageUseCase] Storing ASSISTANT message in Mastra Memory...`);
      await this.storage.saveMessages({
        messages: [{
          id: assistantMsgId,
          threadId: input.threadId,
          resourceId: input.userId, // Required by Mastra storage
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: responseText }] },
          createdAt: assistantCreatedAt,
          type: 'text'
        }]
      });
      console.log(`[SendMessageUseCase] ASSISTANT message stored in Mastra`);
    } catch (error) {
      console.error(`[SendMessageUseCase] Failed to store assistant message in Mastra:`, error);
    }

    // Update thread timestamp
    try {
      await this.storage.updateThread({
        id: input.threadId,
        title: 'Chat', // We could refine this
        metadata: {},
      });
    } catch (e) {
      console.warn('[SendMessageUseCase] Failed to update thread timestamp:', e);
    }

    return {
      userMessage: {
        id: userMsgId,
        role: 'user',
        content: input.message,
        createdAt: now,
      },
      assistantMessage: {
        id: assistantMsgId,
        role: 'assistant',
        content: responseText,
        createdAt: assistantCreatedAt,
      },
      threadId: input.threadId,
      workingMemorySummary,
    };
  }
}

