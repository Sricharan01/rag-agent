import { NextRequest, NextResponse } from "next/server";
import { queryRAG } from "@/lib/rag";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, conversationHistory = [], topK = 20 } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "A valid 'query' string is required." },
        { status: 400 }
      );
    }

    if (query.trim().length > 2000) {
      return NextResponse.json(
        { error: "Query too long. Maximum 2000 characters." },
        { status: 400 }
      );
    }

    const result = await queryRAG({
      query: query.trim(),
      conversationHistory,
      topK: Math.min(Math.max(topK, 1), 50), // Clamp 1–50
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[API /query] Error:", error);

    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("API key") ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
