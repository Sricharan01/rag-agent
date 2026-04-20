# RAG Knowledge Agent 🧠

A production-ready Retrieval-Augmented Generation (RAG) application powered by **Claude AI**, **Supabase pgvector**, and **Next.js 14**. Upload documents and get AI-powered answers with source citations, powered by hybrid semantic + keyword search.

## ✨ Features

- **Full Ingestion Pipeline** — PDF, DOCX, TXT, MD, CSV support with page-aware chunking
- **Hybrid Search** — Reciprocal Rank Fusion of vector similarity (pgvector) + BM25 full-text
- **Claude AI** — Answers with inline source citations, conversation history, and reasoning explanations
- **Advanced UI** — Dark glassmorphism design, drag-and-drop upload, expandable source cards
- **Production Ready** — Deploys to Netlify with one click, proper security headers

## 🚀 Quick Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy)

1. Push repo to GitHub
2. Import on Netlify → Build settings auto-detected via `netlify.toml`
3. Add environment variables (see below)

## ⚙️ Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `ANTHROPIC_API_KEY` | Claude API key (console.anthropic.com) |
| `OPENAI_API_KEY` | OpenAI API key for embeddings (platform.openai.com) |

## 🗄️ Supabase Setup

Run `supabase-schema.sql` in your Supabase SQL Editor:

```
Dashboard → SQL Editor → New query → Paste → Run
```

This creates:
- `documents` table with pgvector embeddings + full-text search
- `hybrid_search()` — RRF-merged vector + keyword search
- `match_documents()` — Pure cosine similarity search
- `list_documents()` — Grouped document listing

## 🏃 Local Development

```bash
# Install dependencies
npm install

# Copy env file and fill in your keys
cp .env.example .env.local

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Supported File Types

| Format | Notes |
|--------|-------|
| PDF | Page-aware chunking |
| DOCX | Full text extraction via mammoth |
| TXT / MD | Smart paragraph chunking |
| CSV | Row-grouped chunks (50 rows each) |

## 🔧 Architecture

```
Upload → Text Extract → Smart Chunking → OpenAI Embeddings → Supabase pgvector
Query  → Hybrid Search (Vector + FTS) → Claude AI → Answer + Citations + Reasoning
```

## 📦 Tech Stack

- **Next.js 14** — App Router, Server Components
- **Supabase** — PostgreSQL + pgvector + Full-Text Search
- **OpenAI** — text-embedding-3-small
- **Anthropic Claude** — claude-opus-4-5 (answers) + claude-haiku-4-5 (reasoning)
- **Netlify** — Deployment with @netlify/plugin-nextjs
