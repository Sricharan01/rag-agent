export interface TextChunk {
  content: string;
  metadata: {
    source: string;
    page?: number;
    chunk_index: number;
    total_chunks?: number;
    file_type?: string;
    char_count?: number;
  };
}

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * Splits text into overlapping chunks with smart sentence boundary detection
 */
export function chunkText(
  text: string,
  source: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const { chunkSize = 1200, chunkOverlap = 250 } = options;

  // Clean and normalize text
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\t/g, "  ")
    .replace(/[ ]{3,}/g, " ")
    .trim();

  if (cleaned.length === 0) return [];

  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < cleaned.length) {
    const endIndex = Math.min(startIndex + chunkSize, cleaned.length);
    let chunkEnd = endIndex;

    // Try to break at a natural boundary (sentence, paragraph, word)
    if (endIndex < cleaned.length) {
      // Priority: paragraph > sentence > word boundary
      const paraBreak = cleaned.lastIndexOf("\n\n", endIndex);
      const sentenceBreak = Math.max(
        cleaned.lastIndexOf(". ", endIndex),
        cleaned.lastIndexOf("! ", endIndex),
        cleaned.lastIndexOf("? ", endIndex),
        cleaned.lastIndexOf(".\n", endIndex)
      );
      const wordBreak = cleaned.lastIndexOf(" ", endIndex);

      if (paraBreak > startIndex + chunkSize * 0.5) {
        chunkEnd = paraBreak + 2;
      } else if (sentenceBreak > startIndex + chunkSize * 0.5) {
        chunkEnd = sentenceBreak + 1;
      } else if (wordBreak > startIndex + chunkSize * 0.5) {
        chunkEnd = wordBreak + 1;
      }
    }

    const chunkContent = cleaned.slice(startIndex, chunkEnd).trim();

    if (chunkContent.length > 50) {
      chunks.push({
        content: chunkContent,
        metadata: {
          source,
          chunk_index: chunkIndex,
          char_count: chunkContent.length,
        },
      });
      chunkIndex++;
    }

    // Move forward with overlap
    startIndex = Math.max(startIndex + 1, chunkEnd - chunkOverlap);
  }

  // Stamp total chunk count
  chunks.forEach((chunk) => {
    chunk.metadata.total_chunks = chunks.length;
  });

  return chunks;
}

/**
 * Extracts text from a PDF buffer
 */
export async function extractTextFromPDF(
  buffer: Buffer,
  fileName: string
): Promise<TextChunk[]> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);

  // Split by pages when page info is available
  if (data.numpages > 1) {
    const pageChunks: TextChunk[] = [];
    const textPerPage = data.text.split("\n\f"); // form-feed = page break

    for (let pageNum = 0; pageNum < textPerPage.length; pageNum++) {
      const pageText = textPerPage[pageNum];
      if (!pageText || pageText.trim().length < 20) continue;

      const chunks = chunkText(pageText, fileName, {
        chunkSize: 1200,
        chunkOverlap: 200,
      });

      chunks.forEach((chunk) => {
        chunk.metadata.page = pageNum + 1;
        chunk.metadata.file_type = "pdf";
      });

      pageChunks.push(...chunks);
    }

    // Re-index
    pageChunks.forEach((chunk, i) => {
      chunk.metadata.chunk_index = i;
      chunk.metadata.total_chunks = pageChunks.length;
    });

    if (pageChunks.length > 0) return pageChunks;
  }

  // Fallback: chunk the full text
  const chunks = chunkText(data.text, fileName, {
    chunkSize: 1200,
    chunkOverlap: 250,
  });
  chunks.forEach((c) => {
    c.metadata.file_type = "pdf";
  });
  return chunks;
}

/**
 * Extracts text from a plain text / markdown buffer
 */
export function extractTextFromTxt(
  buffer: Buffer,
  fileName: string
): TextChunk[] {
  const text = buffer.toString("utf-8");
  const fileType = fileName.endsWith(".md") ? "markdown" : "text";
  const chunks = chunkText(text, fileName);
  chunks.forEach((c) => {
    c.metadata.file_type = fileType;
  });
  return chunks;
}

/**
 * Extracts text from a DOCX buffer using mammoth
 */
export async function extractTextFromDocx(
  buffer: Buffer,
  fileName: string
): Promise<TextChunk[]> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const chunks = chunkText(result.value, fileName, {
      chunkSize: 1200,
      chunkOverlap: 200,
    });
    chunks.forEach((c) => {
      c.metadata.file_type = "docx";
    });
    return chunks;
  } catch (error) {
    console.error("DOCX extraction error:", error);
    throw new Error(`Failed to parse DOCX: ${fileName}`);
  }
}

/**
 * Extracts text from a CSV buffer
 */
export function extractTextFromCsv(
  buffer: Buffer,
  fileName: string
): TextChunk[] {
  const text = buffer.toString("utf-8");
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headers = lines[0];

  // Group rows into chunks of 50 rows each
  const ROW_CHUNK_SIZE = 50;
  const chunks: TextChunk[] = [];

  for (let i = 1; i < lines.length; i += ROW_CHUNK_SIZE) {
    const rowGroup = lines.slice(i, i + ROW_CHUNK_SIZE);
    const chunkText = `${headers}\n${rowGroup.join("\n")}`;
    const chunkIndex = Math.floor((i - 1) / ROW_CHUNK_SIZE);

    chunks.push({
      content: chunkText,
      metadata: {
        source: fileName,
        chunk_index: chunkIndex,
        file_type: "csv",
        char_count: chunkText.length,
      },
    });
  }

  chunks.forEach((c) => {
    c.metadata.total_chunks = chunks.length;
  });

  return chunks;
}
