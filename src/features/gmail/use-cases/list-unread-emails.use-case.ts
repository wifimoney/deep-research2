import type { UseCase } from '../../shared/types/use-case.types.js';
import type { GmailMessage } from '../../shared/entities/email.entity.js';
import type * as GoogleServiceModule from '../../../../my-app/src/services/googleService.js';

type GoogleService = typeof GoogleServiceModule.googleService;

export interface ListUnreadEmailsInput {
  userId: string;
  maxResults?: number;
}

export interface ListUnreadEmailsOutput {
  messages: GmailMessage[];
}

export class ListUnreadEmailsUseCase implements UseCase<ListUnreadEmailsInput, ListUnreadEmailsOutput> {
  constructor(
    private readonly googleService: GoogleService
  ) {}

  async execute(input: ListUnreadEmailsInput): Promise<ListUnreadEmailsOutput> {
    // Build query for unread emails
    const query = 'is:unread';
    const maxResults = input.maxResults || 10;

    try {
      const messages = await this.googleService.listGmail(input.userId, query, maxResults);
      return { messages };
    } catch (error) {
      console.error('='.repeat(60));
      console.error('[ListUnreadEmailsUseCase] List Gmail error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        // Check for 403/scope errors
        if (error.message.includes('403') || error.message.includes('insufficient') || error.message.includes('scope')) {
          console.error('⚠️  SCOPE ERROR DETECTED: OAuth token missing Gmail scopes!');
          console.error('   Solution: Re-authenticate with Google to get new token with gmail.readonly scope');
        }
      }
      console.error('='.repeat(60));
      throw error;
    }
  }
}

