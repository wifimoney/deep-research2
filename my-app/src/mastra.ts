import { Mastra } from '@mastra/core/mastra';
import { standardMemory as memory } from './mastra/config/memory.js';
import { storage } from './mastra/config/storage.js';
import { chatAgent } from './agents/chatAgent.js';
import { dashboardAgent } from './mastra/agents/dashboardAgent.js';

// Create Mastra instance
// Note: Memory is configured at the agent level, not here
// Type assertion needed due to beta version type compatibility
export const mastra = new Mastra({
  storage: storage as any,
  agents: {
    chatAgent,
    dashboardAgent,
  },
  // Observability disabled - OpenTelemetry causes memory crashes with large payloads
  // TODO: Re-enable when Mastra adds payload truncation/limits to trace exporters
});

// Re-export memory and storage instances for use in services
export { memory, storage };