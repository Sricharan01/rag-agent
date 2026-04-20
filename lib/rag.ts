import { supabase } from "./supabase";
import { getEmbedding } from "./embedding";
import OpenAI from "openai";
import { resolveOpenAIKey } from "./settings";
import type { DocumentChunk, QueryRequest, QueryResponse } from "@/types";

// ─────────────────────────────────────────────────────────────
// Conversational greetings — answer without hitting the DB
// ─────────────────────────────────────────────────────────────
const GREETINGS = new Set([
  "hi","hello","hey","hiya","howdy","greetings","sup","yo","helo","hai",
  "good morning","good afternoon","good evening","good night",
]);

function isGreeting(query: string): boolean {
  return GREETINGS.has(query.trim().toLowerCase());
}

// ─────────────────────────────────────────────────────────────
// 1. Retrieve chunks: hybrid (vector + keyword) with high recall
// ─────────────────────────────────────────────────────────────
export async function retrieveChunks(
  query: string,
  topK: number = 20
): Promise<DocumentChunk[]> {
  const embedding = await getEmbedding(query);

  const { data: hybridData, error: hybridError } = await supabase.rpc(
    "hybrid_search",
    { query_text: query, query_embedding: embedding, match_count: topK, rrf_k: 60 }
  );

  if (!hybridError && hybridData && hybridData.length > 0) {
    return hybridData.map(mapToChunk);
  }

  if (hybridError) {
    console.warn("[RAG] Hybrid search failed, falling back to vector:", hybridError.message);
  }

  const { data: vectorData, error: vectorError } = await supabase.rpc(
    "match_documents",
    { query_embedding: embedding, match_count: topK, match_threshold: 0.1 }
  );

  if (vectorError) throw vectorError;
  return (vectorData || []).map(mapToChunk);
}

// ─────────────────────────────────────────────────────────────
// 2. Keyword-only search across ALL documents (exact word match)
// ─────────────────────────────────────────────────────────────
export async function keywordSearch(keyword: string): Promise<DocumentChunk[]> {
  const term = keyword.trim();
  if (!term || term.length < 3) return []; // skip tiny words like "Hi"

  const { data, error } = await supabase
    .from("documents")
    .select("id, content, metadata, created_at")
    .ilike("content", `%${term}%`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[RAG] Keyword search error:", error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata || { source: "unknown", chunk_index: 0 },
    similarity: 1.0,
  }));
}

function mapToChunk(row: any): DocumentChunk {
  return {
    id: row.id,
    content: row.content,
    metadata: row.metadata || { source: "unknown", chunk_index: 0 },
    similarity: typeof row.score === "number" ? row.score : row.similarity || 0,
  };
}

function isSingleKeyword(query: string): boolean {
  return query.trim().split(/\s+/).length === 1;
}

function buildContext(chunks: DocumentChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const src = chunk.metadata.source || "Unknown";
      const page = chunk.metadata.page ? `, Page ${chunk.metadata.page}` : "";
      const score =
        typeof chunk.similarity === "number"
          ? ` (relevance: ${(chunk.similarity * 100).toFixed(0)}%)`
          : "";
      return `[Source ${i + 1}: ${src}${page}${score}]\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}

// ─────────────────────────────────────────────────────────────
// 3. Generate answer — OpenAI primary, HuggingFace fallback
// ─────────────────────────────────────────────────────────────
async function generateWithOpenAI(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const openaiKey = await resolveOpenAIKey();
  if (!openaiKey) throw new Error("OpenAI API key not configured.");

  const openai = new OpenAI({ apiKey: openaiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 4000,
    temperature: 0.2,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  });
  return completion.choices[0]?.message?.content || "No response.";
}

async function generateWithHuggingFace(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const hfKey = process.env.HF_API_KEY;
  if (!hfKey) throw new Error("HuggingFace API key not configured.");

  // Use HF's OpenAI-compatible endpoint with Mistral
  const response = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistralai/Mistral-7B-Instruct-v0.3",
        messages: [{ role: "user", content: systemPrompt }, ...messages],
        max_tokens: 3000,
        temperature: 0.2,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HuggingFace API error: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No response from HuggingFace.";
}

export async function generateAnswer(
  query: string,
  chunks: DocumentChunk[],
  conversationHistory: { role: "user" | "assistant"; content: string }[] = []
): Promise<{ answer: string; reasoning: string; provider: string }> {
  const context = buildContext(chunks);

  const systemPrompt = `You are an expert knowledge assistant for a Current Affairs RAG platform built for UPSC aspirants.

## About This Platform
This website was developed by **Sricharan**, Co-Founder of **Cosmuquantaa Pvt Ltd** and a UPSC aspirant, making current affairs knowledge accessible to everyone. If anyone asks who built this, who developed this, or who created this website, always answer with this information.

## Rules
1. Answer using ONLY the provided source documents — never hallucinate
2. Cite sources inline with **[Source N]** after each key claim
3. Use markdown formatting: headers, bold, bullets, tables where helpful
4. Open with a direct one-sentence answer, then elaborate
5. When a single keyword is searched, summarise ALL information found across every source
6. At the end, list which documents contained the keyword and how many chunks each contributed

## Source Documents
${context}`;

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...conversationHistory.slice(-6),
    { role: "user", content: query },
  ];

  // Try OpenAI first
  try {
    const answer = await generateWithOpenAI(systemPrompt, messages);
    const reasoning = `GPT-4o-mini · ${chunks.length} chunks · ${new Set(chunks.map((c) => c.metadata.source)).size} doc(s)`;
    return { answer, reasoning, provider: "openai" };
  } catch (openaiErr) {
    console.warn("[RAG] OpenAI failed, trying HuggingFace:", (openaiErr as Error).message);
  }

  // Fallback to HuggingFace (Mistral-7B)
  try {
    const answer = await generateWithHuggingFace(systemPrompt, messages);
    const reasoning = `Mistral-7B (HuggingFace) · ${chunks.length} chunks · ${new Set(chunks.map((c) => c.metadata.source)).size} doc(s)`;
    return { answer, reasoning, provider: "huggingface" };
  } catch (hfErr) {
    throw new Error(
      `Both AI providers failed. OpenAI and HuggingFace are unavailable. Check your API keys.`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Full RAG pipeline
// ─────────────────────────────────────────────────────────────
export async function queryRAG(request: QueryRequest): Promise<QueryResponse> {
  const { query, conversationHistory = [], topK = 20 } = request;
  const startTime = Date.now();

  // Handle greetings without DB lookup
  if (isGreeting(query)) {
    return {
      answer:
        "Hello! 👋 I'm your RAG Knowledge Agent. I can search across all your uploaded documents. Try asking me about a topic or type a single keyword like **Missiles**, **Economy**, or **Defence** to find all related information across your PDFs.",
      sources: [],
      reasoning: "Conversational greeting — no document search needed.",
      elapsed: (Date.now() - startTime) / 1000,
    };
  }

  // Decide retrieval strategy
  let chunks: DocumentChunk[];

  if (isSingleKeyword(query) && query.trim().length >= 3) {
    // Single keyword: keyword scan + vector search merged
    const [kwChunks, vecChunks] = await Promise.all([
      keywordSearch(query),
      retrieveChunks(query, topK),
    ]);
    const seen = new Set<string>();
    chunks = [...kwChunks, ...vecChunks].filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  } else {
    chunks = await retrieveChunks(query, topK);
  }

  if (chunks.length === 0) {
    return {
      answer:
        "I couldn't find any relevant information in the knowledge base for that query. Try rephrasing, or ensure your documents have been uploaded.",
      sources: [],
      reasoning: "No relevant chunks found.",
      elapsed: (Date.now() - startTime) / 1000,
    };
  }

  const { answer, reasoning } = await generateAnswer(query, chunks, conversationHistory);

  return {
    answer,
    sources: chunks.slice(0, 10),
    reasoning,
    elapsed: (Date.now() - startTime) / 1000,
  };
}
