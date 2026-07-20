import express from 'express';
import type { Express, Request, Response } from 'express';
import { createApp } from './bootstrap';

// Vercel keeps a warm container between invocations, so the initialised app is
// cached across requests. The *promise* is cached rather than the resolved
// value: two requests hitting a cold container would otherwise each start their
// own Nest bootstrap and open a second connection pool.
let serverPromise: Promise<Express> | null = null;

async function createServer(): Promise<Express> {
  const expressApp = express();
  const app = await createApp(expressApp);

  // init() instead of listen() — Vercel owns the HTTP listener and hands us
  // (req, res) directly.
  await app.init();

  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  if (!serverPromise) {
    serverPromise = createServer().catch((error) => {
      // Don't cache a failed bootstrap, otherwise the container serves errors
      // for its whole lifetime.
      serverPromise = null;
      throw error;
    });
  }

  const server = await serverPromise;
  server(req, res);
}
