import { config } from "@/config.ts";
import Sermon from "@/db/models/Sermon.ts";
import { chromaClient } from "@/embedder/chroma-client.ts";
import { chromaCollections } from "@/embedder/chroma-collections.ts";
import { chunkAndEmbed } from "@/embedder/chunk-embedder.ts";
import { Job } from "@/jobs/job.ts";
import log from "@/log.ts";
import { ensureDir } from "@std/fs";
import Parser from "rss-parser";

export class SermonDownloaderJob implements Job {
  workingDir = config.CB_DATA_DIR() + "/sermons";
  audioDir = this.workingDir + "/audio";
  ingestDir = this.workingDir + "/ingest";
  processedDir = config.CB_DATA_DIR() + "/processed";

  RSS_FEED_URL = "https://podcasts.subsplash.com/3a01115/podcast.rss";

  alreadyProcessedCounter = 0;

  public get schedule() {
    // return "0 */2 * * *";
    return "* * * * *";
  }
  public async run() {
    log.info("Starting Sermon History Job");
    await this.ensureDirectories();
    await this.downloadSermons();
    // await this.runWhisper();
    // await this.embedTranscripts();
    log.info("Completed Sermon History Job");
  }

  async ensureDirectories() {
    await ensureDir(this.workingDir);
    await ensureDir(this.audioDir);
    await ensureDir(this.ingestDir);
    await ensureDir(this.processedDir);
  }

  async setFileAsProcessed(file: Deno.DirEntry) {
    await Deno.rename(
      this.ingestDir + "/" + file.name,
      this.processedDir + "/" + file.name,
    );
  }

  async getSermonData(videoId: string) {
    return await Sermon.findOne({ videoId });
  }

  async downloadSermons() {
    log.debug("Downloading RSS");
    this.alreadyProcessedCounter = 0;
    const parser = new Parser();
    const feed = await parser.parseURL(this.RSS_FEED_URL);

    for (const item of feed.items) {
      if (this.alreadyProcessedCounter >= 3) {
        log.info("Already processed the last 3 sermons, stopping...");
        break;
      }
      // this is just making TS happy
      if (
        !item.enclosure?.url ||
        !item.guid
      ) {
        continue;
      }
      if (await this.getSermonData(item.guid)) {
        this.alreadyProcessedCounter++;
        continue;
      }

      const sermon = new Sermon({
        title: item.title ?? "Unknown Title",
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        audioUrl: item.enclosure?.url,
        videoId: item.guid,
        image: item.itunes?.image,
        speaker: item.itunes?.author,
        subtitle: item.itunes?.subtitle,
      });

      log.debug("Processing sermon: ", sermon.title);
      const audioPath = await this.downloadAudioFile(
        sermon.audioUrl,
        sermon.videoId,
      );
      await this.runWhisper(audioPath);
      await this.removeAudioIfTranscriptExists(audioPath);
      const transcription = await this.readTranscript(
        `${sermon.videoId}.txt`,
      );
      sermon.transcription = transcription;
      sermon.transcribedAt = new Date();
      await sermon.save();
      await this.embedTranscript(transcription, sermon.id, sermon.title);
      sermon.embeddedAt = new Date();
      sermon.save();
    }
  }

  async downloadAudioFile(url: string, fileName: string) {
    log.debug("Downloading audio file: ", url);
    const response = await fetch(url);
    const audioData = await response.arrayBuffer();
    const audioPath = `${this.audioDir}/${fileName}.mp3`;
    await Deno.writeFile(audioPath, new Uint8Array(audioData));
    return audioPath;
  }

  async runWhisper(audioPath: string) {
    log.debug("Transcribing audio: ", audioPath);
    const command = new Deno.Command("whisper-ctranslate2", {
      args: [
        "--language",
        "English",
        "--model",
        "small.en", //"large-v3-turbo",
        "--output_format",
        "txt",
        "--output_dir",
        this.ingestDir,
        audioPath,
      ],
      stdout: "piped",
      stderr: "piped",
    });
    const process = command.spawn();
    const decoder = new TextDecoder();

    for await (const chunk of process.stdout) {
      log.debug(decoder.decode(chunk));
    }
    for await (const chunk of process.stderr) {
      log.error(decoder.decode(chunk));
    }

    await process.status;
  }

  async removeAudioIfTranscriptExists(audioPath: string) {
    log.debug("Checking if transcript exists: ", audioPath);
    const fileName = audioPath.split("/").pop() || "";
    const subtitleFile = fileName.replace(".mp3", ".txt");
    try {
      Deno.lstat(this.ingestDir + "/" + subtitleFile);
      log.debug("Deleting file: ", fileName);
      await Deno.remove(audioPath);
    } catch {
      log.warn(
        `File ${audioPath} does not exist. Was the transcript generated?`,
      );
      // File doesn't exist, do nothing
    }
  }

  async readTranscript(fileName: string) {
    const fileContent = await Deno.readTextFile(
      this.ingestDir + "/" + fileName,
    );
    return fileContent;
  }

  async embedTranscript(transcript: string, mongoid: string, title: string) {
    log.debug("Embedding file: ", title);

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
      log.error("failed to embed file: ", title, e);
    }
  }
}
