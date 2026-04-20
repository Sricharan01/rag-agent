-- ============================================================
-- RAG Agent — Settings Table (API Keys Persistence)
-- Run this in Supabase SQL Editor AFTER the main schema
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Settings table: stores global app configuration (API keys, preferences)
create table if not exists app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz default now()
);

-- Upsert helper function for updating settings
create or replace function upsert_setting(p_key text, p_value text)
returns void language sql as $$
  insert into app_settings (key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now();
$$;

-- Pre-insert empty placeholders so rows exist on first load
insert into app_settings (key, value) values
  ('openai_api_key',    ''),
  ('anthropic_api_key', ''),
  ('gemini_api_key',    ''),
  ('ai_provider',       'claude')
on conflict (key) do nothing;

-- ============================================================
-- Verification
-- ============================================================
-- select * from app_settings;
