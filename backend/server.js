import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import multer from 'multer';

import { setIO, toCamelCase } from './lib/emitter.js';
import { approvalBus } from './lib/approvalBus.js';
import { loadConfig, runPipeline, stopRun, sendLeadEmail } from './lib/runner.js';
import { parseLeadsCSVFromString } from './lib/csv.js';
import {
  getAllRuns, getRunById, getLeadsByRunId, getLogsByRunId,
  getRecentRun, getLeadById, getLeadStatusCounts
} from './lib/db.js';
import { testSMTPConnection } from './lib/sender.js';
import { testGChatWebhook } from './lib/gchat.js';
import logger from './lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH  = join(__dirname, 'config.yaml');
const PROMPTS_DIR  = join(__dirname, 'prompts');

const app        = express();
const httpServer = createServer(app);

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: {
    origin:  frontendUrl,
    methods: ['GET', 'POST']
  },
  // Ping clients every 25s, disconnect after 60s of silence
  pingInterval: 25000,
  pingTimeout:  60000
});

setIO(io);

app.use(express.json());
app.use(cors({ origin: frontendUrl }));

// ── Multer (CSV upload) ───────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// In-memory uploaded leads state
let uploadedLeadsState = null; // { leads: object[], fileName: string, uploadedAt: string } | null

// Track active run
let activeRunId = null;

// ── REST Endpoints ────────────────────────────────────────────────────────────

// ── CSV Upload ────────────────────────────────────────────────────────────────

app.post('/api/leads/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send a CSV file as multipart field "file".' });
  }

  const csvContent = req.file.buffer.toString('utf-8');
  const { leads, errors } = parseLeadsCSVFromString(csvContent);

  if (leads.length === 0) {
    return res.status(422).json({
      error: 'No valid leads found in CSV.',
      parseErrors: errors,
    });
  }

  uploadedLeadsState = {
    leads,
    fileName:   req.file.originalname,
    uploadedAt: new Date().toISOString(),
    parseErrors: errors,
  };

  logger.info({ module: 'server' }, `CSV uploaded: ${leads.length} leads from "${req.file.originalname}"`);

  res.json({
    ok:          true,
    count:       leads.length,
    fileName:    req.file.originalname,
    parseErrors: errors,
    preview:     leads.slice(0, 3).map(l => ({ name: l.full_name, email: l.email, company: l.company })),
  });
});

app.get('/api/leads/upload', (req, res) => {
  if (!uploadedLeadsState) {
    // Check if default CSV exists + has content
    const defaultCsvPath = join(__dirname, 'data', 'leads.csv');
    const defaultExists = existsSync(defaultCsvPath);
    return res.json({
      uploaded:    false,
      defaultCsv:  defaultExists,
      count:       0,
      fileName:    null,
    });
  }
  res.json({
    uploaded:    true,
    defaultCsv:  true,
    count:       uploadedLeadsState.leads.length,
    fileName:    uploadedLeadsState.fileName,
    uploadedAt:  uploadedLeadsState.uploadedAt,
    parseErrors: uploadedLeadsState.parseErrors,
    preview:     uploadedLeadsState.leads.slice(0, 3).map(l => ({
      name: l.full_name, email: l.email, company: l.company,
    })),
  });
});

app.delete('/api/leads/upload', (_req, res) => {
  uploadedLeadsState = null;
  logger.info({ module: 'server' }, 'Uploaded leads cleared');
  res.json({ ok: true, message: 'Uploaded leads cleared' });
});

app.post('/api/run/start', (req, res) => {
  if (activeRunId) {
    return res.status(409).json({ error: 'Run already active', runId: activeRunId });
  }

  let baseConfig;
  try {
    baseConfig = loadConfig();
  } catch (err) {
    return res.status(500).json({ error: `Failed to load config: ${err.message}` });
  }

  const { region, industry, leadsCount, dryRun } = req.body;
  const config = { ...baseConfig };
  if (region)     config.region   = region;
  if (industry)   config.industry = industry;
  if (leadsCount) config.run      = { ...config.run, leads_per_run: leadsCount };
  if (dryRun !== undefined) config.run = { ...config.run, dry_run: dryRun };

  const runId = crypto.randomUUID();
  activeRunId = runId;

  // Capture and clear uploaded leads for this run
  const leadsForRun = uploadedLeadsState?.leads || null;
  if (uploadedLeadsState) {
    uploadedLeadsState = null; // Clear after consumption
  }

  runPipeline(config, runId, leadsForRun)
    .catch(err => {
      logger.error({ module: 'server', runId }, `Pipeline error: ${err.message}`);
    })
    .finally(() => {
      activeRunId = null;
    });

  res.json({ runId });
});

app.post('/api/run/stop', (_req, res) => {
  stopRun();
  activeRunId = null;
  res.json({ message: 'Stop signal sent' });
});

app.get('/api/run/current', (_req, res) => {
  if (activeRunId) {
    const run = getRunById(activeRunId);
    if (run) {
      const leads = getLeadsByRunId(activeRunId).map(toCamelCase);
      return res.json({ ...run, leads });
    }
  }

  const recent = getRecentRun();
  if (recent && recent.status === 'running') {
    activeRunId = recent.id; // Recover orphaned run
    const leads = getLeadsByRunId(recent.id).map(toCamelCase);
    return res.json({ ...recent, leads });
  }

  res.json({ status: 'idle' });
});

app.get('/api/runs', (_req, res) => {
  try {
    const runs = getAllRuns().map(run => ({
      id:        run.id,
      startedAt: run.started_at,
      endedAt:   run.ended_at,
      status:    run.status,
      config:    run.config_snapshot ? (() => {
        try {
          const snap = JSON.parse(run.config_snapshot);
          return {
            region:     snap.region     || '',
            industry:   snap.industry   || 'All',
            leadsCount: snap.run?.leads_per_run || 10,
            dryRun:     snap.run?.dry_run       || false,
          };
        } catch { return { region: '', industry: 'All', leadsCount: 10, dryRun: false }; }
      })() : { region: '', industry: 'All', leadsCount: 10, dryRun: false },
      stats: run.stats ? (() => {
        try { return JSON.parse(run.stats); } catch { return null; }
      })() || getLeadStatusCounts(run.id) : getLeadStatusCounts(run.id),
    }));
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/runs/:runId/leads', (req, res) => {
  try {
    const leads = getLeadsByRunId(req.params.runId).map(toCamelCase);
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/runs/:runId/logs', (req, res) => {
  try {
    const logs = getLogsByRunId(req.params.runId);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/action/approve', (req, res) => {
  const { leadId } = req.body;
  if (!leadId) return res.status(400).json({ error: 'leadId required' });

  try {
    const lead = getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.status !== 'pending') {
      return res.status(400).json({ error: `Lead status is ${lead.status}, not pending` });
    }
    approvalBus.emit(`approval:${leadId}`, { action: 'approve', rewriteNote: null });
    res.json({ message: 'Approved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/action/skip', (req, res) => {
  const { leadId } = req.body;
  if (!leadId) return res.status(400).json({ error: 'leadId required' });

  try {
    const lead = getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    approvalBus.emit(`approval:${leadId}`, { action: 'skip', rewriteNote: null });
    res.json({ message: 'Skipped' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/action/rewrite', (req, res) => {
  const { leadId, note } = req.body;
  if (!leadId) return res.status(400).json({ error: 'leadId required' });

  try {
    const lead = getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    approvalBus.emit(`approval:${leadId}`, { action: 'rewrite', rewriteNote: note || '' });
    res.json({ message: 'Rewrite requested' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Approve & Send (parallel pipeline) ────────────────────────────────────────
// Hit when the user clicks "Approve & Send" on a drafted lead in the UI.
// Validates status=drafted, honors config.run.dry_run as a hard safety gate,
// then dispatches the actual SMTP send via sendLeadEmail().
app.post('/api/action/send', async (req, res) => {
  const { leadId } = req.body;
  if (!leadId) return res.status(400).json({ error: 'leadId required' });

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    return res.status(500).json({ error: `Failed to load config: ${err.message}` });
  }

  // Dry-run safety gate — refuse before doing any work.
  if (config?.run?.dry_run) {
    return res.status(400).json({ error: 'Cannot send in Dry Run mode.' });
  }

  try {
    const lead = getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.status !== 'drafted') {
      return res.status(400).json({ error: `Lead status is ${lead.status}, not drafted` });
    }

    const result = await sendLeadEmail(leadId, config);
    if (result.success) {
      res.json({ ok: true, message: 'Email sent' });
    } else {
      res.status(500).json({ error: result.error || 'Send failed' });
    }
  } catch (err) {
    logger.error({ module: 'server', leadId }, `Send endpoint error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── Config API ────────────────────────────────────────────────────────────────

app.get('/api/config', (_req, res) => {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const config = yaml.load(raw);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: `Failed to read config: ${err.message}` });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const raw    = readFileSync(CONFIG_PATH, 'utf-8');
    const current = yaml.load(raw);
    // Deep merge only the keys provided
    const update = req.body;
    const merged = deepMerge(current, update);
    writeFileSync(CONFIG_PATH, yaml.dump(merged, { lineWidth: 120 }), 'utf-8');
    res.json({ ok: true, config: merged });
  } catch (err) {
    res.status(500).json({ error: `Failed to write config: ${err.message}` });
  }
});

function deepMerge(target, source) {
  const result = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
      result[k] = deepMerge(target[k], v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ── Prompts API ───────────────────────────────────────────────────────────────

app.get('/api/prompts/:name', (req, res) => {
  const { name } = req.params;
  if (!['profile', 'email'].includes(name)) {
    return res.status(404).json({ error: 'Unknown prompt' });
  }
  try {
    const text = readFileSync(join(PROMPTS_DIR, `${name}.txt`), 'utf-8');
    res.json({ name, text });
  } catch (err) {
    res.status(500).json({ error: `Failed to read prompt: ${err.message}` });
  }
});

app.post('/api/prompts/:name', (req, res) => {
  const { name } = req.params;
  if (!['profile', 'email'].includes(name)) {
    return res.status(404).json({ error: 'Unknown prompt' });
  }
  const { text } = req.body;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text field required' });
  }
  try {
    writeFileSync(join(PROMPTS_DIR, `${name}.txt`), text, 'utf-8');
    res.json({ ok: true, name });
  } catch (err) {
    res.status(500).json({ error: `Failed to write prompt: ${err.message}` });
  }
});

app.post('/api/test/smtp', async (_req, res) => {
  try {
    const success = await testSMTPConnection();
    res.json({ success });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/test/gchat', async (_req, res) => {
  try {
    const result = await testGChatWebhook();
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    status:    'ok',
    version:   '0.1.0',
    uptime:    process.uptime(),
    activeRun: activeRunId || null
  });
});

// ── Socket.io events ──────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  logger.info({ module: 'server' }, `Client connected: ${socket.id}`);

  // Hydrate newly connected client with current run state
  if (activeRunId) {
    try {
      const run   = getRunById(activeRunId);
      const leads = getLeadsByRunId(activeRunId).map(toCamelCase);
      const logs  = getLogsByRunId(activeRunId);
      const stats = getLeadStatusCounts(activeRunId);

      socket.emit('run:started', {
        runId:  activeRunId,
        config: run?.config_snapshot ? JSON.parse(run.config_snapshot) : {}
      });

      for (const lead of leads) {
        socket.emit('lead:added', lead);
      }

      for (const log of logs) {
        socket.emit('log:entry', log);
      }

      socket.emit('stats:updated', stats);

      // Re-emit pending approvals so reconnecting UI shows the banners
      const pendingLeads = leads.filter(l => l.status === 'pending');
      for (const lead of pendingLeads) {
        socket.emit('approval:required', { leadId: lead.id });
      }
    } catch (err) {
      logger.warn({ module: 'server' }, `State hydration error: ${err.message}`);
    }
  }

  socket.on('run:start', (data) => {
    if (activeRunId) {
      socket.emit('error', { message: 'Run already active' });
      return;
    }

    let baseConfig;
    try {
      baseConfig = loadConfig();
    } catch (err) {
      socket.emit('error', { message: `Config load error: ${err.message}` });
      return;
    }

    const config = { ...baseConfig };
    if (data?.region)     config.region   = data.region;
    if (data?.industry)   config.industry = data.industry;
    if (data?.leadsCount) config.run      = { ...config.run, leads_per_run: data.leadsCount };
    if (data?.dryRun !== undefined) config.run = { ...config.run, dry_run: data.dryRun };

    const runId = crypto.randomUUID();
    activeRunId = runId;

    // Capture and clear uploaded leads for this run
    const leadsForRun = uploadedLeadsState?.leads || null;
    if (uploadedLeadsState) {
      uploadedLeadsState = null;
    }

    runPipeline(config, runId, leadsForRun)
      .catch(err => logger.error({ module: 'server', runId }, `Pipeline error: ${err.message}`))
      .finally(() => { activeRunId = null; });
  });

  socket.on('run:stop', () => {
    stopRun();
    activeRunId = null;
  });

  socket.on('action:approve', ({ leadId } = {}) => {
    if (!leadId) return;
    approvalBus.emit(`approval:${leadId}`, { action: 'approve', rewriteNote: null });
  });

  socket.on('action:skip', ({ leadId } = {}) => {
    if (!leadId) return;
    approvalBus.emit(`approval:${leadId}`, { action: 'skip', rewriteNote: null });
  });

  socket.on('action:rewrite', ({ leadId, note } = {}) => {
    if (!leadId) return;
    // note is the rewrite instruction from the user
    approvalBus.emit(`approval:${leadId}`, { action: 'rewrite', rewriteNote: note || '' });
  });

  socket.on('disconnect', (reason) => {
    logger.info({ module: 'server' }, `Client disconnected: ${socket.id} (${reason})`);
  });

  socket.on('error', (err) => {
    logger.warn({ module: 'server', socketId: socket.id }, `Socket error: ${err.message}`);
  });
});

// ── Multer error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT) || 3001;
httpServer.listen(port, () => {
  logger.info({ module: 'server' }, `Envoy server running on port ${port}`);
  console.log(`\n🚀 Envoy server running on http://localhost:${port}`);
  console.log(`   Frontend expected at: ${frontendUrl}`);
  console.log(`   Health: http://localhost:${port}/api/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info({ module: 'server' }, 'SIGTERM received — shutting down');
  httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info({ module: 'server' }, 'SIGINT received — shutting down');
  httpServer.close(() => process.exit(0));
});
