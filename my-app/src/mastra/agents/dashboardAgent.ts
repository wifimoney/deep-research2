
import { Agent } from '@mastra/core/agent';
import { standardMemory } from '../../mastra/config/memory.js';
import { listGmail, listContacts } from '../../tools/google-tools.js';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { openai } from '@ai-sdk/openai';
import { apiKeysConfig } from '../../mastra/config/config.js';

export const dashboardAgent = new Agent({
    name: 'Dashboard Agent',
    id: 'dashboard-agent',
    instructions: `
        You are a helpful assistant that can access the user's Gmail and Google Contacts.
        
        When asked about emails:
        - Use the list_gmail tool to find relevant emails.
        - You can filter by sender (from:), specific words, or unread status (is:unread).
        - Summarize the emails concisely, mentioning the sender, subject, and date.
        
        When asked about contacts:
        - Use the list_contacts tool to find contacts.
        - You can list all contacts or look for specific names.
        
        **IMPORTANT - Error Handling:**
        - If a tool returns an error, read the error message carefully and explain it clearly to the user
        - If the error mentions "scope", "403", "OAuth token", or "PERMISSION_DENIED", tell the user: "I need permission to access your Gmail/Contacts. Please log out and log back in with Google to grant the necessary permissions."
        - If the error mentions "No Google account connected" or "missing access token", tell the user: "Your Google account isn't connected yet. Please connect your Google account in settings."
        - Always explain the specific issue to the user clearly - don't just say "technical issue" or "unable to access"
        - Be friendly and helpful, guiding the user on what they need to do to fix the issue
        
        Always provide a friendly and helpful response. If you cannot find the information, explain why clearly.
        
        Do not make up information. Only state what is returned by the tools.
    `,
    // Use OpenRouter if API key is available, otherwise use OpenAI directly
    model: (() => {
        if (apiKeysConfig.openrouter) {
            return openrouter('openai/gpt-4o-mini');
        } else if (apiKeysConfig.openai) {
            return openai('gpt-4o-mini');
        } else {
            throw new Error('No API key configured. Please set OPENROUTER_API_KEY or OPENAI_API_KEY in your .env file.');
        }
    })(),
    memory: standardMemory as any,
    tools: {
        listGmail,
        listContacts
    }
});
