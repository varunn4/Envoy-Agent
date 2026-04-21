import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RunConfig } from '../../types/lead';
import type { UploadedFile } from '../../hooks/useRunState';
import { INDUSTRIES, LEADS_OPTIONS } from '../../lib/constants';

interface ControlsBarProps {
  running:             boolean;
  leadsCount:          number;
  uploadedFile:        UploadedFile | null;
  defaultCsvAvailable: boolean;
  onStart:             (config: RunConfig) => void;
  onStop:              () => void;
  onClear:             () => void;
  onUpload:            (file: File) => void;
  onClearUpload:       () => void;
  uploading:           boolean;
}

export function ControlsBar({
  running, leadsCount, uploadedFile, defaultCsvAvailable,
  onStart, onStop, onClear, onUpload, onClearUpload, uploading,
}: ControlsBarProps) {
  const [region,   setRegion]   = useState('Bangalore');
  const [industry, setIndustry] = useState('All');
  const [leads,    setLeads]    = useState(10);
  const [dryRun,   setDryRun]   = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasLeads = !!uploadedFile || defaultCsvAvailable;
  const canStart = !running && hasLeads && !uploading;

  const handleStart = () => {
    if (canStart) onStart({ region, industry, leadsCount: leads, dryRun });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { onUpload(file); e.target.value = ''; }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (running || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      onUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!running && !uploading) setDragOver(true);
  };

  return (
    <div
      style={{
        height: 56,
        background: dragOver ? 'rgba(37,99,235,0.06)' : 'var(--surface)',
        borderBottom: dragOver ? '1px solid var(--blue)' : '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 10,
        flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={() => setDragOver(false)}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        id="csv-file-input"
      />

      {/* CSV Upload zone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <AnimatePresence mode="wait">
          {!uploadedFile ? (
            <motion.button
              key="upload-btn"
              className="btn btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={running || uploading}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              title="Upload a CSV or drag & drop here"
              style={{
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                border: dragOver ? '1px solid var(--blue)' : '1px dashed var(--border-2)',
                color: dragOver ? 'var(--blue)' : 'var(--t2)',
                padding: '4px 10px',
                minWidth: 118,
                transition: 'border-color 0.15s, color 0.15s',
              }}
            >
              {uploading ? (
                <>
                  <span className="spin" style={{ fontSize: 13 }}>⟳</span>
                  Uploading…
                </>
              ) : dragOver ? (
                <>
                  <span style={{ fontSize: 13 }}>⤵</span>
                  Drop CSV here
                </>
              ) : (
                <>
                  <span style={{ fontSize: 13 }}>↑</span>
                  Upload CSV
                </>
              )}
            </motion.button>
          ) : (
            <motion.div
              key="upload-info"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 6,
                padding: '3px 10px 3px 8px',
                maxWidth: 240,
              }}
            >
              <span style={{ color: 'var(--green)', fontSize: 11 }}>✓</span>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  color: 'var(--green)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 120,
                }}
                title={uploadedFile.name}
              >
                {uploadedFile.name}
              </span>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: 'var(--t3)',
                flexShrink: 0,
              }}>
                {uploadedFile.count} leads
              </span>
              {!running && (
                <button
                  onClick={onClearUpload}
                  title="Remove uploaded file"
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--t3)', cursor: 'pointer',
                    padding: '0 0 0 2px', fontSize: 13, lineHeight: 1, flexShrink: 0,
                  }}
                >
                  ×
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Parse-error badge */}
        {uploadedFile && uploadedFile.parseErrors.length > 0 && (
          <div
            title={`${uploadedFile.parseErrors.length} row(s) skipped:\n${uploadedFile.parseErrors.slice(0, 5).join('\n')}${uploadedFile.parseErrors.length > 5 ? '\n…' : ''}`}
            style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
              color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 4, padding: '2px 6px', cursor: 'help', flexShrink: 0,
            }}
          >
            ⚠ {uploadedFile.parseErrors.length} skipped
          </div>
        )}
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 28, background: 'var(--border)', flexShrink: 0 }} />

      {/* Region */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 160 }}>
        <label className="field-label">Region</label>
        <input
          className="input-base"
          value={region}
          onChange={e => setRegion(e.target.value)}
          placeholder="Bangalore, UAE, GCC…"
          disabled={running}
        />
      </div>

      {/* Industry */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 120 }}>
        <label className="field-label">Industry</label>
        <select
          className="input-base"
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          disabled={running}
        >
          {INDUSTRIES.map(i => (
            <option key={i} value={i}>{i !== 'All' ? i : 'All Industries'}</option>
          ))}
        </select>
      </div>

      {/* Leads */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 110 }}>
        <label className="field-label">Leads</label>
        <select
          className="input-base"
          value={leads}
          onChange={e => setLeads(Number(e.target.value))}
          disabled={running}
        >
          {LEADS_OPTIONS.map(n => (
            <option key={n} value={n}>{n} per run</option>
          ))}
        </select>
      </div>

      {/* Dry Run */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="field-label">Dry Run</span>
        <button
          className={`toggle-pill ${dryRun ? 'on' : ''}`}
          onClick={() => setDryRun(d => !d)}
          disabled={running}
          aria-pressed={dryRun}
          aria-label="Toggle dry run"
        />
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 28, background: 'var(--border)', flexShrink: 0 }} />

      {/* Start / Stop */}
      <AnimatePresence mode="wait">
        {!running ? (
          <motion.button
            key="start"
            className="btn btn-primary"
            onClick={handleStart}
            disabled={!canStart}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            id="btn-start-run"
            title={!hasLeads ? 'Upload a CSV to begin' : undefined}
            style={{ opacity: canStart ? 1 : 0.45, cursor: canStart ? 'pointer' : 'not-allowed' }}
          >
            ▶ Start Run
          </motion.button>
        ) : (
          <motion.button
            key="stop"
            className="btn btn-danger"
            onClick={onStop}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            id="btn-stop-run"
          >
            ■ Stop
          </motion.button>
        )}
      </AnimatePresence>

      {/* Clear */}
      <button
        className="btn btn-ghost"
        onClick={onClear}
        id="btn-clear-leads"
        style={{ fontSize: 12 }}
      >
        Clear
      </button>

      {/* No-leads hint */}
      <AnimatePresence>
        {!running && !hasLeads && !uploading && (
          <motion.span
            key="no-leads-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10, color: 'var(--amber)', marginLeft: 4,
            }}
          >
            ↑ Upload a CSV or drag & drop to begin
          </motion.span>
        )}
      </AnimatePresence>

      {/* Running counter */}
      <AnimatePresence>
        {running && (
          <motion.div
            key="counter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ marginLeft: 'auto' }}
          >
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--t2)' }}>
              Processing <strong style={{ color: 'var(--blue)' }}>{leadsCount}</strong> leads
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

