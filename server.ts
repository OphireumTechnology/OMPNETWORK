import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createApp } from './src/server/app';
import { logStructured } from './src/server/logger';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  const { app, db, emailService } = createApp();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api')) {
        res.status(404).json({ success: false, error: 'API endpoint not found' });
        return;
      }
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // Periodic background email outbox retry worker (only when both DB & email provider are configured)
  if (db.isConfigured && emailService.isConfigured()) {
    const timer = setInterval(() => {
      void emailService.processRetryQueue(15).catch((err) => {
        logStructured('warn', 'outbox_retry_worker_error', { error: err?.message });
      });
    }, 60_000);
    timer.unref();
  }

  app.listen(PORT, '0.0.0.0', () => {
    logStructured('info', 'server_started', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      databaseConfigured: db.isConfigured,
      emailConfigured: emailService.isConfigured(),
    });
  });
}

startServer().catch((err) => {
  logStructured('error', 'server_boot_failed', { error: err?.message || String(err) });
  process.exit(1);
});
