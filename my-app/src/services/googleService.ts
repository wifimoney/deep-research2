
import { db } from '../db/drizzle.js';
import { oauthAccounts } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * Helper to get Google Access Token for a user
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

    if (!account || !account.accessToken) {
        throw new Error('No Google account connected or missing access token. Please connect your Google account in settings.');
    }

    return account.accessToken;
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
     */
    async listGmail(userId: string, query?: string, maxResults: number = 10): Promise<GmailMessage[]> {
        const token = await getGoogleToken(userId);

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
     */
    async listContacts(userId: string, maxResults: number = 20): Promise<GoogleContact[]> {
        const token = await getGoogleToken(userId);

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
