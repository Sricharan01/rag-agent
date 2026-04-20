"use client";

import { useCallback, useRef, useState } from "react";
import { Send, Square, Paperclip } from "lucide-react";

interface Props {
  onSend: (query: string) => void;
  onStop?: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, isLoading, disabled }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isLoading, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize textarea
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  };

  const charCount = value.length;
  const isNearLimit = charCount > 1800;

  return (
    <div className="chat-input-wrapper">
      <div className={`chat-input-box ${disabled ? "disabled" : ""} ${isLoading ? "loading" : ""}`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Upload documents to start chatting…"
              : "Ask anything about your documents… (Enter to send, Shift+Enter for new line)"
          }
          disabled={disabled || isLoading}
          rows={1}
          className="chat-textarea"
        />

        <div className="chat-input-actions">
          {isNearLimit && (
            <span className={`char-count ${charCount > 2000 ? "over-limit" : ""}`}>
              {charCount}/2000
            </span>
          )}
          <button
            onClick={isLoading ? onStop : handleSubmit}
            disabled={!isLoading && (!value.trim() || disabled || charCount > 2000)}
            className={`send-btn ${isLoading ? "stop-btn" : ""}`}
            title={isLoading ? "Stop generation" : "Send message"}
          >
            {isLoading ? <Square size={15} fill="currentColor" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
