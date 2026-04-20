"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight, BookOpen, Brain, Clock, Copy, Check, User, Bot, FileText } from "lucide-react";
import type { Message, DocumentChunk } from "@/types";

interface Props {
  message: Message;
  isLatest: boolean;
}

function SourceCard({ chunk, index }: { chunk: DocumentChunk; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const score = typeof chunk.similarity === "number"
    ? Math.round(chunk.similarity * 100)
    : null;

  const source = chunk.metadata.source || "Unknown Document";
  const ext = source.split(".").pop()?.toUpperCase() ?? "DOC";
  const page = chunk.metadata.page ? ` · Page ${chunk.metadata.page}` : "";
  const chunkIdx = chunk.metadata.chunk_index != null ? ` · Chunk ${chunk.metadata.chunk_index + 1}` : "";

  return (
    <div className="source-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="source-header"
      >
        <div className="source-left">
          <span className="source-badge">[{index + 1}]</span>
          <FileText size={12} className="source-icon" />
          <div className="source-name-block">
            <span className="source-doc-name">{source}</span>
            <span className="source-position">{page}{chunkIdx}</span>
          </div>
          <span className="file-type-badge">{ext}</span>
        </div>
        <div className="source-right">
          {score !== null && (
            <span className="relevance-score" title="Relevance score">
              {score}%
            </span>
          )}
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </div>
      </button>
      {expanded && (
        <div className="source-content">
          <p>{chunk.content.slice(0, 600)}{chunk.content.length > 600 ? "…" : ""}</p>
        </div>
      )}
    </div>
  );
}

function DocSummaryStrip({ chunks }: { chunks: DocumentChunk[] }) {
  const docMap = new Map<string, { count: number; topScore: number; pages: Set<number> }>();

  chunks.forEach((c) => {
    const src = c.metadata.source || "Unknown";
    const existing = docMap.get(src) || { count: 0, topScore: 0, pages: new Set<number>() };
    existing.count++;
    if (typeof c.similarity === "number" && c.similarity > existing.topScore) {
      existing.topScore = c.similarity;
    }
    if (c.metadata.page) existing.pages.add(c.metadata.page);
    docMap.set(src, existing);
  });

  return (
    <div className="doc-summary-strip">
      <span className="doc-summary-label">
        <BookOpen size={11} />
        Documents used:
      </span>
      <div className="doc-pills">
        {Array.from(docMap.entries()).map(([src, info]) => {
          const pages = info.pages.size > 0
            ? ` · pp. ${Array.from(info.pages).sort((a, b) => a - b).slice(0, 3).join(", ")}${info.pages.size > 3 ? "…" : ""}`
            : "";
          return (
            <span key={src} className="doc-pill" title={src}>
              <FileText size={10} />
              <strong>{src}</strong>
              <span className="doc-pill-meta">{info.count} chunk{info.count !== 1 ? "s" : ""}{pages}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function MessageBubble({ message, isLatest }: Props) {
  const [showSources, setShowSources] = useState(isLatest);
  const [showReasoning, setShowReasoning] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const hasSources = message.sources && message.sources.length > 0;
  const hasReasoning = message.reasoning && message.reasoning.trim().length > 0;
  const hasElapsed = typeof message.elapsed === "number";

  return (
    <div className={`message-wrapper ${isUser ? "user" : "assistant"}`}>
      <div className={`message-avatar ${isUser ? "user-avatar" : "bot-avatar"}`}>
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      <div className="message-body">
        <div className={`message-bubble ${isUser ? "user-bubble" : "assistant-bubble"}`}>
          {isUser ? (
            <p className="user-text">{message.content}</p>
          ) : (
            <div className="prose-wrapper">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
                  h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
                  h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
                  p: ({ children }) => <p className="md-p">{children}</p>,
                  ul: ({ children }) => <ul className="md-ul">{children}</ul>,
                  ol: ({ children }) => <ol className="md-ol">{children}</ol>,
                  li: ({ children }) => <li className="md-li">{children}</li>,
                  code: ({ inline, children, ...props }: any) =>
                    inline ? (
                      <code className="md-code-inline" {...props}>{children}</code>
                    ) : (
                      <code className="md-code-block" {...props}>{children}</code>
                    ),
                  pre: ({ children }) => <pre className="md-pre">{children}</pre>,
                  blockquote: ({ children }) => (
                    <blockquote className="md-blockquote">{children}</blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="md-table-wrapper">
                      <table className="md-table">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="md-th">{children}</th>,
                  td: ({ children }) => <td className="md-td">{children}</td>,
                  strong: ({ children }) => <strong className="md-strong">{children}</strong>,
                  a: ({ children, href }) => (
                    <a href={href} className="md-link" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && hasSources && (
          <DocSummaryStrip chunks={message.sources!} />
        )}

        {!isUser && (
          <div className="message-actions">
            {hasElapsed && (
              <span className="meta-chip">
                <Clock size={10} />
                {message.elapsed!.toFixed(1)}s
              </span>
            )}

            <button onClick={copyToClipboard} className="action-btn" title="Copy">
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            {hasSources && (
              <button
                onClick={() => setShowSources(!showSources)}
                className={`action-btn ${showSources ? "active" : ""}`}
              >
                <BookOpen size={12} />
                <span>{message.sources!.length} chunk{message.sources!.length !== 1 ? "s" : ""}</span>
                {showSources ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
            )}

            {hasReasoning && (
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className={`action-btn reasoning-btn ${showReasoning ? "active" : ""}`}
              >
                <Brain size={12} />
                <span>Reasoning</span>
                {showReasoning ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
            )}
          </div>
        )}

        {showSources && hasSources && (
          <div className="sources-panel">
            <p className="panel-label">Retrieved Chunks</p>
            <div className="sources-grid">
              {message.sources!.map((chunk, i) => (
                <SourceCard key={chunk.id || i} chunk={chunk} index={i} />
              ))}
            </div>
          </div>
        )}

        {showReasoning && hasReasoning && (
          <div className="reasoning-panel">
            <div className="reasoning-header">
              <Brain size={13} className="reasoning-icon" />
              <span className="panel-label">Reasoning Chain</span>
            </div>
            <p className="reasoning-text">{message.reasoning}</p>
          </div>
        )}
      </div>
    </div>
  );
}
