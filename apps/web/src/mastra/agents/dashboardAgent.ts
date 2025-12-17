
import { Agent } from '@mastra/core/agent';
import { standardMemory } from '../config/memory.js';
import { listGmail, listContacts } from '../../tools/google-tools.js';
import { openrouter } from '@openrouter/ai-sdk-provider';

export const dashboardAgent = new Agent({
    name: 'Dashboard Agent',
    id: 'dashboard-agent',
    instructions: `
        You are a helpful assistant that can access the user's Gmail and Google Contacts.
        
        When asked about emails:
        - Use the list_gmail tool to find relevant emails.
        - You can filter by sender (from:), specific words, or unread status (is:unread).
        - summaries the emails concisely, mentioning the sender, subject, and date.
        
        When asked about contacts:
        - Use the list_contacts tool to find contacts.
        - You can list all contacts or look for specific names.
        
        Always provide a friendly and helpful response. If you cannot find the information, explain why.
        
        Do not make up information. Only state what is returned by the tools.
    `,
    model: openrouter('openai/gpt-4o-mini'),
    memory: standardMemory as any,
    tools: {
        listGmail,
        listContacts
    }
});
