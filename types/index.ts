export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    page?: number;
    chunk_index: number;
    total_chunks?: number;
    file_type?: string;
    char_count?: number;
    ingested_at?: string;
  };
  similarity: number;
}

export interface QueryRequest {
  query: string;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
  topK?: number;
}

export interface QueryResponse {
  answer: string;
  sources: DocumentChunk[];
  reasoning: string;
  elapsed?: number;
}

export interface IngestResult {
  success: boolean;
  fileName: string;
  chunksCreated: number;
  error?: string;
  elapsed?: number;
}

export interface UploadedDocument {
  source: string;
  chunk_count: number;
  last_updated: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: DocumentChunk[];
  reasoning?: string;
  elapsed?: number;
  timestamp: Date;
}
