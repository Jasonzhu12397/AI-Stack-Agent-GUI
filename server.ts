import express from 'express';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/api';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Standard middleware
  app.use(express.json());

  // Mount API router
  app.use('/api/v1', apiRouter);

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
