import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { googleService, getValidTokenFromAccount } from '../services/googleService.js';

export const listGmail = createTool({
    id: 'list_gmail',
    description: 'List recent emails from the user\'s Gmail account',
    inputSchema: z.object({
        query: z.string().optional().describe('Search query for filtering emails (e.g., "from:boss", "is:unread")'),
        maxResults: z.number().optional().default(10).describe('Maximum number of emails to return (default 10)'),
    }),
    execute: async (data, executionContext) => {
        try {
            // Mastra passes the resourceId as executionContext.resourceId if provided in generate()
            const userId = (executionContext as any)?.resourceId;
            const googleTokens = (executionContext as any)?.googleTokens;

            if (!userId) {
                console.error('[Tool: list_gmail] Missing userId in context');
                return { error: 'User ID is missing from tool context' };
            }

            if (!googleTokens) {
                console.error('[Tool: list_gmail] Missing googleTokens in context');
                return { error: 'Google authentication tokens missing from context' };
            }

            // Get valid access token (refreshes if needed)
            const accessToken = await getValidTokenFromAccount(googleTokens);

            const { query, maxResults } = data;
            const messages = await googleService.listGmail(userId, query, maxResults, accessToken);

            return { messages };

        } catch (error: any) {
            console.error('[Tool: list_gmail] Error:', error);
            return { error: error.message };
        }
    }
});

export const listContacts = createTool({
    id: 'list_contacts',
    description: 'List user\'s Google Contacts',
    inputSchema: z.object({
        maxResults: z.number().optional().default(20).describe('Maximum number of contacts to list'),
    }),
    execute: async (data, executionContext) => {
        try {
            const userId = (executionContext as any)?.resourceId;
            const googleTokens = (executionContext as any)?.googleTokens;

            if (!userId) {
                console.error('[Tool: list_contacts] Missing userId in context');
                return { error: 'User ID is missing from tool context' };
            }

            if (!googleTokens) {
                console.error('[Tool: list_contacts] Missing googleTokens in context');
                return { error: 'Google authentication tokens missing from context' };
            }

            // Get valid access token (refreshes if needed)
            const accessToken = await getValidTokenFromAccount(googleTokens);

            const { maxResults } = data;
            const contacts = await googleService.listContacts(userId, maxResults, accessToken);

            return { contacts };

        } catch (error: any) {
            console.error('[Tool: list_contacts] Error:', error);
            return { error: error.message };
        }
    }
});
