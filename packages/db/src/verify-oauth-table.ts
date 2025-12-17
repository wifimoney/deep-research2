
import { db } from "./drizzle";
import { oauthAccounts } from "./schema";

async function verifyOauthTable() {
  try {
    console.log("Attempting to query oauthAccounts table...");
    await db.select().from(oauthAccounts).limit(1);
    console.log("SUCCESS: oauthAccounts table exists and is accessible.");
    process.exit(0);
  } catch (error) {
    console.error("ERROR: Failed to access oauthAccounts table. Migration might not be applied or table does not exist.");
    console.error(error);
    process.exit(1);
  }
}

verifyOauthTable();
