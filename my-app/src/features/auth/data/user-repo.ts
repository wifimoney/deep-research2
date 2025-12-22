import { query } from '@repo/db'

export interface User {
    id: string
    username: string
    email: string
    password_hash: string
    created_at: Date
}

export async function createUser(
    username: string,
    email: string,
    passwordHash: string
): Promise<User> {
    const result = await query<User>(
        `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, password_hash, created_at`,
        [username, email.toLowerCase(), passwordHash]
    )
    return result.rows[0]
}

export async function findUserByEmail(email: string): Promise<User | null> {
    const result = await query<User>(
        `SELECT id, username, email, password_hash, created_at
     FROM users
     WHERE email = $1`,
        [email.toLowerCase()]
    )
    return result.rows[0] || null
}

export async function findUserByUsername(username: string): Promise<User | null> {
    const result = await query<User>(
        `SELECT id, username, email, password_hash, created_at
     FROM users
     WHERE username = $1`,
        [username]
    )
    return result.rows[0] || null
}

export async function findUserById(id: string): Promise<User | null> {
    const result = await query<User>(
        `SELECT id, username, email, password_hash, created_at
     FROM users
     WHERE id = $1`,
        [id]
    )
    return result.rows[0] || null
}
