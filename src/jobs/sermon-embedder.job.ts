import Sermon from "@/db/models/Sermon.ts";
import { chromaClient } from "@/embedder/chroma-client.ts";
import { chromaCollections } from "@/embedder/chroma-collections.ts";
import { chunkAndEmbed } from "@/embedder/chunk-embedder.ts";
import { Job } from "@/jobs/job.ts";
import log from "@/log.ts";

export class SermonEmbedderJob implements Job {
  public get schedule() {
    return { minute: { every: 30 } } as Deno.CronSchedule;
  }
  public async run() {
    log.info("Starting Sermon Embedder Job");
    await this.embedTranscripts();
    log.info("Completed Sermon Embedder Job");
  }

  async embedTranscripts() {
    const sermonsToProcess = await Sermon.find({
      embeddedAt: { $exists: false },
    });

    for (const sermon of sermonsToProcess) {
      try {
        if (!sermon.transcription?.length) continue;
        await this.embedTranscript(
          sermon.transcription,
          sermon.id,
          sermon.title,
        );
        sermon.embeddedAt = new Date();
        await sermon.save();
      } catch (e) {
        log.error("Failed to embed sermon:", sermon.title, e);
      }
    }
  }

  async embedTranscript(transcript: string, mongoid: string, title: string) {
    log.debug("Embedding file:", title);

    const data = await chunkAndEmbed(transcript);
    const collection = await chromaClient.getOrCreateCollection(
      { name: chromaCollections.sermon },
    );

    try {
      await collection.add({
        ids: data.embeddings.map((_, i) => `${mongoid}__${i}`),
        embeddings: data.embeddings,
        documents: data.chunks,
        metadatas: data.embeddings.map((_, i) => ({
          title: title,
          id: mongoid,
          chunk: i,
        })),
      });
    } catch (e) {
      log.error("failed to embed file:", title, e);
    }
  }
}
