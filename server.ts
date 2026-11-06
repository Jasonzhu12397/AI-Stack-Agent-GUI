import express from 'express';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/api';
import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GO_PORT = 9090;

function ensureGoBackend() {
  const goBinPath = path.resolve(__dirname, 'bin/agent-studio-go-server');
  if (!fs.existsSync(goBinPath)) {
    console.log('[AI Agent Studio] Go binary not found at', goBinPath);
    return;
  }

  const ping = http.get(`http://127.0.0.1:${GO_PORT}/api/v1/health`, (res) => {
    console.log(`[AI Agent Studio] Native Go Backend active and responding on port ${GO_PORT}`);
  });
  ping.on('error', () => {
    console.log(`[AI Agent Studio] Starting Native Go Backend process on port ${GO_PORT}...`);
    const proc = spawn(goBinPath, [], {
      env: { ...process.env, PORT: String(GO_PORT) },
      stdio: 'inherit',
    });
    proc.on('error', (err) => {
      console.error('[AI Agent Studio] Failed to start Go binary:', err.message);
    });
    proc.on('exit', (code) => {
      console.log(`[AI Agent Studio] Go backend process exited with code ${code}`);
    });
  });
}

async function startServer() {
  ensureGoBackend();
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Standard middleware
  app.use(express.json());

  // Pure Golang Backend Proxy: Directs all /api/v1/* traffic to native Go binary on port 9090
  app.use('/api/v1', (req, res) => {
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: GO_PORT,
      path: `/api/v1${req.url}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${GO_PORT}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (_err) => {
      // In-flight fallback
      apiRouter(req, res, () => {
        res.status(502).json({ error: 'Native Go Backend unreachable on port ' + GO_PORT });
      });
    });

    if (req.body && Object.keys(req.body).length > 0) {
      proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
  });

  // In development, hook Vite dev server middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, 'vite.config.ts'),
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built dist files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AI Agent Studio Control Plane] running at http://0.0.0.0:${PORT}`);
    console.log(`[AI Agent Studio Control Plane] Health check: http://0.0.0.0:${PORT}/api/v1/health`);
  });
}

startServer().catch((err) => {
  console.error('[AI Agent Studio] Failed to start server:', err);
  process.exit(1);
});
