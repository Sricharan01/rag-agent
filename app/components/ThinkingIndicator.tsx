"use client";

export function ThinkingIndicator() {
  return (
    <div className="thinking-wrapper">
      <div className="thinking-bubble">
        <div className="thinking-dots">
          <span className="dot" style={{ animationDelay: "0ms" }} />
          <span className="dot" style={{ animationDelay: "160ms" }} />
          <span className="dot" style={{ animationDelay: "320ms" }} />
        </div>
        <span className="thinking-text">Searching knowledge base…</span>
      </div>
    </div>
  );
}
