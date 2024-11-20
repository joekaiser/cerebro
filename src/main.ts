import { Application } from "@oak/oak";

import { connectToMongo } from "@/db/index.ts";
import { runAllJobs } from "@/jobs/job.ts";
import log from "@/log.ts";
import { config } from "./config.ts";
import errorHandler from "./middleware/errorHandler.ts";
import logger from "./middleware/logger.ts";

const app = new Application();

await connectToMongo();

if (config.CB_RUN_JOBS()) {
  runAllJobs();
}

// Middleware
app.use(errorHandler);
app.use(logger);
// Routes
// app.use(healthRouter.routes());
// app.use(healthRouter.allowedMethods());

const PORT = config.CB_PORT();
log.info(
  `Server running on http://localhost:${PORT} for ${config.NODE_ENV().toUpperCase()}`,
);

await app.listen({ port: PORT });
