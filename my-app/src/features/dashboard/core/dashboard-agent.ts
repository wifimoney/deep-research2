
import { Agent } from '@mastra/core/agent';
import { standardMemory } from '../../../shared/mastra/config/memory.js';
import { listGmail, listContacts } from '../../integrations/google/tools/google-tools.js';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { openai } from '@ai-sdk/openai';
import { apiKeysConfig } from '../../../shared/mastra/config/config.js';

export const dashboardAgent = new Agent({
    name: 'Dashboard Agent',
    id: 'dashboard-agent',
    instructions: `
        You are a helpful assistant that can access the user's Gmail and Google Contacts.
        
        You MUST use the provided tools to answer questions about emails or contacts.
        
        When asked about emails:
        - Use the list_gmail tool.
        
        When asked about contacts:
        - Use the list_contacts tool.
        
        Do not guess. Use the tools.
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
