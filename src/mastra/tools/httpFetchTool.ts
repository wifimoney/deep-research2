import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const httpFetchTool = createTool({
  id: 'http-fetch',
  description: 'Fetch content from a URL using HTTP GET request. Returns the response text or JSON.',
  inputSchema: z.object({
    url: z.string().describe('The URL to fetch'),
    headers: z.record(z.string()).optional().describe('Optional HTTP headers to include in the request'),
  }),
  execute: async ({ context }) => {
    const { url, headers = {} } = context;

    try {
      console.log(`Fetching URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mastra-BreachIntelAgent/1.0',
          ...headers,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          url,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      let data: any;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        success: true,
        url,
        status: response.status,
        contentType,
        data,
      };
    } catch (error) {
      console.error('Error fetching URL:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        url,
      };
    }
  },
});
