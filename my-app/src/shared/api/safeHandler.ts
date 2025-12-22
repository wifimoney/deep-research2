import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

type HandlerFunction<T = any> = (c: Context, next: Next) => Promise<T>

/**
 * Wraps a Hono route handler to catch errors and return consistent JSON responses.
 * Removes the need for try/catch blocks in every controller.
 */
export function safeHandler(fn: HandlerFunction) {
    return async (c: Context, next: Next) => {
        try {
            return await fn(c, next)
        } catch (error: any) {
            console.error('❌ safeHandler caught error:', error)

            // Handle Hono HTTPExceptions (e.g. c.text('...', 401) throws this sometimes or manual throws)
            if (error instanceof HTTPException) {
                return c.json({
                    success: false,
                    error: error.message
                }, error.status as ContentfulStatusCode)
            }

            // Default error response
            return c.json({
                success: false,
                error: error.message || 'Internal Server Error'
            }, 500)
        }
    }
}
