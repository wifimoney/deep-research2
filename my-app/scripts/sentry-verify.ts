import "../src/instrument.ts";
import * as Sentry from "@sentry/node";

function foo() {
  throw new Error("Test error for Sentry verification");
}

async function main() {
  try {
    // Intentional error for Sentry verification
    foo();
  } catch (error) {
    const eventId = Sentry.captureException(error);
    // Ensure the event is flushed before exit
    await Sentry.flush(5000);
    console.log("Sentry test event sent. Event ID:", eventId);
  } finally {
    // Gracefully close the Sentry client
    await Sentry.close(2000);
  }
}

main().catch((err) => {
  console.error("Failed to send Sentry test event:", err);
  process.exitCode = 1;
});

