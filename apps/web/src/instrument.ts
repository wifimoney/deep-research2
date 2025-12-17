import * as Sentry from "@sentry/node";

// Initialize Sentry as early as possible in the process lifecycle.
Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://18d2864fed6357d218cd578024faec56@o4510545402724352.ingest.de.sentry.io/4510546121654352",
  sendDefaultPii: true,
  // Filter out systemErrorIntegration to avoid util.getSystemErrorMap() compatibility issues
  // when running with tsx/esbuild which may polyfill Node.js built-in modules
  integrations: (integrations) => {
    return integrations.filter(integration => integration.name !== 'SystemError');
  },
});

