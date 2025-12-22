import { getGoogleAccount } from '../../../integrations/google/data/google-oauth-repo.js'

export async function getGoogleTokensForUser(userId: string): Promise<any | null> {
    const account = await getGoogleAccount(userId)

    if (!account) {
        console.warn(`[GetGoogleTokens] No Google tokens found for user ${userId}`)
        return null
    }

    console.log('[GetGoogleTokens] Found Google tokens:', {
        hasAccessToken: !!account.accessToken,
        hasRefreshToken: !!account.refreshToken,
        expiresAt: account.accessTokenExpiresAt
    })

    return {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        accessTokenExpiresAt: account.accessTokenExpiresAt,
    }
}
