import { query } from '@repo/db'
import { hashPassword } from '../../../shared/auth/utils.js'

// User type
export interface User {
  id: string
  username: string
  email: string
  password_hash: string
  created_at: Date
}

/**
 * Create a new user with hashed password
 */
export async function createUser(
  username: string,
  email: string,
  password: string
): Promise<User> {
  const passwordHash = await hashPassword(password)

  const result = await query<User>(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, password_hash, created_at`,
    [username, email.toLowerCase(), passwordHash]
  )

  return result.rows[0]
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT id, username, email, password_hash, created_at
     FROM users
     WHERE email = $1`,
    [email.toLowerCase()]
  )

  return result.rows[0] || null
}

/**
 * Find user by username
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT id, username, email, password_hash, created_at
     FROM users
     WHERE username = $1`,
    [username]
  )

  return result.rows[0] || null
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT id, username, email, password_hash, created_at
     FROM users
     WHERE id = $1`,
    [id]
  )

  return result.rows[0] || null
}
