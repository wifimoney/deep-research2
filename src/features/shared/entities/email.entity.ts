/**
 * Email domain entity
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  date: string;
  from?: string;
  subject?: string;
}

