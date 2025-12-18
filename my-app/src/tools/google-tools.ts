import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { googleService, getValidTokenFromAccount } from '../services/googleService.js';

console.log('Using google-tools.ts from my-app/src/tools/google-tools.ts');

export const listGmail = createTool({
    id: 'list_gmail',
    description: 'List recent emails from the user\'s Gmail account',
    inputSchema: z.object({
        userId: z.string().optional().describe('The user ID (provided in context)'),
        query: z.string().optional().describe('Search query for filtering emails (e.g., "from:boss", "is:unread")'),
        maxResults: z.number().optional().default(10).describe('Maximum number of emails to return (default 10)'),
    }),
    execute: async (data, executionContext) => {
        console.log('[Tool: list_gmail] usage detected. Context keys:', Object.keys(executionContext || {}));

        try {
            // Mastra passes the resourceId as executionContext.resourceId if provided in generate()
            const userId = data.userId || (executionContext as any)?.resourceId;
            // Check both root and context property
            const googleTokens = (executionContext as any)?.googleTokens || (executionContext as any)?.context?.googleTokens;

            console.log(`[Tool: list_gmail] userId present: ${!!userId}, googleTokens present: ${!!googleTokens}`);

            if (!userId) {
                console.error('[Tool: list_gmail] Error: User ID is missing');
                return {
                    error: 'User ID is missing from tool context',
                    messages: []
                };
            }

            let accessToken: string | undefined;

            if (googleTokens) {
                console.log('[Tool: list_gmail] Using provided Google tokens');
                accessToken = await getValidTokenFromAccount(googleTokens);
            } else {
                console.log('[Tool: list_gmail] No tokens in context, falling back to DB lookup via userId');
            }

            console.log('[Tool: list_gmail] Calling API...');

            const { query, maxResults } = data;
            const messages = await googleService.listGmail(userId, query, maxResults, accessToken);
            console.log(`[Tool: list_gmail] API success. Found ${messages.length} messages.`);

            return { messages };

        } catch (error: any) {
            console.error('[Tool: list_gmail] Caught error:', error);
            // Check for scope errors specifically
            const errorMessage = error.message || 'Unknown error';
            const isScopeError = errorMessage.includes('403') ||
                errorMessage.includes('insufficient') ||
                errorMessage.includes('scope') ||
                errorMessage.includes('PERMISSION_DENIED');
            const isAuthError = errorMessage.includes('No Google account') ||
                errorMessage.includes('missing access token');

            return {
                error: isScopeError
                    ? 'OAuth token missing required Gmail scopes. The user needs to log out and log back in with Google to grant Gmail permissions.'
                    : isAuthError
                        ? 'No Google account connected or missing access token. Please connect your Google account in settings.'
                        : errorMessage,
                messages: [],
                scopeError: isScopeError,
                authError: isAuthError
            };
        }
    }
});

export const listContacts = createTool({
    id: 'list_contacts',
    description: 'List user\'s Google Contacts',
    inputSchema: z.object({
        userId: z.string().optional().describe('The user ID (provided in context)'),
        maxResults: z.number().optional().default(20).describe('Maximum number of contacts to list'),
    }),
    execute: async (data, executionContext) => {
        try {
            const userId = data.userId || (executionContext as any)?.resourceId;
            const googleTokens = (executionContext as any)?.googleTokens || (executionContext as any)?.context?.googleTokens;

            if (!userId) {
                return {
                    error: 'User ID is missing from tool context',
                    contacts: []
                };
            }

            let accessToken: string | undefined;

            if (googleTokens) {
                accessToken = await getValidTokenFromAccount(googleTokens);
            } else {
                console.log('[Tool: list_contacts] No tokens in context, falling back to DB lookup via userId');
            }

            const { maxResults } = data;
            const contacts = await googleService.listContacts(userId, maxResults, accessToken);

            return { contacts };

        } catch (error: any) {
            // Check for scope errors specifically
            const errorMessage = error.message || 'Unknown error';
            const isScopeError = errorMessage.includes('403') ||
                errorMessage.includes('insufficient') ||
                errorMessage.includes('scope') ||
                errorMessage.includes('PERMISSION_DENIED');
            const isAuthError = errorMessage.includes('No Google account') ||
                errorMessage.includes('missing access token');

            return {
                error: isScopeError
                    ? 'OAuth token missing required Contacts scopes. The user needs to log out and log back in with Google to grant Contacts permissions.'
                    : isAuthError
                        ? 'No Google account connected or missing access token. Please connect your Google account in settings.'
                        : errorMessage,
                contacts: [],
                scopeError: isScopeError,
                authError: isAuthError
            };
        }
    }
});
