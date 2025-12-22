import { getGoogleAccount, updateGoogleTokens } from '../../data/google-oauth-repo.js'

export async function getValidGoogleToken(userId: string): Promise<string> {
    if (!userId) {
        throw new Error('User ID is missing')
    }

    const account = await getGoogleAccount(userId)

    if (!account) {
        throw new Error('No Google account connected. Please connect your Google account in settings.')
    }

    if (!account.accessToken) {
        throw new Error('NO_ACCESS_TOKEN: Google account found but missing access token.')
    }

    // Check if token is expired (or close to expiring, e.g., within 5 minutes)
    const now = new Date()
    const expiry = account.accessTokenExpiresAt
    const isExpired = expiry && (expiry.getTime() - now.getTime() < 5 * 60 * 1000)

    if (isExpired && account.refreshToken) {
        console.log('[GetValidGoogleToken] Access token expired, refreshing...')
        try {
            const tokenParams = new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                refresh_token: account.refreshToken,
                grant_type: 'refresh_token',
            })

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: tokenParams.toString(),
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error('[GetValidGoogleToken] Failed to refresh token:', errorText)
                throw new Error(`Failed to refresh Google token: ${errorText}`)
            }

            const data = await response.json()
            const newAccessToken = data.access_token
            const newExpiresAt = new Date(Date.now() + data.expires_in * 1000)

            // Update database
            await updateGoogleTokens(
                userId,
                newAccessToken,
                newExpiresAt,
                data.refresh_token
            )

            return newAccessToken
        } catch (error) {
            console.error('[GetValidGoogleToken] Token refresh error:', error)
            throw error
        }
    }

    return account.accessToken
}
