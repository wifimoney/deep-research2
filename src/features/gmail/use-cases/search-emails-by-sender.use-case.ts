import type { UseCase } from '../../shared/types/use-case.types.js';
import type { GmailMessage } from '../../shared/entities/email.entity.js';
import type * as GoogleServiceModule from '../../../../my-app/src/services/googleService.js';

type GoogleService = typeof GoogleServiceModule.googleService;

export interface SearchEmailsBySenderInput {
  userId: string;
  sender: string;
  maxResults?: number;
}

export interface SearchEmailsBySenderOutput {
  messages: GmailMessage[];
}

export class SearchEmailsBySenderUseCase implements UseCase<SearchEmailsBySenderInput, SearchEmailsBySenderOutput> {
  constructor(
    private readonly googleService: GoogleService
  ) {}

  async execute(input: SearchEmailsBySenderInput): Promise<SearchEmailsBySenderOutput> {
    if (!input.sender) {
      throw new Error('Sender email is required');
    }

    // Build query for sender search
    const query = `from:${input.sender}`;
    const maxResults = input.maxResults || 10;

    const messages = await this.googleService.listGmail(input.userId, query, maxResults);
    return { messages };
  }
}

