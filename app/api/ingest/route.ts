import { NextRequest, NextResponse } from "next/server";
import { ingestDocument, isSupportedType } from "@/lib/ingest";
import { listDocuments, deleteDocument } from "@/lib/ingest";

export const maxDuration = 300; // 5 minutes for large files
export const dynamic = "force-dynamic";

// ── POST /api/ingest — Upload and process documents ──────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Process all files in parallel
    const results = await Promise.all(
      files.map(async (file) => {
        if (!isSupportedType(file.type, file.name)) {
          return {
            success: false,
            fileName: file.name,
            chunksCreated: 0,
            error: `Unsupported file type. Use PDF, DOCX, TXT, MD, or CSV.`,
          };
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        return ingestDocument(buffer, file.name, file.type);
      })
    );

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json(
      {
        results,
        summary: { succeeded, failed, total: results.length },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API /ingest] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// ── GET /api/ingest — List all ingested documents ───────────────────────────
export async function GET() {
  try {
    const documents = await listDocuments();
    return NextResponse.json({ documents }, { status: 200 });
  } catch (error) {
    console.error("[API /ingest] List error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/ingest — Remove a document by source ────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { source } = await req.json();

    if (!source || typeof source !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'source' field" },
        { status: 400 }
      );
    }

    const deleted = await deleteDocument(source);
    return NextResponse.json(
      { success: true, deleted, source },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API /ingest] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
