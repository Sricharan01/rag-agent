import OpenAI from "openai";
import { resolveOpenAIKey } from "./settings";

/**
 * Returns an OpenAI client using the env key first, then the DB-saved key
 */
async function getOpenAIClient(): Promise<OpenAI> {
  const apiKey = await resolveOpenAIKey();
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not configured. Add it in Settings or set OPENAI_API_KEY in your environment."
    );
  }
  return new OpenAI({ apiKey });
}

/** Generate a single embedding vector */
export async function getEmbedding(text: string): Promise<number[]> {
  const client = await getOpenAIClient();
  const cleaned = text.replace(/\n+/g, " ").trim().slice(0, 8000);

  const res = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: cleaned,
    encoding_format: "float",
    dimensions: 1536,
  });

  return res.data[0].embedding;
}

/** Generate embeddings for a batch of texts */
export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const client = await getOpenAIClient();
  const cleaned = texts.map((t) => t.replace(/\n+/g, " ").trim().slice(0, 8000));

  const res = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: cleaned,
    encoding_format: "float",
    dimensions: 1536,
  });

  return res.data.map((d) => d.embedding);
}
