import { Mastra } from '@mastra/core/mastra';
import { memory, storage } from './config/memory.js';
import { chatAgent } from './agents/chatAgent.js';

// Create Mastra instance
// Note: Memory is configured at the agent level, not here
// Type assertion needed due to beta version type compatibility
export const mastra = new Mastra({
  storage: storage as any,
  agents: {
    chatAgent,
  },
});

// Re-export memory and storage instances for use in services
export { memory, storage };