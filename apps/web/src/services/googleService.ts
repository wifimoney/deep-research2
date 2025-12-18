
import { db, oauthAccounts } from '@repo/db';
import { eq, and } from 'drizzle-orm';

/**
 * Helper to ensure we have a valid access token from an account record
 * Refreshes if expired
 */
export async function getValidTokenFromAccount(account: typeof oauthAccounts.$inferSelect) {
    if (!account.accessToken) {
        throw new Error('NO_ACCESS_TOKEN: Google account found but missing access token.');
    }

    // Check if token is expired (or close to expiring, e.g., within 5 minutes)
    const now = new Date();
    const expiry = account.accessTokenExpiresAt;
    const isExpired = expiry && (expiry.getTime() - now.getTime() < 5 * 60 * 1000);

    if (isExpired && account.refreshToken) {
        console.log('[GoogleService] Access token expired, refreshing...');
        try {
            const tokenParams = new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                refresh_token: account.refreshToken,
                grant_type: 'refresh_token',
            });

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: tokenParams.toString(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                // If the refresh token is invalid, we can't do anything.
                // The caller should probable trigger a re-auth flow.
                console.error('[GoogleService] Failed to refresh token:', errorText);
                throw new Error(`Failed to refresh Google token: ${errorText}`);
            }

            const data = await response.json();
            const newAccessToken = data.access_token;
            // expires_in is in seconds
            const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

            // Update database
            await db.update(oauthAccounts)
                .set({
                    accessToken: newAccessToken,
                    accessTokenExpiresAt: newExpiresAt,
                    updatedAt: new Date(),
                    // Some providers rotate refresh tokens
                    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {})
                })
                .where(and(
                    eq(oauthAccounts.userId, account.userId),
                    eq(oauthAccounts.providerId, 'google')
                ));

            return newAccessToken;
        } catch (error) {
            console.error('[GoogleService] Token refresh error:', error);
            throw error;
        }
    }

    return account.accessToken;
}

/**
 * Helper to get Google Access Token for a user from DB
 */
async function getGoogleToken(userId: string) {
    if (!userId) {
        throw new Error('User ID is missing');
    }

    const account = await db.query.oauthAccounts.findFirst({
        where: and(
            eq(oauthAccounts.userId, userId),
            eq(oauthAccounts.providerId, 'google')
        ),
    });

    if (!account) {
        throw new Error('NO_GOOGLE_ACCOUNT: No Google account connected. Please sign in with Google to access Gmail and Contacts.');
    }

    return getValidTokenFromAccount(account);
}

export interface GmailMessage {
    id: string;
    threadId: string;
    snippet: string;
    date: string;
    from?: string;
    subject?: string;
}

export interface GoogleContact {
    resourceName: string | undefined;
    name: string | undefined;
    email: string | undefined;
    phone: string | undefined;
}

export const googleService = {
    /**
     * List recent emails from Gmail
     * @param userId User ID
     * @param query Search query
     * @param maxResults Max results
     * @param accessToken Optional access token (if provided, skips DB lookup)
     */
    async listGmail(userId: string, query?: string, maxResults: number = 10, accessToken?: string): Promise<GmailMessage[]> {
        const token = accessToken || await getGoogleToken(userId);

        const params = new URLSearchParams();
        params.append('maxResults', String(maxResults));
        if (query) {
            params.append('q', query);
        }

        const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!listRes.ok) {
            const errorText = await listRes.text();
            throw new Error(`Gmail API error: ${listRes.status} ${errorText}`);
        }

        const listData = await listRes.json();
        const messages = listData.messages || [];

        if (messages.length === 0) {
            return [];
        }

        // Fetch details for each message
        // Limit concurrency to avoid rate limits
        const details = await Promise.all(messages.map(async (msg: any) => {
            try {
                const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!detailRes.ok) return null;

                const data = await detailRes.json();
                const headers = data.payload?.headers || [];
                const subject = headers.find((h: any) => h.name === 'Subject')?.value;
                const from = headers.find((h: any) => h.name === 'From')?.value;

                return {
                    id: data.id,
                    threadId: data.threadId,
                    snippet: data.snippet,
                    date: new Date(parseInt(data.internalDate)).toISOString(),
                    subject,
                    from
                };
            } catch (e) {
                console.error(`Error fetching email details for ${msg.id}:`, e);
                return null;
            }
        }));

        return details.filter((m): m is GmailMessage => m !== null);
    },

    /**
     * List Google Contacts
     * @param userId User ID
     * @param maxResults Max results
     * @param accessToken Optional access token (if provided, skips DB lookup)
     */
    async listContacts(userId: string, maxResults: number = 20, accessToken?: string): Promise<GoogleContact[]> {
        const token = accessToken || await getGoogleToken(userId);

        const params = new URLSearchParams();
        params.append('pageSize', String(maxResults));
        params.append('personFields', 'names,emailAddresses,phoneNumbers');

        const res = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`People API error: ${res.status} ${errorText}`);
        }

        const json = await res.json();
        const connections = json.connections || [];

        return connections.map((c: any) => ({
            name: c.names?.[0]?.displayName,
            email: c.emailAddresses?.[0]?.value,
            phone: c.phoneNumbers?.[0]?.value,
            resourceName: c.resourceName
        }));
    }
};
