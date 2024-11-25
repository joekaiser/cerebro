import { getBookOfTheBible } from "@/bibleParser.ts";
import { config } from "@/config.ts";
import Sermon from "@/db/models/Sermon.ts";
import { chromaClient } from "@/embedder/chroma-client.ts";
import { chromaCollections } from "@/embedder/chroma-collections.ts";
import { chunkAndEmbed } from "@/embedder/chunk-embedder.ts";
import { Job } from "@/jobs/job.ts";
import log from "@/log.ts";
import * as ollamaUtil from "@/ollama/ollama.ts";
import {
  sermonNotesPrompt,
  sermonQuestionsPrompt,
  sermonThemePrompt,
} from "@/ollama/prompts.ts";
import { ensureDir } from "@std/fs";
import Parser from "rss-parser";

export class SermonDownloaderJob implements Job {
  workingDir = config.CB_DATA_DIR() + "/sermons";
  audioDir = this.workingDir + "/audio";
  ingestDir = this.workingDir + "/ingest";

  RSS_FEED_URL = "https://podcasts.subsplash.com/3a01115/podcast.rss";

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
  }

  async getSermonData(videoId: string) {
    return await Sermon.findOne({ videoId });
  }

  async downloadSermons() {
    log.debug("Downloading RSS");
    let alreadyProcessedCounter = 0;
    const parser = new Parser();
    const feed = await parser.parseURL(this.RSS_FEED_URL);

    for (const item of feed.items) {
      // if (alreadyProcessedCounter > 4) {
      //   log.info(
      //     `Already processed the last ${alreadyProcessedCounter} sermons, stopping...`,
      //   );
      //   break;
      // }
      // this is just making TS happy
      if (
        !item.enclosure?.url ||
        !item.guid
      ) {
        continue;
      }
      if (await this.getSermonData(item.guid)) {
        log.debug("Already processed:", item.title);
        alreadyProcessedCounter++;
        continue;
      }
      alreadyProcessedCounter = 0;

      let sermon = new Sermon({
        title: item.title ?? "Unknown Title",
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        audioUrl: item.enclosure?.url,
        videoId: item.guid,
        image: item.itunes?.image,
        speaker: item.itunes?.author,
        subtitle: item.itunes?.subtitle,
      });

      log.info("Processing sermon:", sermon.title);
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
      sermon = await sermon.save(); //need the sermonId to tie to the embeddings
      await this.embedTranscript(transcription, sermon.id, sermon.title);
      sermon.embeddedAt = new Date();
      sermon = await sermon.save();
      sermon.summary = await this.getSummmary(transcription);
      sermon.questions = await this.getQuestions(transcription);
      sermon.theme = await this.getTheme(sermon.summary);
      sermon.book = getBookOfTheBible(`${sermon.subtitle}`);
      if (sermon.book == undefined) {
        sermon.book = getBookOfTheBible(`${sermon.title}`);
      }
      sermon = await sermon.save();
      //todo: archive transcript?
    }
  }

  async downloadAudioFile(url: string, fileName: string) {
    log.debug("Downloading audio file:", url);
    const response = await fetch(url);
    const audioData = await response.arrayBuffer();
    const audioPath = `${this.audioDir}/${fileName}.mp3`;
    await Deno.writeFile(audioPath, new Uint8Array(audioData));
    return audioPath;
  }

  async runWhisper(audioPath: string) {
    log.debug("Transcribing audio:", audioPath);
    const command = new Deno.Command("whisper-ctranslate2", {
      args: [
        "--language",
        "English",
        "--model",
        "large-v3-turbo", //"small.en", //"large-v3-turbo",
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
    const result = await process.output();

    if (result.code !== 0) {
      log.error("Whisper failed with code:", result.code);
      log.error(decoder.decode(result.stderr));
      throw new Error("Whisper failed");
    }
  }

  async removeAudioIfTranscriptExists(audioPath: string) {
    const fileName = audioPath.split("/").pop() || "";
    log.debug("Checking if transcript exists for ", fileName);
    const subtitleFile = fileName.replace(".mp3", ".txt");
    try {
      Deno.lstat(this.ingestDir + "/" + subtitleFile);
      log.debug("Deleting file:", fileName);
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
  async getSummmary(transcript: string) {
    log.debug("Getting summary");
    const summary = await ollamaUtil.instruct(
      transcript,
      ollamaUtil.Models.LLAMA3_1,
      sermonNotesPrompt,
      {
        num_ctx: 32000,
        frequency_penalty: 0.15,
        presence_penalty: 0.05,
        temperature: 0.35,
        top_p: 0.8,
      },
    );
    return summary.response;
  }

  async getQuestions(transcript: string) {
    log.debug("Getting questions");
    const questions = await ollamaUtil.instruct(
      transcript,
      ollamaUtil.Models.LLAMA3_1,
      sermonQuestionsPrompt,
      {
        num_ctx: 32000,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
        temperature: 0.55,
        top_p: 0.9,
      },
    );
    return questions.response;
  }

  async getTheme(summary: string) {
    log.debug("Getting theme");
    const themes = await ollamaUtil.instruct(
      summary,
      ollamaUtil.Models.LLAMA3_2,
      sermonThemePrompt,
      { temperature: 0 },
    );
    return themes.response;
  }
}
