import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { listGmail as listGmailUseCase } from '../core/usecases/ListGmail.js'
import { listContacts as listContactsUseCase } from '../core/usecases/ListContacts.js'
import { getValidGoogleToken } from '../core/usecases/GetValidGoogleToken.js'
import { getGoogleAccount } from '../data/google-oauth-repo.js'

console.log('Using google-tools.ts from my-app/src/tools/google-tools.ts')

/**
 * Helper to get an access token from googleTokens context
 */
async function getAccessTokenFromContext(googleTokens: any, userId: string): Promise<string | undefined> {
    if (!googleTokens) return undefined

    const account = {
        userId,
        providerId: 'google',
        accessToken: googleTokens.accessToken,
        refreshToken: googleTokens.refreshToken,
        accessTokenExpiresAt: googleTokens.accessTokenExpiresAt,
        updatedAt: new Date(),
    }

    // Check if token is expired
    const now = new Date()
    const expiry = account.accessTokenExpiresAt
    const isExpired = expiry && (new Date(expiry).getTime() - now.getTime() < 5 * 60 * 1000)

    if (isExpired && account.refreshToken) {
        // Let the use case handle refresh
        return await getValidGoogleToken(userId)
    }

    return account.accessToken || undefined
}

export const listGmail = createTool({
    id: 'list_gmail',
    description: 'List recent emails from the user\'s Gmail account',
    inputSchema: z.object({
        userId: z.string().optional().describe('The user ID (provided in context)'),
        query: z.string().optional().describe('Search query for filtering emails (e.g., "from:boss", "is:unread")'),
        maxResults: z.number().optional().default(10).describe('Maximum number of emails to return (default 10)'),
    }),
    execute: async (data, executionContext) => {
        console.log('[Tool: list_gmail] usage detected. Context keys:', Object.keys(executionContext || {}))

        try {
            const userId = data.userId || (executionContext as any)?.resourceId
            const googleTokens = (executionContext as any)?.googleTokens || (executionContext as any)?.context?.googleTokens

            console.log(`[Tool: list_gmail] userId present: ${!!userId}, googleTokens present: ${!!googleTokens}`)

            if (!userId) {
                console.error('[Tool: list_gmail] Error: User ID is missing')
                return {
                    error: 'User ID is missing from tool context',
                    messages: []
                }
            }

            let accessToken: string | undefined

            if (googleTokens) {
                console.log('[Tool: list_gmail] Using provided Google tokens')
                accessToken = await getAccessTokenFromContext(googleTokens, userId)
            } else {
                console.log('[Tool: list_gmail] No tokens in context, falling back to DB lookup via userId')
            }

            console.log('[Tool: list_gmail] Calling API...')

            const { query, maxResults } = data
            const messages = await listGmailUseCase(userId, query, maxResults, accessToken)
            console.log(`[Tool: list_gmail] API success. Found ${messages.length} messages.`)

            return { messages }

        } catch (error: any) {
            console.error('[Tool: list_gmail] Caught error:', error)
            const errorMessage = error.message || 'Unknown error'
            const isScopeError = errorMessage.includes('403') ||
                errorMessage.includes('insufficient') ||
                errorMessage.includes('scope') ||
                errorMessage.includes('PERMISSION_DENIED')
            const isAuthError = errorMessage.includes('No Google account') ||
                errorMessage.includes('missing access token')

            return {
                error: isScopeError
                    ? 'OAuth token missing required Gmail scopes. The user needs to log out and log back in with Google to grant Gmail permissions.'
                    : isAuthError
                        ? 'No Google account connected or missing access token. Please connect your Google account in settings.'
                        : errorMessage,
                messages: [],
                scopeError: isScopeError,
                authError: isAuthError
            }
        }
    }
})

export const listContacts = createTool({
    id: 'list_contacts',
    description: 'List user\'s Google Contacts',
    inputSchema: z.object({
        userId: z.string().optional().describe('The user ID (provided in context)'),
        maxResults: z.number().optional().default(20).describe('Maximum number of contacts to list'),
    }),
    execute: async (data, executionContext) => {
        try {
            const userId = data.userId || (executionContext as any)?.resourceId
            const googleTokens = (executionContext as any)?.googleTokens || (executionContext as any)?.context?.googleTokens

            if (!userId) {
                return {
                    error: 'User ID is missing from tool context',
                    contacts: []
                }
            }

            let accessToken: string | undefined

            if (googleTokens) {
                accessToken = await getAccessTokenFromContext(googleTokens, userId)
            } else {
                console.log('[Tool: list_contacts] No tokens in context, falling back to DB lookup via userId')
            }

            const { maxResults } = data
            const contacts = await listContactsUseCase(userId, maxResults, accessToken)

            return { contacts }

        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error'
            const isScopeError = errorMessage.includes('403') ||
                errorMessage.includes('insufficient') ||
                errorMessage.includes('scope') ||
                errorMessage.includes('PERMISSION_DENIED')
            const isAuthError = errorMessage.includes('No Google account') ||
                errorMessage.includes('missing access token')

            return {
                error: isScopeError
                    ? 'OAuth token missing required Contacts scopes. The user needs to log out and log back in with Google to grant Contacts permissions.'
                    : isAuthError
                        ? 'No Google account connected or missing access token. Please connect your Google account in settings.'
                        : errorMessage,
                contacts: [],
                scopeError: isScopeError,
                authError: isAuthError
            }
        }
    }
})

