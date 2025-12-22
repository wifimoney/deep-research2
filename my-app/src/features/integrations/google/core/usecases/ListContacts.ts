import { getValidGoogleToken } from './GetValidGoogleToken.js'

export interface GoogleContact {
    resourceName: string | undefined
    name: string | undefined
    email: string | undefined
    phone: string | undefined
}

export async function listContacts(
    userId: string,
    maxResults: number = 20,
    accessToken?: string
): Promise<GoogleContact[]> {
    const token = accessToken || await getValidGoogleToken(userId)

    const params = new URLSearchParams()
    params.append('pageSize', String(maxResults))
    params.append('personFields', 'names,emailAddresses,phoneNumbers')

    const res = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params.toString()}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })

    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`People API error: ${res.status} ${errorText}`)
    }

    const json = await res.json()
    const connections = json.connections || []

    return connections.map((c: any) => ({
        name: c.names?.[0]?.displayName,
        email: c.emailAddresses?.[0]?.value,
        phone: c.phoneNumbers?.[0]?.value,
        resourceName: c.resourceName
    }))
}
