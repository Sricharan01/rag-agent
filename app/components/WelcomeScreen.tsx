"use client";

interface Props {
  onSuggestion: (query: string) => void;
  hasDocuments: boolean;
}

const SUGGESTIONS = [
  "What are the main topics covered in these documents?",
  "Summarize the key findings from the uploaded files",
  "What are the most important conclusions?",
  "List all the key terms and definitions mentioned",
  "What recommendations are made in the documents?",
  "Compare and contrast the different perspectives presented",
];

export function WelcomeScreen({ onSuggestion, hasDocuments }: Props) {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        {/* Logo / Icon */}
        <div className="welcome-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#grad)" />
            <path
              d="M14 20h20M14 28h14M24 34l8-6-8-6v12z"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="48" y2="48">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Headline */}
        <h1 className="welcome-title">RAG Knowledge Agent</h1>
        <p className="welcome-subtitle">
          {hasDocuments
            ? "Your knowledge base is ready. Ask any question to get AI-powered answers with sources."
            : "Upload documents in the sidebar to enable intelligent Q&A over your private knowledge base."}
        </p>

        {/* Features */}
        <div className="welcome-features">
          <div className="feature-pill">
            <span className="feature-dot blue" />
            Hybrid Vector + Keyword Search
          </div>
          <div className="feature-pill">
            <span className="feature-dot purple" />
            Claude AI Reasoning
          </div>
          <div className="feature-pill">
            <span className="feature-dot green" />
            Source Citations
          </div>
        </div>

        {/* Suggestions */}
        {hasDocuments && (
          <div className="suggestions-grid">
            <p className="suggestions-label">Try asking:</p>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => onSuggestion(s)}
                className="suggestion-btn"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
