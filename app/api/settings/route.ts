import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// GET /api/settings — return current settings (keys masked for security)
export async function GET() {
  try {
    const settings = await getSettings();

    // Mask keys: only show last 6 chars or empty
    const mask = (k: string) =>
      k.length > 6 ? "••••••••" + k.slice(-6) : k.length > 0 ? "••••" : "";

    return NextResponse.json({
      openai_api_key:    mask(settings.openai_api_key),
      anthropic_api_key: mask(settings.anthropic_api_key),
      gemini_api_key:    mask(settings.gemini_api_key),
      ai_provider:       settings.ai_provider,
      // Indicate which keys are configured (boolean)
      has_openai:    settings.openai_api_key.length > 0,
      has_anthropic: settings.anthropic_api_key.length > 0,
      has_gemini:    settings.gemini_api_key.length > 0,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

// POST /api/settings — save settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const allowed = ["openai_api_key", "anthropic_api_key", "gemini_api_key", "ai_provider"];
    const toSave: Record<string, string> = {};

    for (const key of allowed) {
      if (typeof body[key] === "string") {
        toSave[key] = body[key].trim();
      }
    }

    if (Object.keys(toSave).length === 0) {
      return NextResponse.json({ error: "No valid settings provided" }, { status: 400 });
    }

    await saveSettings(toSave as any);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
