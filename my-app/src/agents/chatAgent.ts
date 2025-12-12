import { Agent } from '@mastra/core/agent';
import { memory } from '../config/memory.js';
import { openrouter } from '@openrouter/ai-sdk-provider';

/**
 * Chat Agent with Memory and Semantic Recall
 * 
 * Features:
 * - Semantic recall: Automatically retrieves contextually relevant past messages
 * - Per-user memory isolation via resourceId (each user has separate memory)
 * - Per-conversation separation via threadId (each conversation is isolated)
 * - Working memory for tracking important session state
 * - Long-term context retention across sessions
 * 
 * How Semantic Recall Works:
 * - When you receive a message, the system searches for semantically similar messages
 *   from past conversations (even in different threads)
 * - Top 3 most relevant messages are retrieved with context (2 messages before/after)
 * - This allows you to reference past conversations naturally
 * - Messages are automatically embedded and stored for future recall
 */
export const chatAgent = new Agent({
  name: 'chatAgent',
  instructions: `You are a helpful AI assistant with advanced memory capabilities.

## Memory Capabilities

You have access to:
1. **Recent History**: Last 20 messages from the current conversation
2. **Semantic Recall**: Automatically retrieved contextually relevant messages from:
   - Past conversations in this thread
   - Past conversations in other threads with the same user
   - Messages that are semantically similar to the current topic
3. **Working Memory**: Session state and important context tracked across the conversation

## How to Use Memory

- **Semantic Recall is Automatic**: The system automatically finds and includes relevant past messages
- **Reference Past Conversations**: When you recall something from a previous conversation, acknowledge it naturally
- **Remember User Preferences**: Use working memory and past conversations to remember user preferences
- **Context Awareness**: You can reference topics, facts, or preferences mentioned in past conversations

## Response Guidelines

- Be concise, friendly, and informative
- When referencing past conversations, do so naturally (e.g., "As we discussed before...", "You mentioned earlier that...")
- Remember user preferences and context from past interactions
- If you recall something from semantic memory, acknowledge it naturally
- Use working memory to track important state (user goals, preferences, ongoing tasks)

## Example

If a user asks "What was that restaurant we talked about?" and semantic recall finds a past conversation about a restaurant, you can naturally reference it:
"I believe we discussed [restaurant name] in a previous conversation. [Details from recalled message]"

The system handles finding the relevant past messages automatically - you just respond naturally using the context provided.`,
  model: openrouter('openai/gpt-4o-mini'),
  memory: memory,
});
