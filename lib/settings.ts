import { supabase } from "./supabase";

export interface AppSettings {
  openai_api_key: string;
  anthropic_api_key: string;
  gemini_api_key: string;
  ai_provider: "claude" | "gemini" | "openai";
}

/** Returns true if the key is a non-empty non-placeholder value */
function isValidKey(key: string | undefined): boolean {
  return !!key && key.trim().length > 0 && !key.startsWith("your_");
}

/** Reads all settings from Supabase, merges with env vars (env takes priority) */
export async function getSettings(): Promise<AppSettings> {
  // Auto-detect best default provider based on which keys are configured
  const envAnthropicKey = isValidKey(process.env.ANTHROPIC_API_KEY) ? process.env.ANTHROPIC_API_KEY! : "";
  const envOpenAIKey = isValidKey(process.env.OPENAI_API_KEY) ? process.env.OPENAI_API_KEY! : "";
  const autoProvider: AppSettings["ai_provider"] = envAnthropicKey ? "claude" : envOpenAIKey ? "openai" : "claude";

  const defaults: AppSettings = {
    openai_api_key: envOpenAIKey,
    anthropic_api_key: envAnthropicKey,
    gemini_api_key: process.env.GEMINI_API_KEY || "",
    ai_provider: autoProvider,
  };

  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value");

    if (error || !data) return defaults;

    const dbSettings = Object.fromEntries(data.map((r) => [r.key, r.value]));

    return {
      openai_api_key:
        envOpenAIKey || dbSettings.openai_api_key || "",
      anthropic_api_key:
        envAnthropicKey || dbSettings.anthropic_api_key || "",
      gemini_api_key:
        process.env.GEMINI_API_KEY || dbSettings.gemini_api_key || "",
      // Env AI_PROVIDER > DB > auto-detected default
      ai_provider: (
        (process.env.AI_PROVIDER as AppSettings["ai_provider"]) ||
        (dbSettings.ai_provider as AppSettings["ai_provider"]) ||
        autoProvider
      ),
    };
  } catch {
    return defaults;
  }
}

/** Saves a single setting to Supabase */
export async function saveSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) throw new Error(`Failed to save setting "${key}": ${error.message}`);
}

/** Saves multiple settings at once */
export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value: String(value),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("app_settings").upsert(rows);
  if (error) throw new Error(`Failed to save settings: ${error.message}`);
}

/** Resolve the active OpenAI key (env > DB) */
export async function resolveOpenAIKey(): Promise<string> {
  if (isValidKey(process.env.OPENAI_API_KEY)) return process.env.OPENAI_API_KEY!;
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "openai_api_key")
    .single();
  return data?.value || "";
}

/** Resolve the active Anthropic key (env > DB) */
export async function resolveAnthropicKey(): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "anthropic_api_key")
    .single();
  return data?.value || "";
}

/** Resolve the active Gemini key (env > DB) */
export async function resolveGeminiKey(): Promise<string> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "gemini_api_key")
    .single();
  return data?.value || "";
}
