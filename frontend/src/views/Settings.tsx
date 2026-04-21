import { useState, useEffect, useCallback } from 'react';
import {
  fetchConfig, saveConfig, fetchPrompt, savePrompt,
  type BackendConfig,
} from '../lib/api';
import api from '../lib/api';

// ── Shared helpers ────────────────────────────────────────────
function SectionCard({
  title, subtitle, children, onSave, saving, saved,
}: {
  title: string; subtitle: string; children: React.ReactNode;
  onSave: () => void; saving?: boolean; saved?: boolean;
}) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: 24, marginBottom: 20,
    }}>
      <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <h2 style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16,
          color: 'var(--t1)', marginBottom: 4,
        }}>
          {title}
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--t3)' }}>
          {subtitle}
        </p>
      </div>
      {children}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 8, alignItems: 'center' }}>
        {saving && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--t3)' }}>
            Saving…
          </span>
        )}
        {saved && !saving && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--green)' }}>
            ✓ Saved
          </span>
        )}
        <button
          onClick={onSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ fontSize: 11, opacity: saving ? 0.6 : 1 }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function TagsInput({ tags, onChange, placeholder }: {
  tags: string[]; onChange: (t: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      onChange([...tags, input.trim()]);
      setInput('');
      e.preventDefault();
    }
  };
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border-2)',
      borderRadius: 'var(--radius-sm)', padding: '6px 10px',
      display: 'flex', flexWrap: 'wrap', gap: 6,
      minHeight: 40, alignItems: 'center',
    }}>
      {tags.map(tag => (
        <span key={tag} style={{
          background: 'var(--blue-dim)', color: '#93C5FD',
          border: '1px solid rgba(37,99,235,0.2)', borderRadius: 4,
          padding: '2px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {tag}
          <button
            onClick={() => onChange(tags.filter(t => t !== tag))}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#93C5FD', fontSize: 12, lineHeight: 1,
            }}
          >×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder ?? 'Type and press Enter'}
        style={{
          background: 'none', border: 'none', outline: 'none',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
          color: 'var(--t1)', flexGrow: 1, minWidth: 100,
        }}
      />
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        className="input-base" value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'sk-…'}
      />
      <button
        onClick={() => setShow(s => !s)}
        style={{
          position: 'absolute', right: 10, top: '50%',
          transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--t3)',
        }}
      >
        {show ? 'HIDE' : 'SHOW'}
      </button>
    </div>
  );
}

// ── Prompt editor sub-component ───────────────────────────────
function PromptEditor({ name, label, description }: {
  name: 'profile' | 'email'; label: string; description: string;
}) {
  const [text,    setText]   = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetchPrompt(name)
      .then(t => { setText(t); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [name]);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError(null);
    try {
      await savePrompt(name, text);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: 24, marginBottom: 20,
    }}>
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <h2 style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16,
          color: 'var(--t1)', marginBottom: 4,
        }}>
          {label}
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--t3)' }}>
          {description}
        </p>
      </div>

      {loading ? (
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--t3)' }}>
          Loading prompt…
        </p>
      ) : (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={14}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--border-2)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12, lineHeight: 1.7,
            color: 'var(--t1)', resize: 'vertical', outline: 'none',
          }}
        />
      )}

      {error && (
        <p style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
          color: 'var(--red)', marginTop: 8,
        }}>
          ✕ {error}
        </p>
      )}

      <div style={{
        display: 'flex', justifyContent: 'flex-end',
        alignItems: 'center', gap: 8, marginTop: 14,
      }}>
        {saving && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--t3)' }}>
            Saving…
          </span>
        )}
        {saved && !saving && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--green)' }}>
            ✓ Saved to disk
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="btn btn-primary"
          style={{ fontSize: 11, opacity: saving ? 0.6 : 1 }}
        >
          Save Prompt
        </button>
      </div>
    </div>
  );
}

// ── Sensitive settings (localStorage only) ────────────────────
interface LocalSettings {
  apollo:  { apiKey: string };
  smtp:    { host: string; port: string; user: string; password: string; from: string };
  gchat:   { webhookUrl: string; spaceId: string; serviceAccountPath: string };
  claude:  { apiKey: string };
}

const DEFAULT_LOCAL: LocalSettings = {
  apollo: { apiKey: '' },
  smtp:   { host: '', port: '587', user: '', password: '', from: '' },
  gchat:  { webhookUrl: '', spaceId: '', serviceAccountPath: '' },
  claude: { apiKey: '' },
};

function loadLocal(): LocalSettings {
  try {
    const s = localStorage.getItem('envoy_local_settings');
    return s ? { ...DEFAULT_LOCAL, ...JSON.parse(s) } : DEFAULT_LOCAL;
  } catch { return DEFAULT_LOCAL; }
}

// ── Main Settings View ─────────────────────────────────────────
export function Settings() {
  // Remote config (from config.yaml via API)
  const [cfg,        setCfg]        = useState<BackendConfig | null>(null);
  const [cfgLoading, setCfgLoading] = useState(true);
  const [cfgError,   setCfgError]   = useState<string | null>(null);

  // Per-section save states
  const [senderSaving, setSenderSaving] = useState(false);
  const [senderSaved,  setSenderSaved]  = useState(false);
  const [icpSaving,    setIcpSaving]    = useState(false);
  const [icpSaved,     setIcpSaved]     = useState(false);
  const [runSaving,    setRunSaving]    = useState(false);
  const [runSaved,     setRunSaved]     = useState(false);

  // Local-only sensitive settings
  const [local, setLocal] = useState<LocalSettings>(loadLocal);

  // Connection test state
  const [smtpTesting,  setSmtpTesting]  = useState(false);
  const [smtpResult,   setSmtpResult]   = useState<string | null>(null);
  const [gchatTesting, setGchatTesting] = useState(false);
  const [gchatResult,  setGchatResult]  = useState<string | null>(null);

  useEffect(() => {
    fetchConfig()
      .then(c => { setCfg(c); setCfgError(null); })
      .catch(err => setCfgError(err.message))
      .finally(() => setCfgLoading(false));
  }, []);

  const persistLocal = useCallback((updated: LocalSettings) => {
    setLocal(updated);
    localStorage.setItem('envoy_local_settings', JSON.stringify(updated));
  }, []);

  // Save helpers per section
  const saveSender = async () => {
    if (!cfg) return;
    setSenderSaving(true); setSenderSaved(false);
    try {
      const updated = await saveConfig({ sender: cfg.sender });
      setCfg(prev => prev ? { ...prev, ...updated } : updated);
      setSenderSaved(true);
      setTimeout(() => setSenderSaved(false), 2500);
    } finally { setSenderSaving(false); }
  };

  const saveIcp = async () => {
    if (!cfg) return;
    setIcpSaving(true); setIcpSaved(false);
    try {
      const updated = await saveConfig({ icp: cfg.icp });
      setCfg(prev => prev ? { ...prev, ...updated } : updated);
      setIcpSaved(true);
      setTimeout(() => setIcpSaved(false), 2500);
    } finally { setIcpSaving(false); }
  };

  const saveRun = async () => {
    if (!cfg) return;
    setRunSaving(true); setRunSaved(false);
    try {
      const updated = await saveConfig({ run: cfg.run });
      setCfg(prev => prev ? { ...prev, ...updated } : updated);
      setRunSaved(true);
      setTimeout(() => setRunSaved(false), 2500);
    } finally { setRunSaving(false); }
  };

  const handleSmtpTest = async () => {
    setSmtpTesting(true); setSmtpResult(null);
    try {
      const { data } = await api.post('/test/smtp');
      setSmtpResult(data.success ? '✓ Connection successful' : `✕ ${data.error || 'Failed'}`);
    } catch { setSmtpResult('✕ Request failed'); }
    finally   { setSmtpTesting(false); }
  };

  const handleGchatTest = async () => {
    setGchatTesting(true); setGchatResult(null);
    try {
      const { data } = await api.post('/test/gchat');
      setGchatResult(data.success ? '✓ Webhook reachable' : `✕ ${data.error || 'Failed'}`);
    } catch { setGchatResult('✕ Request failed'); }
    finally   { setGchatTesting(false); }
  };

  const TONE_OPTIONS    = ['direct-warm', 'formal', 'casual', 'founder-to-founder'];
  const CLAUDE_MODELS   = ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-5'];
  const ICP_INDUSTRIES  = ['Fintech', 'Healthtech', 'SaaS', 'BFSI', 'EdTech'];

  const updCfg = useCallback(<K extends keyof BackendConfig>(
    section: K, patch: Partial<BackendConfig[K]>
  ) => {
    setCfg(prev => {
      if (!prev) return prev;
      return { ...prev, [section]: { ...prev[section], ...patch } };
    });
  }, []);

  return (
    <div style={{ padding: 32, overflowY: 'auto', height: '100%', maxWidth: 780, margin: '0 auto' }}>
      <h1 style={{
        fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28,
        color: 'var(--t1)', marginBottom: 6,
      }}>
        Settings
      </h1>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--t3)', marginBottom: 28 }}>
        Configure your agent, ICP, prompts, and integrations.
      </p>

      {cfgLoading && (
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: 24, marginBottom: 20,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--t3)',
        }}>
          Loading config from backend…
        </div>
      )}

      {cfgError && (
        <div style={{
          background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 'var(--radius)', padding: '14px 20px', marginBottom: 20,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--red)',
        }}>
          ✕ Could not load config.yaml: {cfgError}. Is the backend running?
        </div>
      )}

      {/* ── SENDER PROFILE ── */}
      {cfg && (
        <SectionCard
          title="Sender Profile"
          subtitle="Who the agent sends emails as. Saved to config.yaml."
          onSave={saveSender}
          saving={senderSaving}
          saved={senderSaved}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Your Name">
              <input className="input-base" value={cfg.sender.name}
                onChange={e => updCfg('sender', { name: e.target.value })} />
            </Field>
            <Field label="Company">
              <input className="input-base" value={cfg.sender.company}
                onChange={e => updCfg('sender', { company: e.target.value })} />
            </Field>
            <Field label="Role">
              <input className="input-base" value={cfg.sender.role}
                onChange={e => updCfg('sender', { role: e.target.value })} />
            </Field>
          </div>
          <Field label={`Value Proposition (${cfg.sender.value_prop.length}/300)`}>
            <textarea
              className="input-base" maxLength={300} rows={3}
              value={cfg.sender.value_prop}
              onChange={e => updCfg('sender', { value_prop: e.target.value })}
              style={{ resize: 'vertical', fontFamily: 'DM Sans, sans-serif' }}
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Tone">
              <select className="input-base" value={cfg.sender.tone}
                onChange={e => updCfg('sender', { tone: e.target.value })}>
                {TONE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="CTA">
              <input className="input-base" value={cfg.sender.cta}
                onChange={e => updCfg('sender', { cta: e.target.value })}
                placeholder="Worth a 15 min call?" />
            </Field>
          </div>
          <Field label="Signature">
            <input className="input-base" value={cfg.sender.signature}
              onChange={e => updCfg('sender', { signature: e.target.value })}
              placeholder="First name only" />
          </Field>
        </SectionCard>
      )}

      {/* ── ICP ── */}
      {cfg && (
        <SectionCard
          title="ICP Configuration"
          subtitle="Ideal customer profile filters. Saved to config.yaml."
          onSave={saveIcp}
          saving={icpSaving}
          saved={icpSaved}
        >
          <Field label="Title Filters">
            <TagsInput
              tags={cfg.icp.titles}
              onChange={t => updCfg('icp', { titles: t })}
              placeholder="Co-Founder, VP Engineering…"
            />
          </Field>
          <Field label="Industries">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {ICP_INDUSTRIES.map(ind => (
                <label key={ind} style={{
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--t2)',
                }}>
                  <input
                    type="checkbox"
                    checked={cfg.icp.industries.map(i => i.toLowerCase()).includes(ind.toLowerCase())}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...cfg.icp.industries, ind.toLowerCase()]
                        : cfg.icp.industries.filter(i => i.toLowerCase() !== ind.toLowerCase());
                      updCfg('icp', { industries: next });
                    }}
                    style={{ accentColor: 'var(--blue)', width: 14, height: 14 }}
                  />
                  {ind}
                </label>
              ))}
            </div>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Company Size Min">
              <input className="input-base" type="number"
                value={cfg.icp.company_size.min}
                onChange={e => updCfg('icp', { company_size: { ...cfg.icp.company_size, min: +e.target.value } })} />
            </Field>
            <Field label="Company Size Max">
              <input className="input-base" type="number"
                value={cfg.icp.company_size.max}
                onChange={e => updCfg('icp', { company_size: { ...cfg.icp.company_size, max: +e.target.value } })} />
            </Field>
          </div>
          <Field label="Exclude Domains">
            <TagsInput
              tags={cfg.icp.exclude_domains}
              onChange={t => updCfg('icp', { exclude_domains: t })}
              placeholder="competitor.com…"
            />
          </Field>
        </SectionCard>
      )}

      {/* ── RUN CONFIG ── */}
      {cfg && (
        <SectionCard
          title="Run Configuration"
          subtitle="Pipeline run settings. Saved to config.yaml."
          onSave={saveRun}
          saving={runSaving}
          saved={runSaved}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label={`Leads per Run: ${cfg.run.leads_per_run}`}>
              <input type="range" min={5} max={50} value={cfg.run.leads_per_run}
                onChange={e => updCfg('run', { leads_per_run: +e.target.value })}
                style={{ width: '100%', accentColor: 'var(--blue)' }} />
            </Field>
            <Field label={`Fit Score Threshold: ${cfg.run.fit_score_threshold}/10`}>
              <input type="range" min={1} max={10} value={cfg.run.fit_score_threshold}
                onChange={e => updCfg('run', { fit_score_threshold: +e.target.value })}
                style={{ width: '100%', accentColor: 'var(--blue)' }} />
            </Field>
            <Field label="Dry Run Default">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                <button
                  className={`toggle-pill ${cfg.run.dry_run ? 'on' : ''}`}
                  onClick={() => updCfg('run', { dry_run: !cfg.run.dry_run })}
                  aria-pressed={cfg.run.dry_run}
                />
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                  color: cfg.run.dry_run ? 'var(--amber)' : 'var(--t3)',
                }}>
                  {cfg.run.dry_run ? 'ON' : 'OFF'}
                </span>
              </div>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Claude Model">
              <select className="input-base" value={cfg.claude.model}
                onChange={e => updCfg('claude', { model: e.target.value })}>
                {CLAUDE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Leads Source">
              <select className="input-base" value={cfg.run.leads_source}
                onChange={e => updCfg('run', { leads_source: e.target.value })}>
                <option value="csv">CSV file</option>
                <option value="apollo">Apollo.io</option>
              </select>
            </Field>
          </div>
        </SectionCard>
      )}

      {/* ── PROMPT EDITORS ── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 20,
      }}>
        <h2 style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16,
          color: 'var(--t1)', marginBottom: 4,
        }}>
          AI Prompts
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--t3)', marginBottom: 0 }}>
          Edit the system prompts used for profiling and email drafting. Changes are saved to disk immediately.
        </p>
      </div>

      <PromptEditor
        name="profile"
        label="Profile Prompt"
        description="Sent to Claude when analysing a lead. Must return a specific JSON shape — do not remove keys."
      />

      <PromptEditor
        name="email"
        label="Email Drafting Prompt"
        description="Sent to Claude when writing cold emails. Hard rules section controls quality — edit with care."
      />

      {/* ── SMTP (local) ── */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: 24, marginBottom: 20,
      }}>
        <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          <h2 style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16,
            color: 'var(--t1)', marginBottom: 4,
          }}>
            Email / SMTP
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--t3)' }}>
            Outbound email delivery. Stored locally in browser only (not saved to config).
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field label="SMTP Host">
            <input className="input-base" value={local.smtp.host}
              onChange={e => persistLocal({ ...local, smtp: { ...local.smtp, host: e.target.value } })}
              placeholder="smtp.gmail.com" />
          </Field>
          <Field label="Port">
            <input className="input-base" value={local.smtp.port}
              onChange={e => persistLocal({ ...local, smtp: { ...local.smtp, port: e.target.value } })}
              placeholder="587" />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Username">
            <input className="input-base" value={local.smtp.user}
              onChange={e => persistLocal({ ...local, smtp: { ...local.smtp, user: e.target.value } })} />
          </Field>
          <Field label="Password">
            <PasswordInput value={local.smtp.password}
              onChange={v => persistLocal({ ...local, smtp: { ...local.smtp, password: v } })} />
          </Field>
        </div>
        <Field label="From Address">
          <input className="input-base" value={local.smtp.from}
            onChange={e => persistLocal({ ...local, smtp: { ...local.smtp, from: e.target.value } })}
            placeholder="you@yourcompany.com" />
        </Field>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11 }}
            disabled={smtpTesting}
            onClick={handleSmtpTest}
          >
            {smtpTesting ? 'Testing…' : 'Test Connection'}
          </button>
          {smtpResult && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              color: smtpResult.startsWith('✓') ? 'var(--green)' : 'var(--red)',
            }}>
              {smtpResult}
            </span>
          )}
        </div>
      </div>

      {/* ── GChat (local) ── */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: 24, marginBottom: 20,
      }}>
        <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          <h2 style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16,
            color: 'var(--t1)', marginBottom: 4,
          }}>
            Google Chat
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--t3)' }}>
            Approval notifications. Stored locally only.
          </p>
        </div>
        <Field label="Webhook URL">
          <input className="input-base" value={local.gchat.webhookUrl}
            onChange={e => persistLocal({ ...local, gchat: { ...local.gchat, webhookUrl: e.target.value } })}
            placeholder="https://chat.googleapis.com/…" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Space ID">
            <input className="input-base" value={local.gchat.spaceId}
              onChange={e => persistLocal({ ...local, gchat: { ...local.gchat, spaceId: e.target.value } })} />
          </Field>
          <Field label="Service Account JSON Path">
            <input className="input-base" value={local.gchat.serviceAccountPath}
              onChange={e => persistLocal({ ...local, gchat: { ...local.gchat, serviceAccountPath: e.target.value } })}
              placeholder="/path/to/service-account.json" />
          </Field>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11 }}
            disabled={gchatTesting}
            onClick={handleGchatTest}
          >
            {gchatTesting ? 'Testing…' : 'Test Webhook'}
          </button>
          {gchatResult && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              color: gchatResult.startsWith('✓') ? 'var(--green)' : 'var(--red)',
            }}>
              {gchatResult}
            </span>
          )}
        </div>
      </div>

      {/* ── API Keys (local) ── */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: 24, marginBottom: 40,
      }}>
        <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          <h2 style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16,
            color: 'var(--t1)', marginBottom: 4,
          }}>
            API Keys
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--t3)' }}>
            Sensitive keys — stored locally in browser only. These override .env values in the UI only
            (set them in .env for the actual backend to use).
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Anthropic API Key">
            <PasswordInput value={local.claude.apiKey}
              onChange={v => persistLocal({ ...local, claude: { ...local.claude, apiKey: v } })} />
          </Field>
          <Field label="Apollo.io API Key">
            <PasswordInput value={local.apollo.apiKey}
              onChange={v => persistLocal({ ...local, apollo: { ...local.apollo, apiKey: v } })} />
          </Field>
        </div>
      </div>
    </div>
  );
}
