import { deleteSession } from '../../../../shared/auth/session-repo.js'

export async function logoutUser(sessionId: string): Promise<void> {
    await deleteSession(sessionId)
}
