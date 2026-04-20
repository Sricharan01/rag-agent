import { supabase } from "./supabase";
import { getEmbeddingsBatch } from "./embedding";
import {
  extractTextFromPDF,
  extractTextFromTxt,
  extractTextFromDocx,
  extractTextFromCsv,
  TextChunk,
} from "./chunker";
import type { IngestResult } from "@/types";
import { v4 as uuidv4 } from "uuid";

/**
 * Supported file types
 */
export const SUPPORTED_TYPES = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/markdown": "md",
} as const;

export function isSupportedType(mimeType: string, fileName: string): boolean {
  if (SUPPORTED_TYPES[mimeType as keyof typeof SUPPORTED_TYPES]) return true;
  const ext = fileName.toLowerCase().split(".").pop();
  return ["pdf", "txt", "md", "csv", "docx"].includes(ext || "");
}

/**
 * Ingests a document into Supabase with pgvector embeddings
 */
export async function ingestDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<IngestResult> {
  const startTime = Date.now();

  try {
    let chunks: TextChunk[] = [];
    const ext = fileName.toLowerCase().split(".").pop() || "";

    // Extract text based on file type
    if (mimeType === "application/pdf" || ext === "pdf") {
      chunks = await extractTextFromPDF(buffer, fileName);
    } else if (ext === "docx" || mimeType.includes("wordprocessingml")) {
      chunks = await extractTextFromDocx(buffer, fileName);
    } else if (ext === "csv" || mimeType === "text/csv") {
      chunks = extractTextFromCsv(buffer, fileName);
    } else if (["txt", "md", "markdown"].includes(ext)) {
      chunks = extractTextFromTxt(buffer, fileName);
    } else {
      throw new Error(
        `Unsupported file type: "${ext}". Supported: PDF, DOCX, TXT, MD, CSV`
      );
    }

    if (chunks.length === 0) {
      throw new Error("No text could be extracted from the document. The file may be empty or image-only.");
    }

    console.log(`[Ingest] Extracted ${chunks.length} chunks from "${fileName}"`);

    // Delete existing chunks for this document (dedup / re-ingest)
    await supabase
      .from("documents")
      .delete()
      .eq("metadata->>source", fileName);

    // Generate embeddings in batches of 100
    const EMBED_BATCH = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      const texts = batch.map((c) => c.content);
      const embeddings = await getEmbeddingsBatch(texts);
      allEmbeddings.push(...embeddings);

      const batchNum = Math.floor(i / EMBED_BATCH) + 1;
      const totalBatches = Math.ceil(chunks.length / EMBED_BATCH);
      console.log(`[Ingest] Embedded batch ${batchNum}/${totalBatches}`);
    }

    // Prepare rows
    const rows = chunks.map((chunk, i) => ({
      id: uuidv4(),
      content: chunk.content,
      metadata: {
        ...chunk.metadata,
        file_size: buffer.length,
        ingested_at: new Date().toISOString(),
      },
      embedding: allEmbeddings[i],
    }));

    // Insert in batches of 25 (safe for Supabase row size)
    const INSERT_BATCH = 25;
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const batch = rows.slice(i, i + INSERT_BATCH);
      const { error } = await supabase.from("documents").insert(batch);

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Ingest] ✅ "${fileName}" — ${chunks.length} chunks in ${elapsed}s`);

    return {
      success: true,
      fileName,
      chunksCreated: chunks.length,
      elapsed: parseFloat(elapsed),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Ingest] ❌ "${fileName}": ${message}`);
    return {
      success: false,
      fileName,
      chunksCreated: 0,
      error: message,
    };
  }
}

/**
 * Lists unique documents with chunk counts from the store
 */
export async function listDocuments() {
  const { data, error } = await supabase.rpc("list_documents");

  if (error) {
    // Fallback: manual aggregation
    const { data: raw, error: rawErr } = await supabase
      .from("documents")
      .select("metadata, created_at");

    if (rawErr) throw rawErr;

    const map = new Map<string, { count: number; last_updated: string }>();
    (raw || []).forEach((row: any) => {
      const source = row.metadata?.source || "unknown";
      const existing = map.get(source);
      if (!existing || row.created_at > existing.last_updated) {
        map.set(source, {
          count: (existing?.count || 0) + 1,
          last_updated: row.created_at,
        });
      } else {
        map.set(source, { ...existing, count: existing.count + 1 });
      }
    });

    return Array.from(map.entries()).map(([source, { count, last_updated }]) => ({
      source,
      chunk_count: count,
      last_updated,
    }));
  }

  return data || [];
}

/**
 * Deletes all chunks for a document by source name
 */
export async function deleteDocument(source: string) {
  const { error, count } = await supabase
    .from("documents")
    .delete({ count: "exact" })
    .eq("metadata->>source", source);

  if (error) throw error;
  return count || 0;
}
