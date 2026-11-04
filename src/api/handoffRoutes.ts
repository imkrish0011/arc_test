import { Router, type Request, type Response } from 'express';
import { incidentStore } from '../store/incidentStore.js';
import { handoffToGargiEngine, validateAlertPayloadContract } from '../handoff/gargiConnector.js';
import { WebhookDispatcher } from '../handoff/webhookDispatcher.js';
import type { AlertPayload } from '../types/alertPayload.js';

export const handoffRouter = Router();

/**
 * GET /api/handoff/incidents
 * Returns list of incidents available for handoff
 */
handoffRouter.get('/incidents', (_req: Request, res: Response): void => {
  const incidents = incidentStore.getAllIncidents().map(inc => ({
    incidentId: inc.incidentId,
    scenarioName: inc.scenarioName,
    source: inc.source,
    createdAt: inc.createdAt,
    activeAlarmsCount: inc.payload.activeAlarms.length,
    filteredLogsCount: inc.payload.cloudWatchLogs30m.length,
    cloudTrailEventsCount: inc.payload.cloudTrailEvents60m.length,
    canvasNodesCount: inc.payload.canvasGraph.nodes.length,
    handoffStatus: inc.handoffStatus?.diagnosticStatus || 'not_dispatched',
    lastDeliveredAt: inc.handoffStatus?.deliveredAt,
  }));

  res.json({
    total: incidents.length,
    incidents,
  });
});

/**
 * GET /api/handoff/incidents/:id
 * Serves the full alertPayload JSON so Gargi's service can pull and inspect it
 */
handoffRouter.get('/incidents/:id', (req: Request, res: Response): void => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const incident = incidentStore.getIncident(id);

  if (!incident) {
    res.status(404).json({
      error: `Incident '${id}' not found`,
    });
    return;
  }

  // Set Content-Disposition if requested as attachment
  if (req.query.download === 'true') {
    res.setHeader('Content-Disposition', `attachment; filename="alertPayload-${id}.json"`);
  }

  res.json(incident.payload);
});

/**
 * POST /api/handoff/dispatch
 * Transfers the alertPayload to Gargi's Diagnostic RCA Engine
 * Body options:
 * - incidentId: string (to dispatch an existing incident)
 * - payload: AlertPayload (to dispatch an arbitrary payload directly)
 * - webhookUrl?: string (optional override for REST webhook dispatch)
 */
handoffRouter.post('/dispatch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { incidentId, payload: rawPayload, webhookUrl } = req.body;

    let alertPayload: AlertPayload;
    if (incidentId) {
      const incident = incidentStore.getIncident(incidentId);
      if (!incident) {
        res.status(404).json({ error: `Incident '${incidentId}' not found` });
        return;
      }
      alertPayload = incident.payload;
    } else if (rawPayload) {
      alertPayload = rawPayload;
    } else {
      const latest = incidentStore.getLatestIncident();
      if (!latest) {
        res.status(400).json({ error: 'No incidents available to dispatch' });
        return;
      }
      alertPayload = latest.payload;
    }

    // Verify contract
    const validation = validateAlertPayloadContract(alertPayload);
    if (!validation.valid) {
      res.status(422).json({
        error: 'AlertPayload failed schema contract validation',
        details: validation.errors,
      });
      return;
    }

    // 1. If explicit webhookUrl provided in request
    if (webhookUrl) {
      const dispatchResult = await WebhookDispatcher.dispatch(alertPayload, webhookUrl);
      const handoffResult = {
        success: dispatchResult.success,
        incidentId: alertPayload.incidentId,
        deliveredAt: new Date().toISOString(),
        target: `Custom Webhook (${webhookUrl})`,
        response: dispatchResult.response as Record<string, unknown>,
        diagnosticStatus: (dispatchResult.success ? 'analyzing' : 'failed') as 'analyzing' | 'failed',
        error: dispatchResult.error,
      };

      incidentStore.updateHandoffStatus(alertPayload.incidentId, handoffResult);
      res.json({
        success: dispatchResult.success,
        dispatchType: 'REST_WEBHOOK',
        targetUrl: webhookUrl,
        handoffResult,
      });
      return;
    }

    // 2. Direct Function Handoff via handoffToGargiEngine
    const handoffResult = await handoffToGargiEngine(alertPayload);
    incidentStore.updateHandoffStatus(alertPayload.incidentId, handoffResult);

    res.json({
      success: handoffResult.success,
      dispatchType: 'DIRECT_FUNCTION',
      target: handoffResult.target,
      handoffResult,
    });
  } catch (err: unknown) {
    console.error('[Handoff] Dispatch error:', err);
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});
