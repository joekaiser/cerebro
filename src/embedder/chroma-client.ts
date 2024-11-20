import { config } from "@/config.ts";
import { ChromaClient } from "npm:chromadb";
export const chromaClient = new ChromaClient({
  path: config.CB_CHROMA_URL(),
});
