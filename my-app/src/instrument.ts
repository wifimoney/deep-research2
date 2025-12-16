import * as Sentry from "@sentry/node";

// Initialize Sentry as early as possible in the process lifecycle.
Sentry.init({
  dsn: "https://18d2864fed6357d218cd578024faec56@o4510545402724352.ingest.de.sentry.io/4510546121654352",
  sendDefaultPii: true,
});

