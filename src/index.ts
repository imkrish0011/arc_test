import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { webhookRouter } from './api/webhooks.js';
import { handoffRouter } from './api/handoffRoutes.js';
import { scenarioRouter } from './api/scenarioRoutes.js';
import { liveAwsRouter } from './api/liveAwsRoutes.js';
import { AwsCredentialManager } from './aws/credentials.js';

// Export domain types and functions for direct programmatic usage
export * from './types/alertPayload.js';
export * from './types/canvasGraph.js';
export * from './aws/credentials.js';
export * from './aws/clientManager.js';
export * from './handoff/gargiConnector.js';
export * from './handoff/webhookDispatcher.js';
export * from './collector/logFilter.js';
export * from './collector/cloudWatchCollector.js';
export * from './collector/cloudTrailCollector.js';
export * from './collector/telemetryCoordinator.js';
export * from './generator/sampleOutageGenerator.js';
export * from './store/incidentStore.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use('/api/webhooks', webhookRouter);
  app.use('/api/handoff', handoffRouter);
  app.use('/api/scenarios', scenarioRouter);
  app.use('/api/aws', liveAwsRouter);

  // Status & Health Check
  app.get('/api/health', (_req, res) => {
    const credStatus = AwsCredentialManager.getStatus();
    res.json({
      status: 'healthy',
      service: 'arch-automation-telemetry',
      version: '1.0.0',
      uptime: process.uptime(),
      credentials: credStatus,
      timestamp: new Date().toISOString(),
    });
  });

  // Serve Dark-Mode Log & Payload Inspector UI
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));

  // SPA fallback
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

// Start standalone server when executed directly
const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test') {
  const app = createServer();
  app.listen(PORT, () => {
    const credStatus = AwsCredentialManager.getStatus();
    console.log(`\n=============================================================`);
    console.log(`🚀 ArchAutomation Telemetry & Handoff Pipeline Service`);
    console.log(`📡 Server listening on: http://localhost:${PORT}`);
    console.log(`📊 Dark-Mode Dashboard: http://localhost:${PORT}`);
    console.log(`⚡ Webhook Endpoint:    http://localhost:${PORT}/api/webhooks/aws-alarm`);
    console.log(`🤝 Handoff Incidents:   http://localhost:${PORT}/api/handoff/incidents`);
    console.log(`☁️ AWS Mode:            ${credStatus.isSimulated ? 'Simulated (Offline Safe)' : credStatus.source}`);
    console.log(`=============================================================\n`);
  });
}
