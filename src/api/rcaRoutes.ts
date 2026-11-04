import { Router, type Request, type Response } from 'express';
import { incidentStore } from '../store/incidentStore.js';
import { runAutomatedRcaPipeline } from '../engine/agentExecutionEngine.js';
import { RagRetriever } from '../engine/ragRetriever.js';
import type { AlertPayload } from '../types/alertPayload.js';

export const rcaRouter = Router();

/**
 * POST /api/rca/diagnose
 * Diagnoses an incident by ID or custom payload using Gargi's engine
 */
rcaRouter.post('/diagnose', async (req: Request, res: Response): Promise<void> => {
  try {
    const { incidentId, payload } = req.body;
    let alertPayload: AlertPayload | undefined;

    if (payload) {
      alertPayload = payload as AlertPayload;
    } else if (incidentId) {
      const rec = incidentStore.getIncident(incidentId);
      if (!rec) {
        res.status(404).json({ error: `Incident '${incidentId}' not found` });
        return;
      }
      alertPayload = rec.payload;
    } else {
      const latest = incidentStore.getLatestIncident();
      if (!latest) {
        res.status(400).json({ error: 'No incidents available' });
        return;
      }
      alertPayload = latest.payload;
    }

    const report = await runAutomatedRcaPipeline(alertPayload);
    res.json({
      success: true,
      report,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

/**
 * GET /api/rca/runbooks
 * Returns all available runbooks in Gargi's knowledge base
 */
rcaRouter.get('/runbooks', (_req: Request, res: Response): void => {
  const runbooks = RagRetriever.loadRunbooks();
  res.json({
    total: runbooks.length,
    runbooks: runbooks.map(rb => ({
      id: rb.id,
      title: rb.title,
      scenario: rb.scenario,
      targetService: rb.targetService,
      fixIntent: rb.fixIntent,
      patternsCount: rb.patterns.length,
    })),
  });
});

/**
 * POST /api/rca/chat
 * Interactive Q&A Assistant querying active incident context (Task 4)
 */
rcaRouter.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { question, incidentId } = req.body;
    if (!question) {
      res.status(400).json({ error: 'Missing question in request body' });
      return;
    }

    const incident = incidentId
      ? incidentStore.getIncident(incidentId)
      : incidentStore.getLatestIncident();

    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }

    const payload = incident.payload;
    const report = await runAutomatedRcaPipeline(payload);

    // Simple deterministic Q&A synthesis using retrieved telemetry & report
    const q = question.toLowerCase();
    let answer = '';

    if (q.includes('why') || q.includes('cause') || q.includes('what happened')) {
      answer = `Based on the RCA traversal, the root cause is: ${report.rootCauseSummary}\n\nKey evidence identified:\n- Failing Resource: ${report.awsResourceId} (${report.failingNodeId})\n- Log Evidence: "${report.logEvidenceLine}"\n- Confidence Score: ${(report.confidenceScore * 100).toFixed(0)}%`;
    } else if (q.includes('fix') || q.includes('remediat') || q.includes('sweta') || q.includes('terraform')) {
      answer = `Recommended Fix Intent: ${report.recommendedFixIntent}.\nTarget parameters passed to Sweta: ${JSON.stringify(report.targetParameters, null, 2)}`;
    } else if (q.includes('alarm') || q.includes('cascade') || q.includes('alert')) {
      answer = `Alert Deduplication collapsed ${report.deduplicationAnalysis.cascadingAlarmsCount} cascading alerts into root node "${report.failingNodeId}".\nPropagation path: ${report.deduplicationAnalysis.cascadePath.join(' ➔ ')}`;
    } else if (q.includes('log') || q.includes('cloudwatch')) {
      const topLogs = payload.cloudWatchLogs30m.slice(0, 3).map(l => `[${l.level}] ${l.message}`).join('\n');
      answer = `Recent critical logs for this incident:\n${topLogs}`;
    } else if (q.includes('cloudtrail') || q.includes('who') || q.includes('change')) {
      const trail = payload.cloudTrailEvents60m[0];
      answer = trail
        ? `CloudTrail mutation detected: Event "${trail.eventName}" triggered by "${trail.userIdentity}" at ${trail.eventTime}.`
        : 'No correlated CloudTrail mutation events found in the 60-minute window.';
    } else {
      answer = `Incident ${report.incidentId} diagnosed as "${report.scenarioType}". Root node: ${report.failingNodeId}. Suggested Fix: ${report.recommendedFixIntent}. You can ask about root cause, logs, CloudTrail changes, or remediation fix intent.`;
    }

    res.json({
      success: true,
      question,
      answer,
      context: {
        incidentId: report.incidentId,
        failingNodeId: report.failingNodeId,
        confidenceScore: report.confidenceScore,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

