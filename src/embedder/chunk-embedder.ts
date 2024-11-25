import { embed } from "@/ollama/ollama.ts";
import { decode, encode } from "npm:gpt-tokenizer";
import tokenizer from "npm:sbd";

type chunkOptions = {
  maxChunkSize: number;
  overlap: number;
};
export function getChunks(
  fileContent: string,
  chunkOptions: chunkOptions,
) {
  const tokens = encode(fileContent);

  const documentSize = tokens.length;
  const K = Math.ceil(documentSize / chunkOptions.maxChunkSize);
  const averageChunkSize = Math.ceil(documentSize / K);

  const chunks: string[] = [];
  const sentences = tokenizer.sentences(fileContent);
  let currentChunk = "";
  let lastChunkTokens: number[] = [];

  // Create K-1 chunks of approximately averageChunkSize
  for (let i = 0; i < sentences.length; i++) {
    const nextSentence = sentences[i] + " "; //.replace(/\n/g, "");
    const potentialChunk = currentChunk + nextSentence;
    const chunkTokens = encode(potentialChunk);

    if (chunkTokens.length >= averageChunkSize && chunks.length < K - 1) {
      let overlapText = "";
      // if the first chuck happens to be longer than our average chunk size
      // then we have to prevent an empty chunk from being pushed onto the stack
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        lastChunkTokens = encode(currentChunk);
        overlapText = decode(
          lastChunkTokens.slice(-chunkOptions.overlap),
        );
      }
      // Start next chunk with overlap from previous chunk
      currentChunk = overlapText + nextSentence;
    } else {
      currentChunk += nextSentence;
    }
  }
  // Add the final chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export async function chunkAndEmbed(text: string, chunkOptions: chunkOptions = {
  maxChunkSize: 100,
  overlap: 5,
}) {
  const chunks = getChunks(text, chunkOptions).map((chunk) =>
    chunk.replace(/\n/g, "")
  );
  const embeddings = await Promise.all(
    chunks.map((chunk) => embed(chunk)),
  );
  return { embeddings, chunks };
}
