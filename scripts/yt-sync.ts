import { Logger } from "jsr:@deno-library/logger";
import { ensureDir } from "jsr:@std/fs/ensure-dir";

//working vars
const playlist = "PLgNmdcFmMq2a0vYmUDt_MG4eRwzB_3H9y";
const workingDir = "/home/joe/al-9000/cerebro-data/yt";
const audioDir = workingDir + "/audio";
const ingestDir = "/mnt/nas/vault/appdata/cerebro/yt/injest";

//setup
const logger = new Logger();

async function downloadPlaylist() {
  logger.info("Downloading playlist");
  const command = new Deno.Command("yt-dlp", {
    args: [
      `https://www.youtube.com/playlist?list=${playlist}`,
      "-o",
      `${audioDir}/%(title)s__-chan-%(channel)s__-id-%(id)s.%(ext)s`,
      "--download-archive",
      `${workingDir}/playlist-archive.txt`,
      "--no-overwrites",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const process = command.spawn();
  const decoder = new TextDecoder();

  for await (const chunk of process.stdout) {
    logger.info(decoder.decode(chunk));
  }
  for await (const chunk of process.stderr) {
    logger.error(decoder.decode(chunk));
  }

  await process.status;
}
async function runWhisper() {
  logger.info("Generasting Whisper transcripts");
  for await (const file of Deno.readDir(audioDir)) {
    if (file.isFile) {
      console.log("Processing file: ", file.name);
      const command = new Deno.Command("whisper-ctranslate2", {
        args: [
          "--model",
          "small.en", //large-v3-turbo
          "--output_format",
          "txt",
          "--output_dir",
          ingestDir,
          `${audioDir}/${file.name}`,
        ],
        stdout: "piped",
        stderr: "piped",
      });
      const process = command.spawn();
      const decoder = new TextDecoder();

      for await (const chunk of process.stdout) {
        logger.info(decoder.decode(chunk));
      }
      for await (const chunk of process.stderr) {
        logger.error(decoder.decode(chunk));
      }

      await process.status;

      //if ingest/file exists then delete the audio file
      try {
        // this fails because file.name contains the .mp3 extension.
        // replace the extension with .txt
        const subtitleFile = file.name.replace(".mp3", ".txt");
        Deno.lstat(ingestDir + "/" + subtitleFile);
        console.log("Deleting file: ", file.name);
        await Deno.remove(audioDir + "/" + file.name);
      } catch {
        logger.warn(
          `File ${file.name} does not exist. Was the transcript generated?`,
        );
        // File doesn't exist, do nothing
      }
    }
  }
}

function setup() {
  ensureDir(workingDir);
  ensureDir(audioDir);
  ensureDir(ingestDir);

  logger.info("workingDir: ", workingDir);
  logger.info("audioDir: ", audioDir);
  logger.info("ingestDir: ", ingestDir);
}

setup();
await downloadPlaylist();
await runWhisper();
