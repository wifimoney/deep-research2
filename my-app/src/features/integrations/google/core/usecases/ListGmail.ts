import { getValidGoogleToken } from './GetValidGoogleToken.js'

export interface GmailMessage {
    id: string
    threadId: string
    snippet: string
    date: string
    from?: string
    subject?: string
}

export async function listGmail(
    userId: string,
    query?: string,
    maxResults: number = 10,
    accessToken?: string
): Promise<GmailMessage[]> {
    const token = accessToken || await getValidGoogleToken(userId)

    const params = new URLSearchParams()
    params.append('maxResults', String(maxResults))
    if (query) {
        params.append('q', query)
    }

    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    })

    if (!listRes.ok) {
        const errorText = await listRes.text()
        throw new Error(`Gmail API error: ${listRes.status} ${errorText}`)
    }

    const listData = await listRes.json()
    const messages = listData.messages || []

    if (messages.length === 0) {
        return []
    }

    // Fetch details for each message
    const details = await Promise.all(messages.map(async (msg: any) => {
        try {
            const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!detailRes.ok) return null

            const data = await detailRes.json()
            const headers = data.payload?.headers || []
            const subject = headers.find((h: any) => h.name === 'Subject')?.value
            const from = headers.find((h: any) => h.name === 'From')?.value

            return {
                id: data.id,
                threadId: data.threadId,
                snippet: data.snippet,
                date: new Date(parseInt(data.internalDate)).toISOString(),
                subject,
                from
            }
        } catch (e) {
            console.error(`Error fetching email details for ${msg.id}:`, e)
            return null
        }
    }))

    return details.filter((m): m is GmailMessage => m !== null)
}
