-- ============================================================
-- RAG Agent — Complete Supabase SQL Schema (Fixed)
-- Run this ENTIRE file in: Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Enable full-text search trigram extension
create extension if not exists pg_trgm;

-- ============================================================
-- 3. Documents table
-- ============================================================
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  metadata    jsonb not null default '{}',
  embedding   vector(1536),
  fts         tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored,
  created_at  timestamptz default now()
);

-- 4. Vector similarity index (HNSW)
create index if not exists documents_embedding_idx
  on documents
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 5. Full-text search index
create index if not exists documents_fts_idx
  on documents
  using gin (fts);

-- 6. Metadata source index
create index if not exists documents_source_idx
  on documents ((metadata->>'source'));

-- ============================================================
-- 7. Settings table
-- ============================================================
create table if not exists app_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz default now()
);

-- Pre-seed default settings rows
insert into app_settings (key, value) values
  ('openai_api_key',    ''),
  ('anthropic_api_key', ''),
  ('gemini_api_key',    ''),
  ('ai_provider',       'claude')
on conflict (key) do nothing;

-- ============================================================
-- 8. Pure vector similarity search
-- ============================================================
create or replace function match_documents(
  query_embedding vector(1536),
  match_count     int     default 8,
  match_threshold float   default 0.25
)
returns table (
  id          uuid,
  content     text,
  metadata    jsonb,
  similarity  float
)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- 9. Hybrid search (vector + full-text) with Reciprocal Rank Fusion
--    Safe version: gracefully handles queries with no FTS matches
-- ============================================================
create or replace function hybrid_search(
  query_text      text,
  query_embedding vector(1536),
  match_count     int   default 8,
  rrf_k           int   default 60
)
returns table (
  id          uuid,
  content     text,
  metadata    jsonb,
  similarity  float,
  score       float
)
language plpgsql stable
as $$
declare
  tsq tsquery;
begin
  -- Safely build tsquery; fall back to NULL if query_text cannot be parsed
  begin
    tsq := plainto_tsquery('english', query_text);
  exception when others then
    tsq := null;
  end;

  return query
  with
  vector_results as (
    select
      id,
      row_number() over (order by embedding <=> query_embedding) as rank_v,
      1 - (embedding <=> query_embedding) as similarity
    from documents
    order by embedding <=> query_embedding
    limit match_count * 2
  ),
  fts_results as (
    select
      id,
      row_number() over (order by ts_rank_cd(fts, tsq) desc) as rank_f
    from documents
    where tsq is not null and fts @@ tsq
    limit match_count * 2
  ),
  rrf as (
    select
      coalesce(v.id, f.id) as id,
      coalesce(1.0 / (rrf_k + v.rank_v), 0) +
      coalesce(1.0 / (rrf_k + f.rank_f), 0) as rrf_score,
      coalesce(v.similarity, 0) as similarity
    from vector_results v
    full outer join fts_results f on v.id = f.id
  )
  select
    d.id,
    d.content,
    d.metadata,
    r.similarity,
    r.rrf_score as score
  from rrf r
  join documents d on d.id = r.id
  order by r.rrf_score desc
  limit match_count;
end;
$$;

-- ============================================================
-- 10. List documents helper
-- ============================================================
create or replace function list_documents()
returns table (
  source      text,
  chunk_count bigint,
  last_updated timestamptz
)
language sql stable
as $$
  select
    metadata->>'source'        as source,
    count(*)                   as chunk_count,
    max(created_at)            as last_updated
  from documents
  group by metadata->>'source'
  order by max(created_at) desc;
$$;

-- ============================================================
-- 11. Disable Row Level Security
--     This app uses server-side only access — RLS is not needed.
--     Run these if you get "violates row-level security policy" errors.
-- ============================================================
alter table documents disable row level security;
alter table app_settings disable row level security;

-- ============================================================
-- Verification (uncomment and run to confirm setup)
-- ============================================================
-- select extname from pg_extension where extname in ('vector', 'pg_trgm');
-- select count(*) from documents;
-- select * from app_settings;
-- select * from list_documents();
