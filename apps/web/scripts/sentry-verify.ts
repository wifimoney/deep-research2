import "../src/instrument.ts";
import * as Sentry from "@sentry/node";

async function main() {
  try {
    // Intentional error for Sentry verification
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
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

