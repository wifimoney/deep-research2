import { Mastra } from '@mastra/core/mastra';
import { standardMemory as memory } from '../src/mastra/config/memory.js';
import { storage } from '../src/mastra/config/storage.js';
import { chatAgent } from './agents/chatAgent.js';

// Create Mastra instance
// Note: Memory is configured at the agent level, not here
// Type assertion needed due to beta version type compatibility
export const mastra = new Mastra({
  storage: storage as any,
  agents: {
    chatAgent,
  },
  observability: {
    default: {
      enabled: true, // Enabled for Mastra Studio - traces will appear automatically
    },
  },
});

// Re-export memory and storage instances for use in services
export { memory, storage };