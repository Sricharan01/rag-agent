#!/usr/bin/env tsx
/**
 * scripts/ingest.ts
 * Pre-ingest documents from the /documents folder into Supabase
 *
 * Usage:
 *   npx tsx scripts/ingest.ts
 *   npx tsx scripts/ingest.ts --file path/to/file.pdf
 *   npx tsx scripts/ingest.ts --dir path/to/folder
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, basename } from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Load env manually (tsx doesn't auto-load .env.local)
import { config } from "process";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gimpozwgyxirktssryyg.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_EglgizV4-kwbQVHRuoWMZw_6h3SzJ2k";
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
  console.error("❌ OPENAI_API_KEY is not set in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// ── Text chunking ──────────────────────────────────────────────

function chunkText(
  text: string,
  source: string,
  chunkSize = 1200,
  overlap = 250
) {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const chunks: { content: string; metadata: any }[] = [];
  let start = 0;
  let idx = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    let breakPt = end;

    if (end < cleaned.length) {
      const p = cleaned.lastIndexOf(".", end);
      const n = cleaned.lastIndexOf("\n", end);
      const bp = Math.max(p, n);
      if (bp > start + chunkSize * 0.5) breakPt = bp + 1;
    }

    const chunk = cleaned.slice(start, breakPt).trim();
    if (chunk.length > 50) {
      chunks.push({
        content: chunk,
        metadata: { source, chunk_index: idx },
      });
      idx++;
    }
    start = Math.max(start + 1, breakPt - overlap);
  }

  return chunks;
}

// ── Embedding ──────────────────────────────────────────────────

async function embedBatch(texts: string[]): Promise<number[][]> {
  const cleaned = texts.map((t) => t.replace(/\n+/g, " ").trim().slice(0, 8000));
  const res = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: cleaned,
    dimensions: 1536,  // Truncate to match vector(1536) schema
  });
  return res.data.map((d) => d.embedding);
}

// ── PDF extraction ─────────────────────────────────────────────

async function extractPDF(filePath: string): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const buffer = readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

// ── Ingest a single file ──────────────────────────────────────

async function ingestFile(filePath: string) {
  const fileName = basename(filePath);
  const ext = extname(filePath).toLowerCase();

  console.log(`\n📄 Ingesting: ${fileName}`);

  let text = "";

  try {
    if (ext === ".pdf") {
      console.log("  → Extracting PDF text…");
      text = await extractPDF(filePath);
    } else if ([".txt", ".md"].includes(ext)) {
      text = readFileSync(filePath, "utf-8");
    } else {
      console.log(`  ⚠️  Skipping unsupported format: ${ext}`);
      return;
    }
  } catch (err: any) {
    console.error(`  ❌ Failed to extract: ${err.message}`);
    return;
  }

  const chunks = chunkText(text, fileName);
  console.log(`  → ${chunks.length} chunks created`);

  // Embed in batches of 50
  const batchSize = 50;
  let inserted = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    process.stdout.write(
      `  → Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}…`
    );

    const embeddings = await embedBatch(batch.map((c) => c.content));

    const rows = batch.map((chunk, j) => ({
      content: chunk.content,
      metadata: chunk.metadata,
      embedding: embeddings[j],
    }));

    const { error } = await supabase.from("documents").insert(rows);

    if (error) {
      console.error(`\n  ❌ Insert error: ${error.message}`);
      return;
    }

    inserted += rows.length;
    process.stdout.write(` ✓\n`);
  }

  console.log(`  ✅ Done — ${inserted} chunks stored`);
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let targets: string[] = [];

  if (args.includes("--file")) {
    const idx = args.indexOf("--file");
    targets = [args[idx + 1]];
  } else if (args.includes("--dir")) {
    const idx = args.indexOf("--dir");
    const dir = args[idx + 1];
    targets = readdirSync(dir)
      .filter((f) => [".pdf", ".txt", ".md"].includes(extname(f).toLowerCase()))
      .map((f) => join(dir, f));
  } else {
    // Default: ingest ./documents folder
    const docsDir = join(process.cwd(), "documents");
    try {
      targets = readdirSync(docsDir)
        .filter((f) => [".pdf", ".txt", ".md"].includes(extname(f).toLowerCase()))
        .map((f) => join(docsDir, f));
    } catch {
      console.log("No ./documents folder found. Use --file or --dir flags.");
      process.exit(0);
    }
  }

  if (targets.length === 0) {
    console.log("No files to ingest.");
    process.exit(0);
  }

  console.log(`\n🚀 Starting ingestion of ${targets.length} file(s)…`);
  console.log(`📡 Supabase: ${SUPABASE_URL}\n`);

  for (const target of targets) {
    await ingestFile(target);
  }

  console.log("\n✨ Ingestion complete!\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
