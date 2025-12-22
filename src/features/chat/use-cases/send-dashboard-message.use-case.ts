import type { UseCase } from '../../shared/types/use-case.types.js';
import type { Message } from '../../shared/entities/message.entity.js';
import type * as StorageModule from '../../../../my-app/src/mastra/config/storage.js';
import type * as DashboardAgentModule from '../../../../my-app/src/mastra/agents/dashboardAgent.js';
import type * as ConfigModule from '../../../../my-app/src/mastra/config/config.js';
import type * as MemoryServiceModule from '../../../../my-app/src/services/memoryService.js';

type Storage = typeof StorageModule.storage;
type DashboardAgent = typeof DashboardAgentModule.dashboardAgent;
type MemoryService = {
  getOrCreateThread: typeof MemoryServiceModule.getOrCreateThread;
};

export interface SendDashboardMessageInput {
  userId: string;
  threadId: string;
  message: string;
  googleTokens?: any;
}

export interface SendDashboardMessageOutput {
  userMessage: Message;
  assistantMessage: Message;
  threadId: string;
}

export class SendDashboardMessageUseCase implements UseCase<SendDashboardMessageInput, SendDashboardMessageOutput> {
  constructor(
    private readonly storage: Storage,
    private readonly ensureStorageInitialized: typeof StorageModule.ensureStorageInitialized,
    private readonly dashboardAgent: DashboardAgent,
    private readonly apiKeysConfig: typeof ConfigModule.apiKeysConfig,
    private readonly memoryService: MemoryService
  ) {}

  async execute(input: SendDashboardMessageInput): Promise<SendDashboardMessageOutput> {
    // Check for required environment variables
    if (!this.apiKeysConfig.hasAiKey) {
      throw new Error('API key not configured. Please set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable in your .env file.');
    }

    // Validate inputs
    if (!input.userId) throw new Error('sendDashboardMessage: userId is required');
    if (!input.threadId) throw new Error('sendDashboardMessage: threadId is required');
    if (!input.message || input.message.trim().length === 0) throw new Error('sendDashboardMessage: Cannot send empty message');

    // Ensure storage is initialized
    await this.ensureStorageInitialized();

    // Ensure thread exists (both in Mastra and Drizzle)
    await this.memoryService.getOrCreateThread(input.threadId, input.userId, 'Dashboard Chat');

    const now = new Date();
    const userMsgId = `msg-${Date.now()}-user`;

    // 1. Store USER message in Mastra Memory
    try {
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
    } catch (error) {
      console.error(`[SendDashboardMessageUseCase] Failed to store user message in Mastra:`, error);
    }

    // Generate response
    let responseText = '';

    try {
      // Inject userId into prompt to ensure tools receive it
      const promptWithContext = `${input.message}\n\n[System Note] Current User ID: ${input.userId}`;

      const response = await this.dashboardAgent.generate(promptWithContext, {
        resourceId: input.userId,
        threadId: input.threadId,
        googleTokens: input.googleTokens,
      } as any);

      if (!response || !response.text) {
        throw new Error('AI agent returned an invalid response');
      }

      responseText = response.text;
    } catch (error) {
      console.error(`[SendDashboardMessageUseCase] Error generating response:`, error);
      throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const assistantMsgId = `msg-${Date.now()}-assistant`;
    const assistantCreatedAt = new Date();

    // 2. Store ASSISTANT message in Mastra Memory
    try {
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
    } catch (error) {
      console.error(`[SendDashboardMessageUseCase] Failed to store assistant message in Mastra:`, error);
    }

    // Update thread timestamp
    try {
      await this.storage.updateThread({
        id: input.threadId,
        title: 'Dashboard Chat',
        metadata: {},
      });
    } catch (e) {
      console.warn('[SendDashboardMessageUseCase] Failed to update thread timestamp:', e);
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
    };
  }
}

