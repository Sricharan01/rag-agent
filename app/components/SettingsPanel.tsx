"use client";

import { useState, useEffect } from "react";
import {
  X, Save, Eye, EyeOff, CheckCircle2, XCircle, Loader2,
  KeyRound, Cpu, Zap, AlertCircle
} from "lucide-react";

interface Props {
  onClose: () => void;
}

type Provider = "claude" | "gemini" | "openai";

interface SettingsState {
  openai_api_key: string;
  anthropic_api_key: string;
  gemini_api_key: string;
  ai_provider: Provider;
}

interface StatusState {
  has_openai: boolean;
  has_anthropic: boolean;
  has_gemini: boolean;
}

function KeyField({
  label,
  id,
  value,
  onChange,
  placeholder,
  isConfigured,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  isConfigured: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="settings-field">
      <div className="settings-field-header">
        <label htmlFor={id} className="settings-label">{label}</label>
        {isConfigured && (
          <span className="key-configured-badge">
            <CheckCircle2 size={11} />
            Configured
          </span>
        )}
      </div>
      <div className="settings-input-row">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isConfigured ? "Leave blank to keep existing key" : placeholder}
          className="settings-input"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="show-toggle"
          title={show ? "Hide" : "Show"}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

export function SettingsPanel({ onClose }: Props) {
  const [form, setForm] = useState<SettingsState>({
    openai_api_key: "",
    anthropic_api_key: "",
    gemini_api_key: "",
    ai_provider: "claude",
  });
  const [status, setStatus] = useState<StatusState>({
    has_openai: false,
    has_anthropic: false,
    has_gemini: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setStatus({
          has_openai: data.has_openai,
          has_anthropic: data.has_anthropic,
          has_gemini: data.has_gemini,
        });
        setForm((f) => ({ ...f, ai_provider: data.ai_provider || "claude" }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");

    // Only send non-empty keys (blank = keep existing)
    const payload: Record<string, string> = {
      ai_provider: form.ai_provider,
    };
    if (form.openai_api_key.trim()) payload.openai_api_key = form.openai_api_key.trim();
    if (form.anthropic_api_key.trim()) payload.anthropic_api_key = form.anthropic_api_key.trim();
    if (form.gemini_api_key.trim()) payload.gemini_api_key = form.gemini_api_key.trim();

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setSaved(true);
      setForm((f) => ({ ...f, openai_api_key: "", anthropic_api_key: "", gemini_api_key: "" }));
      // Refresh status
      const fresh = await fetch("/api/settings").then((r) => r.json());
      setStatus({ has_openai: fresh.has_openai, has_anthropic: fresh.has_anthropic, has_gemini: fresh.has_gemini });
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const providers: { id: Provider; label: string; sub: string; icon: string; needsKey: boolean }[] = [
    { id: "claude",  label: "Claude (Anthropic)", sub: "claude-opus-4-5 · Best quality", icon: "🧠", needsKey: !status.has_anthropic },
    { id: "gemini",  label: "Gemini (Google)",    sub: "gemini-2.0-flash · Fast & free tier",  icon: "✨", needsKey: !status.has_gemini   },
    { id: "openai",  label: "GPT-4o (OpenAI)",    sub: "gpt-4o-mini · Reliable",               icon: "💬", needsKey: !status.has_openai   },
  ];

  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        {/* Header */}
        <div className="settings-header">
          <div className="settings-title-row">
            <KeyRound size={17} className="text-violet-400" />
            <h2 className="settings-title">API Keys & Settings</h2>
          </div>
          <button onClick={onClose} className="settings-close"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="settings-loading">
            <Loader2 size={24} className="spinning text-violet-400" />
            <p>Loading settings…</p>
          </div>
        ) : (
          <div className="settings-body">
            {/* Notice */}
            <div className="settings-notice">
              <AlertCircle size={13} className="text-violet-400 flex-shrink-0" />
              <p>Keys are saved permanently to your Supabase database. Environment variables take priority over saved keys.</p>
            </div>

            {/* AI Provider selector */}
            <div className="settings-section">
              <div className="settings-section-label">
                <Cpu size={13} />
                AI Provider
              </div>
              <div className="provider-grid">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setForm((f) => ({ ...f, ai_provider: p.id }))}
                    className={`provider-option ${form.ai_provider === p.id ? "selected" : ""}`}
                  >
                    <span className="provider-icon">{p.icon}</span>
                    <div className="provider-info">
                      <span className="provider-name">{p.label}</span>
                      <span className="provider-sub">{p.sub}</span>
                    </div>
                    {p.needsKey && (
                      <span className="provider-needs-key">Needs key</span>
                    )}
                    {!p.needsKey && (
                      <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key Fields */}
            <div className="settings-section">
              <div className="settings-section-label">
                <Zap size={13} />
                API Keys
              </div>
              <KeyField
                label="OpenAI API Key"
                id="openai_key"
                value={form.openai_api_key}
                onChange={(v) => setForm((f) => ({ ...f, openai_api_key: v }))}
                placeholder="sk-proj-..."
                isConfigured={status.has_openai}
              />
              <KeyField
                label="Anthropic API Key"
                id="anthropic_key"
                value={form.anthropic_api_key}
                onChange={(v) => setForm((f) => ({ ...f, anthropic_api_key: v }))}
                placeholder="sk-ant-..."
                isConfigured={status.has_anthropic}
              />
              <KeyField
                label="Google Gemini API Key"
                id="gemini_key"
                value={form.gemini_api_key}
                onChange={(v) => setForm((f) => ({ ...f, gemini_api_key: v }))}
                placeholder="Coming soon — paste key when ready"
                isConfigured={status.has_gemini}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="settings-error">
                <XCircle size={14} />
                {error}
              </div>
            )}

            {/* Success */}
            {saved && (
              <div className="settings-success">
                <CheckCircle2 size={14} />
                Settings saved successfully!
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="settings-footer">
          <button onClick={onClose} className="settings-cancel-btn">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="settings-save-btn"
          >
            {saving ? (
              <><Loader2 size={14} className="spinning" /> Saving…</>
            ) : (
              <><Save size={14} /> Save Settings</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
