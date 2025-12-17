import { Agent } from '@mastra/core/agent';
import { standardMemory as memory } from '../../../src/mastra/config/memory.js';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { openai } from '@ai-sdk/openai';
import { apiKeysConfig } from '../../../src/mastra/config/config.js';
import { listGmail, listContacts } from '../tools/google-tools.js';

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
  id: 'chat-agent',
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
  // Use OpenRouter if API key is available, otherwise use OpenAI directly
  model: (() => {
    // Log configuration at startup
    console.log('[ChatAgent] Initializing model provider...');
    console.log('[ChatAgent] OpenRouter key available:', !!apiKeysConfig.openrouter);
    console.log('[ChatAgent] OpenAI key available:', !!apiKeysConfig.openai);

    if (apiKeysConfig.openrouter) {
      console.log('[ChatAgent] ✅ Using OpenRouter provider');
      // Assuming env var OPENROUTER_API_KEY is set, or we need to configure the provider elsewhere.
      // The default export 'openrouter' usually reads from env.
      return openrouter('openai/gpt-4o-mini');
    } else if (apiKeysConfig.openai) {
      console.log('[ChatAgent] ✅ Using OpenAI provider');
      const openaiKey = apiKeysConfig.openai;
      // Verify key format
      if (!openaiKey.startsWith('sk-')) {
        console.warn('[ChatAgent] ⚠️  Warning: OpenAI API key does not start with "sk-"');
      }
      // OpenAI provider reads OPENAI_API_KEY from process.env by default
      return openai('gpt-4o-mini');
    } else {
      console.error('[ChatAgent] ❌ No API key configured');
      throw new Error('No API key configured. Please set OPENROUTER_API_KEY or OPENAI_API_KEY in your .env file.');
    }
  })(),
  memory: memory as any,
  tools: {
    listGmail,
    listContacts
  }
});
