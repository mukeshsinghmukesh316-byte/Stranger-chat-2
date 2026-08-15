import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { chatWsServer } from './server/websocket.js';
import { adminRouter } from './server/adminAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // 1. Production Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), microphone=(self), display-capture=()'
    );
    next();
  });

  // 2. CORS Security Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.length > 0 && origin) {
      if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      } else {
        res.status(403).json({ error: 'CORS origin prohibited' });
        return;
      }
    } else if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // 3. Body Parsing Middleware
  app.use(express.json());

  // 4. Production Health Check Endpoints (Clean: no internal user counts or session info exposed)
  const handleHealth = (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'StrangerChat',
      timestamp: new Date().toISOString(),
    });
  };

  app.get('/health', handleHealth);
  app.get('/api/health', handleHealth);

  // Public status endpoint
  app.get('/api/public/status', (_req: express.Request, res: express.Response) => {
    const settings = chatWsServer.getServerSettings();
    const maintMsg = settings.maintenanceMessage || 'StrangerChat is currently undergoing system maintenance. Matching and chat features are temporarily paused.';
    const estTime = settings.maintenanceEstimatedTime || '';
    res.status(200).json({
      maintenanceMode: Boolean(settings.maintenanceMode),
      maintenanceMessage: maintMsg,
      maintenanceEstimatedTime: estTime,
      message: settings.maintenanceMode ? maintMsg : 'StrangerChat is operating normally.',
      maxMessageLength: settings.maxMessageLength,
    });
  });

  // 5. Admin Authentication & API Routes
  app.use('/api/admin', adminRouter);

  const server = http.createServer(app);

  // Initialize WebSocket Server on path /ws/chat
  chatWsServer.init(server);

  // Development vs Production static asset handling
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler (Hides internal stack traces in production)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Production Server Error]:', err.message || err);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[StrangerChat Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[StrangerChat WS] WebSocket endpoint active at /ws/chat`);
  });

  // Graceful Shutdown Handlers
  const gracefulShutdown = (signal: string) => {
    console.log(`[StrangerChat Server] Signal ${signal} received. Initiating graceful shutdown...`);
    chatWsServer.shutdown();
    server.close(() => {
      console.log('[StrangerChat Server] HTTP and WebSocket server stopped cleanly.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[StrangerChat Server] Forced shutdown after timeout.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]:', reason);
});

startServer().catch((err) => {
  console.error('[Server Error] Failed to start server:', err);
});
