/**This is a sample router for items.*/

import Sermon from "@/db/models/Sermon.ts";
import { chromaClient } from "@/embedder/chroma-client.ts";
import { chromaCollections } from "@/embedder/chroma-collections.ts";
import { runJob } from "@/jobs/job.ts";
import { SermonEmbedderJob } from "@/jobs/sermon-embedder.job.ts";
import log from "@/log.ts";
import { Router } from "@oak/oak";

// ⚠️⚠️⚠️ routes that affect AI of multiple items at once should be a post so they can't accidentally be run
const router = new Router({
  prefix: "/admin",
});

/**
 * This function will recreate all chromaDb Embeddings for sermon transcripts
 */
router.post("/embedder/embedall/sermons", async (ctx) => {
  log.info("Re-embedding all sermons");
  let removedCollection = false;
  let message = "";
  const collections = await chromaClient.listCollections();

  if (collections.some((c) => c.name == chromaCollections.sermon)) {
    removedCollection = true;
    await chromaClient.deleteCollection({ name: chromaCollections.sermon });
  }

  await Sermon.updateMany(
    { $unset: { embeddedAt: "" } },
  );

  runJob(new SermonEmbedderJob().constructor.name);
  if (!removedCollection) {
    message = "Collection was not found, so it was not deleted";
  }
  ctx.response.body = {
    message: message + " -- Queued up job to re-embed sermons",
  };
});

export default router;
