"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Trash2, Menu, Zap, Settings } from "lucide-react";

import { useChat } from "./hooks/useChat";
import { useDocuments } from "./hooks/useDocuments";
import { MessageBubble } from "./components/MessageBubble";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import { ChatInput } from "./components/ChatInput";
import { DocumentsSidebar } from "./components/DocumentsSidebar";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { SettingsPanel } from "./components/SettingsPanel";

export default function Home() {
  const { messages, isLoading, sendMessage, clearChat, stopGeneration } = useChat();
  const {
    documents,
    isUploading,
    uploadResults,
    isFetching,
    uploadFiles,
    deleteDocument,
  } = useDocuments();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* ── Settings modal ── */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <div
        className={`
          fixed lg:relative z-30 lg:z-auto
          w-72 h-full flex-shrink-0
          transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <DocumentsSidebar
          documents={documents}
          isUploading={isUploading}
          uploadResults={uploadResults}
          isFetching={isFetching}
          onUpload={uploadFiles}
          onDelete={deleteDocument}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="app-header">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mobile-menu-btn lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2">
            <Zap size={16} className="text-violet-400" />
            <h1 className="header-title">RAG Knowledge Agent</h1>
          </div>

          {/* Status badge */}
          <div className="header-badge hidden sm:flex">
            <span className="status-dot" />
            <BookOpen size={10} />
            <span>{documents.length} doc{documents.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="mobile-menu-btn"
            title="API Keys & Settings"
          >
            <Settings size={17} />
          </button>

          {/* Clear chat */}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="clear-btn"
              title="Clear conversation"
            >
              <Trash2 size={12} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </header>

        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ background: "var(--bg-primary)" }}
        >
          {messages.length === 0 ? (
            <WelcomeScreen
              onSuggestion={sendMessage}
              hasDocuments={documents.length > 0}
            />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isLatest={i === messages.length - 1}
                />
              ))}
              {isLoading && <ThinkingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div
          className="px-4 py-4 border-t flex-shrink-0"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border)",
          }}
        >
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSend={sendMessage}
              onStop={stopGeneration}
              isLoading={isLoading}
              disabled={documents.length === 0 && !isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
