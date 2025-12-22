import { db } from '../../../../shared/db/drizzle.js'
import { oauthAccounts } from '../../../../shared/db/schema.js'
import { eq, and } from 'drizzle-orm'

export interface OAuthAccount {
    userId: string
    providerId: string
    accessToken: string | null
    refreshToken: string | null
    accessTokenExpiresAt: Date | null
    updatedAt: Date
}

export async function getGoogleAccount(userId: string): Promise<OAuthAccount | null> {
    const account = await db.query.oauthAccounts.findFirst({
        where: and(
            eq(oauthAccounts.userId, userId),
            eq(oauthAccounts.providerId, 'google')
        ),
    })

    if (!account) return null

    return {
        userId: account.userId,
        providerId: account.providerId,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        accessTokenExpiresAt: account.accessTokenExpiresAt,
        updatedAt: account.updatedAt,
    }
}

export async function updateGoogleTokens(
    userId: string,
    accessToken: string,
    expiresAt: Date,
    refreshToken?: string
): Promise<void> {
    await db.update(oauthAccounts)
        .set({
            accessToken,
            accessTokenExpiresAt: expiresAt,
            updatedAt: new Date(),
            ...(refreshToken ? { refreshToken } : {})
        })
        .where(and(
            eq(oauthAccounts.userId, userId),
            eq(oauthAccounts.providerId, 'google')
        ))
}
