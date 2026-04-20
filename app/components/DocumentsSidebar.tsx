"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload, FileText, Trash2, RefreshCw, CheckCircle2,
  XCircle, AlertCircle, X, FilePlus, Database, Loader2,
  FileSpreadsheet, File
} from "lucide-react";
import type { UploadedDocument, IngestResult } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface Props {
  documents: UploadedDocument[];
  isUploading: boolean;
  uploadResults: IngestResult[];
  isFetching: boolean;
  onUpload: (files: File[]) => void;
  onDelete: (source: string) => Promise<void>;
  onClose?: () => void;
}

function FileIcon({ source }: { source: string }) {
  const ext = source.toLowerCase().split(".").pop();
  if (ext === "csv") return <FileSpreadsheet size={14} className="text-emerald-400" />;
  if (ext === "pdf") return <FileText size={14} className="text-red-400" />;
  if (["docx", "doc"].includes(ext || "")) return <File size={14} className="text-blue-400" />;
  return <FileText size={14} className="text-violet-400" />;
}

export function DocumentsSidebar({
  documents,
  isUploading,
  uploadResults,
  isFetching,
  onUpload,
  onDelete,
  onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleFiles = useCallback((files: File[]) => {
    const valid = files.filter(
      (f) =>
        f.type === "application/pdf" ||
        f.type === "text/plain" ||
        f.type === "text/csv" ||
        f.type.includes("wordprocessingml") ||
        f.name.endsWith(".md") ||
        f.name.endsWith(".docx") ||
        f.name.endsWith(".csv")
    );
    if (valid.length > 0) onUpload(valid);
  }, [onUpload]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [handleFiles]
  );

  const handleDelete = async (source: string) => {
    setDeleting(source);
    try {
      await onDelete(source);
    } finally {
      setDeleting(null);
    }
  };

  const totalChunks = documents.reduce((sum, d) => sum + d.chunk_count, 0);

  return (
    <div className="sidebar-root">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <div className="sidebar-title-left">
            <Database size={16} className="text-violet-400" />
            <span className="sidebar-title">Knowledge Base</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="sidebar-close lg:hidden">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="sidebar-stats">
          <div className="stat-pill">
            <span className="stat-num">{documents.length}</span>
            <span className="stat-label">files</span>
          </div>
          <div className="stat-pill">
            <span className="stat-num">{totalChunks.toLocaleString()}</span>
            <span className="stat-label">chunks</span>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div className="sidebar-body">
        <div
          className={`dropzone ${dragging ? "dragging" : ""} ${isUploading ? "uploading" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.csv,.docx,.doc"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          />

          {isUploading ? (
            <>
              <Loader2 size={22} className="upload-icon spinning" />
              <p className="drop-text">Processing…</p>
              <p className="drop-subtext">Embedding and indexing documents</p>
            </>
          ) : (
            <>
              <FilePlus size={22} className={`upload-icon ${dragging ? "text-violet-400" : ""}`} />
              <p className="drop-text">
                {dragging ? "Release to upload" : "Drop files or click to browse"}
              </p>
              <p className="drop-subtext">PDF · DOCX · TXT · MD · CSV</p>
            </>
          )}
        </div>

        {/* Upload results */}
        {uploadResults.length > 0 && (
          <div className="upload-results">
            {uploadResults.map((r, i) => (
              <div
                key={i}
                className={`result-row ${r.success ? "success" : "error"}`}
              >
                {r.success ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <XCircle size={13} />
                )}
                <div className="result-info">
                  <span className="result-name">{r.fileName}</span>
                  {r.success ? (
                    <span className="result-detail">
                      {r.chunksCreated} chunks · {r.elapsed?.toFixed(1)}s
                    </span>
                  ) : (
                    <span className="result-error">{r.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Document list */}
        <div className="doc-list-header">
          <span className="doc-list-label">Ingested Documents</span>
          {isFetching && <Loader2 size={12} className="spinning text-violet-400" />}
        </div>

        {isFetching && documents.length === 0 ? (
          <div className="empty-state">
            <Loader2 size={24} className="spinning opacity-40" />
            <p>Loading…</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <Upload size={24} className="opacity-30" />
            <p>No documents yet</p>
            <p className="empty-sub">Upload files above to get started</p>
          </div>
        ) : (
          <div className="doc-list">
            {documents.map((doc) => (
              <div key={doc.source} className="doc-row">
                <FileIcon source={doc.source} />
                <div className="doc-info">
                  <span className="doc-name" title={doc.source}>
                    {doc.source}
                  </span>
                  <div className="doc-meta">
                    <span>{doc.chunk_count} chunks</span>
                    {doc.last_updated && (
                      <span>
                        {formatDistanceToNow(new Date(doc.last_updated), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.source)}
                  disabled={deleting === doc.source}
                  className="doc-delete-btn"
                  title="Delete document"
                >
                  {deleting === doc.source ? (
                    <Loader2 size={13} className="spinning" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="sidebar-footer">
        <AlertCircle size={11} className="text-violet-400 flex-shrink-0" />
        <span>Docs are chunked + embedded for semantic search</span>
      </div>
    </div>
  );
}
