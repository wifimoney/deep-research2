import 'dotenv/config';
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import type { HonoBindings, HonoVariables } from "@mastra/hono";
import { MastraServer } from "@mastra/hono";
import { mastra } from "./mastra.js";
import agentRoutes from './routes/agent.js';
import { serverConfig } from '../../src/mastra/config/config.js';

const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors({
  origin: [`http://localhost:${serverConfig.port}`, `http://localhost:${serverConfig.mastraPort}`],
  credentials: true,
}));

// Mount agent routes at /api/agent
app.route('/api/agent', agentRoutes);

// Initialize MastraServer (registers Mastra API routes)
const server = new MastraServer({ app, mastra });
await server.init();

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    agents: Object.keys(mastra.getAgents?.() || {}),
  });
});

const port = serverConfig.mastraPort;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Mastra server running on http://localhost:${port}`);
  console.log(`Agent API: http://localhost:${port}/api/agent`);
  console.log(`Health check: http://localhost:${port}/health`);
});
