/**This is a sample router for items.*/

import { chromaClient } from "@/embedder/chroma-client.ts";
import { chromaCollections } from "@/embedder/chroma-collections.ts";
import { embed } from "@/ollama/ollama.ts";
import { Router } from "@oak/oak";

const router = new Router({
  prefix: "/query",
});

router.post("/sermon", async (ctx) => {
  if (ctx.request.hasBody) {
    const payload = await ctx.request.body.json();
    if (payload.query) {
      const embeddings = await embed([payload.query]);
      const collection = await chromaClient.getOrCreateCollection(
        { name: chromaCollections.sermon },
      );
      const result = await collection.query({
        queryEmbeddings: embeddings,
        nResults: 30,
      });

      // Create a Map to store the highest ranking result for each fileName
      const dedupedResults = new Map();
      const dupeCounts = new Map();

      // Assuming result.metadatas[0] contains array of metadata objects
      result.metadatas[0].forEach((metadata, index) => {
        const id = metadata!.id;
        const currentScore = result.distances![0][index];

        // Increment dupe count for this filename
        dupeCounts.set(id, (dupeCounts.get(id) || 0) + 1);

        if (
          !dedupedResults.has(id) ||
          currentScore < dedupedResults.get(id).score
        ) {
          dedupedResults.set(id, {
            metadata: metadata,
            document: result.documents[0][index],
            score: currentScore,
            index: index,
          });
        }
      });

      const finalResults = Array.from(dedupedResults.values()).map((item) => ({
        metadata: {
          ...item.metadata,
          matches: `${dupeCounts.get(item.metadata.id)}`,
        },
        document: item.document,
        score: item.score,
      }));

      ctx.response.body = {
        results: finalResults,
      };
    }
  }
});

export default router;
