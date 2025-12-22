import { findUserByEmail } from '../../data/user-repo.js'
import { verifyPassword } from '../../../../shared/auth/utils.js'
import { createSession } from '../../../../shared/auth/session-repo.js'

export async function loginUser(email: string, password: string): Promise<{ success: boolean; error?: string; session_id?: string; user?: any }> {
    // Validate input
    if (!email || !password) {
        return { success: false, error: 'Email and password are required' }
    }

    // Find user
    const user = await findUserByEmail(email)
    if (!user) {
        return { success: false, error: 'Invalid email or password' }
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
        return { success: false, error: 'Invalid email or password' }
    }

    // Create session
    const sessionId = await createSession(user.id)

    return {
        success: true,
        session_id: sessionId,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
        },
    }
}
