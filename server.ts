import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createApp } from './src/server/app';
import { logStructured } from './src/server/logger';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolveListenPort(rawPort?: string): number {
  if (!rawPort) return 3000;
  const trimmed = rawPort.trim();
  if (!/^\d+$/.test(trimmed)) return 3000;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return 3000;
  }
  return parsed;
}

const PORT = resolveListenPort(process.env.PORT);

function resolveDistDirectory(): string | null {
  const candidates = [
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, 'dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
}

async function startServer() {
  const { app, db, emailService, attachLiveVoice, runtimeLifecycle } = createApp();

  // Always fail closed with 404 JSON for unmatched /api/* routes before SPA/Vite fallback
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      error: 'API endpoint not found.',
    });
  });

  const isCompiledBundle = __filename.endsWith('.mjs');
  if (process.env.NODE_ENV !== 'production' && !isCompiledBundle) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = resolveDistDirectory();
    if (distDir) {
      app.use(express.static(distDir));
      app.get('*', (req: Request, res: Response) => {
        if (req.path.startsWith('/api')) {
          res.status(404).json({ success: false, code: 'NOT_FOUND', error: 'API endpoint not found.' });
          return;
        }
        res.sendFile(path.join(distDir, 'index.html'));
      });
    } else {
      // API-only production deployment (e.g., Railway backend serving GitHub Pages frontend)
      app.get('/', (_req: Request, res: Response) => {
        res.status(200).json({
          success: true,
          service: 'OPHIREUM NETWORK API Gateway',
          healthEndpoint: '/api/health',
          readyEndpoint: '/api/ready',
          versionEndpoint: '/api/version',
        });
      });
      app.use((req: Request, res: Response) => {
        res.status(404).json({
          success: false,
          code: 'NOT_FOUND',
          error: req.path.startsWith('/api') ? 'API endpoint not found.' : 'Not found on API host.',
        });
      });
    }
  }

  // Periodic background email outbox retry worker (only when both DB & email provider are configured)
  let retryTimer: ReturnType<typeof setInterval> | null = null;
  if (db.isConfigured && emailService.isConfigured()) {
    retryTimer = setInterval(() => {
      void emailService.processRetryQueue(15).catch((err) => {
        logStructured('warn', 'outbox_retry_worker_error', { error: err?.message });
      });
    }, 60_000);
    retryTimer.unref();
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    logStructured('info', 'server_started', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      runtimeMode: __filename.endsWith('.mjs') ? 'compiled_production_artifact' : 'tsx_source',
      databaseConfigured: db.isConfigured,
      emailConfigured: emailService.isConfigured(),
      liveVoiceWebSocketPath: '/api/voice/live',
    });
  });

  const liveVoice = attachLiveVoice(httpServer);

  const shutdown = (signal: string) => {
    runtimeLifecycle.markDraining();
    logStructured('info', 'server_shutdown_initiated', {
      signal,
      inFlightRequests: runtimeLifecycle.inFlightRequests,
    });
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
    void liveVoice.close().finally(() => {
      httpServer.close(() => {
        logStructured('info', 'server_shutdown_complete', { signal });
        process.exit(0);
      });
    });
    setTimeout(() => {
      logStructured('warn', 'server_shutdown_forced_timeout', { signal });
      process.exit(1);
    }, 10_000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

// Guard auto-start when imported by unit tests
const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  startServer().catch((err) => {
    logStructured('error', 'server_boot_failed', { error: err?.message || String(err) });
    process.exit(1);
  });
}
