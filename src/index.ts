import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { webhookRouter } from './api/webhooks.js';
import { handoffRouter } from './api/handoffRoutes.js';
import { scenarioRouter } from './api/scenarioRoutes.js';
import { liveAwsRouter } from './api/liveAwsRoutes.js';
import { rcaRouter } from './api/rcaRoutes.js';
import { remediationRouter } from './api/remediationRoutes.js';
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
export * from './engine/buildDependencyGraph.js';
export * from './engine/ragRetriever.js';
export * from './engine/confidenceScorer.js';
export {
  AgentExecutionEngine,
  type DiagnosisReport,
} from './engine/agentExecutionEngine.js';
export * from './remediation/types.js';
export * from './remediation/autoRemediation.js';
export * from './remediation/policyAsCodeEngine.js';
export * from './remediation/simulator.js';
export {
  SolutionEngine,
  synthesizeRemediationPackage,
} from './remediation/solutionEngine.js';
export * from './remediation/remediationExecutor.js';
export * from './remediation/verificationLoop.js';
export * from './remediation/githubPrGenerator.js';
export * from './remediation/slackCardFormatter.js';
export * from './store/tenantContext.js';

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
  app.use('/api/rca', rcaRouter);
  app.use('/api/remediation', remediationRouter);

  // Status & Health Check
  app.get('/api/health', (_req, res) => {
    const credStatus = AwsCredentialManager.getStatus();
    res.json({
      status: 'healthy',
      service: 'arch-automation-telemetry',
      timestamp: new Date().toISOString(),
      awsIntegration: {
        configured: credStatus.hasCredentials,
        source: credStatus.source,
        region: credStatus.region,
      },
    });
  });

  // Serve Dark-Mode Dashboard Static UI
  const publicDir = path.resolve(__dirname, 'public');
  app.use(express.static(publicDir));

  // Fallback to index.html for SPA
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

export function startServer(port = process.env.PORT || 4000) {
  const app = createServer();
  const server = app.listen(port, () => {
    console.log(`\n🚀 ArchAutomation Service Running on http://localhost:${port}`);
    console.log(`   - UI Inspector:          http://localhost:${port}`);
    console.log(`   - Ingestion Webhook:     POST http://localhost:${port}/api/webhooks/aws-alarm`);
    console.log(`   - Gargi RCA Diagnose:    POST http://localhost:${port}/api/rca/diagnose`);
    console.log(`   - Interactive Incident Q&A: POST http://localhost:${port}/api/rca/chat`);
    console.log(`   - Health Status:         GET  http://localhost:${port}/api/health\n`);
  });
  return server;
}

// Auto-start if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
