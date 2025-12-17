import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { googleService } from '../services/googleService.js';

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
            if (!userId) {
                return { 
                    error: 'User ID is missing from tool context',
                    messages: []
                };
            }

            const { query, maxResults } = data;
            const messages = await googleService.listGmail(userId, query, maxResults);

            return { messages };

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
        maxResults: z.number().optional().default(20).describe('Maximum number of contacts to list'),
    }),
    execute: async (data, executionContext) => {
        try {
            const userId = (executionContext as any)?.resourceId;
            if (!userId) {
                return { 
                    error: 'User ID is missing from tool context',
                    contacts: []
                };
            }

            const { maxResults } = data;
            const contacts = await googleService.listContacts(userId, maxResults);

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
