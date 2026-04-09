import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "./lib/seed";
import { syncLiveData } from "./lib/liveData";

const port = Number(process.env["PORT"] || "5000");

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env["PORT"]}"`);
}

const THIRTY_MINUTES = 30 * 60 * 1000;

async function startup() {
// await seedIfEmpty(); // Disabling mock seeding for real-world data only

  app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });

  syncLiveData().catch((err) =>
    logger.warn({ err }, "Initial live data sync failed (non-fatal)")
  );

  setInterval(() => {
    syncLiveData().catch((err) =>
      logger.warn({ err }, "Periodic live data sync failed")
    );
  }, THIRTY_MINUTES);
}

startup();
