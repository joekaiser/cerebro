import { config } from "@/config.ts";
import { Ollama } from "npm:ollama";
import { Options } from "ollama";

export enum Models {
  LLAMA3_1 = "llama3.1:8b-instruct-q6_K",
  LLAMA3_2 = "llama3.2:3b-instruct-q6_K",
  EMBEDDING = "jina/jina-embeddings-v2-small-en",
}

function getOllama() {
  return new Ollama({ host: config.CB_OLLAMA_HOST() });
}
export async function instruct(
  prompt: string,
  model: Models = Models.LLAMA3_1,
  systemPrompt?: string,
  options?: Partial<PromptOptions>,
) {
  const result = await getOllama().generate({
    model,
    prompt,
    ...(systemPrompt && { system: systemPrompt }),
    ...(options && { options }),
  });
  return result;
}
export async function embed(text: string) {
  const embedding = await getOllama().embed({
    model: Models.EMBEDDING,
    input: `${text}`,
  });
  return embedding.embeddings[0];
}

export type PromptOptions = Pick<
  Options,
  "temperature" | "frequency_penalty" | "presence_penalty" | "top_p" | "num_ctx"
>;
