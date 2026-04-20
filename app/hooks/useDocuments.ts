"use client";

import { useState, useCallback, useEffect } from "react";
import type { IngestResult, UploadedDocument } from "@/types";

export function useDocuments() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [uploadResults, setUploadResults] = useState<IngestResult[]>([]);

  // Fetch document list on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch("/api/ingest");
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setIsUploading(true);
    setUploadResults([]);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadResults(data.results || []);
      // Refresh document list
      await fetchDocuments();

      // Auto-clear results after 8 seconds
      setTimeout(() => setUploadResults([]), 8000);
    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadResults([
        {
          success: false,
          fileName: "Upload",
          chunksCreated: 0,
          error: error.message || "Unknown upload error",
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  }, [fetchDocuments]);

  const deleteDocument = useCallback(async (source: string) => {
    try {
      const res = await fetch("/api/ingest", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }

      setDocuments((prev) => prev.filter((d) => d.source !== source));
    } catch (error: any) {
      console.error("Delete error:", error);
      throw error;
    }
  }, []);

  return {
    documents,
    isUploading,
    uploadResults,
    isFetching,
    uploadFiles,
    deleteDocument,
    refreshDocuments: fetchDocuments,
  };
}
