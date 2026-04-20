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
