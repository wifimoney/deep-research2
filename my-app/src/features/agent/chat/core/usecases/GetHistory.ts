import { fetchHistory, type Message } from '../../data/chat-repo.js'

export async function getHistory(userId: string, threadId: string): Promise<Message[]> {
    if (!threadId) throw new Error('threadId is required')
    return await fetchHistory(userId, threadId)
}
