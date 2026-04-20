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
// Source detection — does the user mention a doc name / subject?
// e.g. "from pol", "in environment", "polity chapter", etc.
// ─────────────────────────────────────────────────────────────

/**
 * Returns the matched source document name or null.
 * Checks:
 *  1. If query contains the exact filename
 *  2. If query contains the base name (without extension)
 *  3. If any query word is a prefix of a source base name (min 3 chars)
 */
async function detectSourceFilter(query: string): Promise<string | null> {
  const q = query.toLowerCase().trim();

  const { data } = await supabase.rpc("list_documents");
  if (!data || data.length === 0) return null;

  const sources: string[] = data.map((d: any) => d.source as string);

  for (const src of sources) {
    const srcBase = src.toLowerCase().replace(/\.[^.]+$/, ""); // strip extension
    const srcFull = src.toLowerCase();

    // Exact filename or base name present in query
    if (q.includes(srcFull) || q.includes(srcBase)) {
      return src;
    }

    // Word-level prefix match: "pol" matches "polity.pdf", "env" matches "environment.pdf"
    const words = q.split(/\s+/);
    for (const word of words) {
      if (word.length >= 3 && srcBase.startsWith(word)) {
        return src;
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// 1. Vector retrieval (with optional source filter)
// ─────────────────────────────────────────────────────────────
export async function retrieveChunks(
  query: string,
  topK: number = 20,
  sourceFilter?: string
): Promise<DocumentChunk[]> {
  const embedding = await getEmbedding(query);

  // Scoped to one document: fetch all chunks of that doc, re-rank by similarity
  if (sourceFilter) {
    const { data, error } = await supabase
      .from("documents")
      .select("id, content, metadata, embedding")
      .eq("metadata->>source", sourceFilter)
      .limit(topK * 3);

    if (!error && data && data.length > 0) {
      const scored = data.map((row: any) => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata || { source: sourceFilter, chunk_index: 0 },
        similarity: cosineSimilarity(embedding, row.embedding),
      }));
      scored.sort((a, b) => b.similarity - a.similarity);
      return scored.slice(0, topK);
    }
  }

  // Global hybrid search
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

// Cosine similarity between two float arrays
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

// ─────────────────────────────────────────────────────────────
// 2. Enhanced keyword search — ilike with term-frequency ranking
//    Optionally scoped to a single source document
// ─────────────────────────────────────────────────────────────
export async function keywordSearch(
  keyword: string,
  sourceFilter?: string
): Promise<DocumentChunk[]> {
  const term = keyword.trim();
  if (!term || term.length < 3) return [];

  let q = supabase
    .from("documents")
    .select("id, content, metadata");

  if (sourceFilter) {
    q = q.eq("metadata->>source", sourceFilter);
  }

  q = (q as any).ilike("content", `%${term}%`).limit(60);

  const { data, error } = await q;

  if (error) {
    console.error("[RAG] Keyword search error:", error.message);
    return [];
  }

  // Score by term frequency for better ranking
  const results = (data || []).map((row: any) => {
    const content: string = (row.content || "").toLowerCase();
    const freq = countOccurrences(content, term.toLowerCase());
    return {
      id: row.id,
      content: row.content,
      metadata: row.metadata || { source: "unknown", chunk_index: 0 },
      similarity: Math.min(freq / 5, 1.0),
    };
  });

  results.sort((a, b) => b.similarity - a.similarity);
  return results;
}

function countOccurrences(text: string, term: string): number {
  let count = 0, pos = 0;
  while ((pos = text.indexOf(term, pos)) !== -1) { count++; pos += term.length; }
  return count;
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

/**
 * Extracts the most meaningful word from a multi-word query
 * (longest non-stop word) for keyword boosting
 */
function extractMainKeyword(query: string): string {
  const STOP_WORDS = new Set([
    "the","a","an","is","are","was","were","be","been","being",
    "have","has","had","do","does","did","will","would","shall","should",
    "may","might","must","can","could","what","which","who","whom",
    "when","where","why","how","all","both","each","few","more","most",
    "other","some","such","no","nor","not","only","own","same","than",
    "too","very","just","about","from","in","of","on","to","with","for",
    "and","or","but","if","then","so","tell","me","give","explain","list",
  ]);

  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  if (words.length === 0) return query.trim();
  return words.sort((a, b) => b.length - a.length)[0];
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
// 3. Generate answer
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
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
  sourceFilter?: string
): Promise<{ answer: string; reasoning: string; provider: string }> {
  const context = buildContext(chunks);

  // Build doc inventory for the LLM
  const docGroups = new Map<string, number>();
  chunks.forEach((c) => {
    const src = c.metadata.source || "Unknown";
    docGroups.set(src, (docGroups.get(src) || 0) + 1);
  });
  const docInventory = Array.from(docGroups.entries())
    .map(([src, count]) => `• ${src} (${count} chunk${count > 1 ? "s" : ""})`)
    .join("\n");

  const sourceInstruction = sourceFilter
    ? `\n\n⚠️ SOURCE SCOPE: The user is asking specifically about "${sourceFilter}". Answer ONLY from chunks of this document. Do NOT reference any other source.`
    : "";

  const systemPrompt = `You are an expert knowledge assistant for a Current Affairs RAG platform built for UPSC aspirants.

## About This Platform
This website was developed by **Sricharan**, Co-Founder of **Cosmuquantaa Pvt Ltd** and a UPSC aspirant. If asked who built/created this, always answer with this information.

## Critical Rules
1. Answer ONLY using the provided source documents — never hallucinate
2. Cite sources inline with **[Source N: filename]** after EVERY key claim
3. Use markdown: headers, bold, bullets, tables where helpful
4. Open with a direct one-sentence answer, then elaborate
5. When a keyword is searched, summarise ALL matching information found across sources
6. At the end, always include a **📚 Sources Used** section listing which documents contributed and how many chunks each provided${sourceInstruction}

## Documents Searched
${docInventory}

## Source Documents
${context}`;

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...conversationHistory.slice(-6),
    { role: "user", content: query },
  ];

  try {
    const answer = await generateWithOpenAI(systemPrompt, messages);
    const reasoning = `GPT-4o-mini · ${chunks.length} chunks · ${docGroups.size} doc(s)${sourceFilter ? ` · scoped to "${sourceFilter}"` : ""}`;
    return { answer, reasoning, provider: "openai" };
  } catch (openaiErr) {
    console.warn("[RAG] OpenAI failed, trying HuggingFace:", (openaiErr as Error).message);
  }

  try {
    const answer = await generateWithHuggingFace(systemPrompt, messages);
    const reasoning = `Mistral-7B · ${chunks.length} chunks · ${docGroups.size} doc(s)${sourceFilter ? ` · scoped to "${sourceFilter}"` : ""}`;
    return { answer, reasoning, provider: "huggingface" };
  } catch {
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

  if (isGreeting(query)) {
    return {
      answer:
        "Hello! 👋 I'm your RAG Knowledge Agent. I can search across all your uploaded documents. Try asking me about a topic or type a single keyword like **Missiles**, **Economy**, or **Defence** to find all related information across your PDFs. You can also mention a document name like *'from polity'* or *'in environment'* to search within a specific file.",
      sources: [],
      reasoning: "Conversational greeting — no document search needed.",
      elapsed: (Date.now() - startTime) / 1000,
    };
  }

  // Detect if user is scoping to a specific document
  const sourceFilter = await detectSourceFilter(query);
  if (sourceFilter) {
    console.log(`[RAG] Source filter detected: "${sourceFilter}"`);
  }

  let chunks: DocumentChunk[];

  if (isSingleKeyword(query) && query.trim().length >= 3) {
    // Single keyword: merge keyword + vector, both scoped if applicable
    const [kwChunks, vecChunks] = await Promise.all([
      keywordSearch(query, sourceFilter ?? undefined),
      retrieveChunks(query, topK, sourceFilter ?? undefined),
    ]);
    const seen = new Set<string>();
    chunks = [...kwChunks, ...vecChunks].filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  } else {
    // Multi-word: hybrid vector search + keyword boost on main term
    const mainKeyword = extractMainKeyword(query);
    const [vecChunks, kwChunks] = await Promise.all([
      retrieveChunks(query, topK, sourceFilter ?? undefined),
      keywordSearch(mainKeyword, sourceFilter ?? undefined),
    ]);
    const seen = new Set<string>();
    chunks = [...vecChunks, ...kwChunks].filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }

  if (chunks.length === 0) {
    const scopeMsg = sourceFilter ? ` in "${sourceFilter}"` : "";
    return {
      answer: `I couldn't find any relevant information${scopeMsg} for that query. Try rephrasing, or ensure your documents have been uploaded and ingested.`,
      sources: [],
      reasoning: `No relevant chunks found${scopeMsg}.`,
      elapsed: (Date.now() - startTime) / 1000,
    };
  }

  const { answer, reasoning } = await generateAnswer(
    query,
    chunks,
    conversationHistory,
    sourceFilter ?? undefined
  );

  return {
    answer,
    sources: chunks.slice(0, 10),
    reasoning,
    elapsed: (Date.now() - startTime) / 1000,
  };
}
