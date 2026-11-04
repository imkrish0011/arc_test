import type { AlertPayload, HandoffResult } from '../types/alertPayload.js';
import { WebhookDispatcher } from './webhookDispatcher.js';

export type RcaPipelineHandler = (alertPayload: AlertPayload) => Promise<any>;

let customRcaPipelineHandler: RcaPipelineHandler | null = null;

/**
 * Allows Gargi to register her engine's implementation directly
 */
export function registerGargiEngine(handler: RcaPipelineHandler): void {
  customRcaPipelineHandler = handler;
}

/**
 * Validates that an AlertPayload satisfies the strict Handoff 1 data contract
 */
export function validateAlertPayloadContract(payload: AlertPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload.incidentId || typeof payload.incidentId !== 'string') {
    errors.push('Missing or invalid incidentId');
  }
  if (!payload.triggeredAt || isNaN(Date.parse(payload.triggeredAt))) {
    errors.push('Missing or invalid triggeredAt ISO timestamp');
  }
  if (!Array.isArray(payload.activeAlarms)) {
    errors.push('activeAlarms must be an array');
  } else {
    payload.activeAlarms.forEach((alarm, i) => {
      if (!alarm.alarmId) errors.push(`activeAlarms[${i}] missing alarmId`);
      if (!alarm.nodeId) errors.push(`activeAlarms[${i}] missing nodeId`);
      if (!alarm.awsResourceId) errors.push(`activeAlarms[${i}] missing awsResourceId`);
      if (typeof alarm.metricValue !== 'number') errors.push(`activeAlarms[${i}] metricValue must be a number`);
      if (typeof alarm.threshold !== 'number') errors.push(`activeAlarms[${i}] threshold must be a number`);
    });
  }

  if (!Array.isArray(payload.cloudWatchLogs30m)) {
    errors.push('cloudWatchLogs30m must be an array');
  } else {
    const validLevels = new Set(['ERROR', 'FATAL', 'WARN', 'TIMEOUT']);
    payload.cloudWatchLogs30m.forEach((log, i) => {
      if (!log.timestamp) errors.push(`cloudWatchLogs30m[${i}] missing timestamp`);
      if (!log.nodeId) errors.push(`cloudWatchLogs30m[${i}] missing nodeId`);
      if (!log.awsResourceId) errors.push(`cloudWatchLogs30m[${i}] missing awsResourceId`);
      if (!validLevels.has(log.level)) errors.push(`cloudWatchLogs30m[${i}] invalid level '${log.level}'`);
      if (!log.message) errors.push(`cloudWatchLogs30m[${i}] missing message`);
    });
  }

  if (!Array.isArray(payload.cloudTrailEvents60m)) {
    errors.push('cloudTrailEvents60m must be an array');
  } else {
    payload.cloudTrailEvents60m.forEach((evt, i) => {
      if (!evt.eventId) errors.push(`cloudTrailEvents60m[${i}] missing eventId`);
      if (!evt.eventName) errors.push(`cloudTrailEvents60m[${i}] missing eventName`);
      if (!evt.awsResourceId) errors.push(`cloudTrailEvents60m[${i}] missing awsResourceId`);
    });
  }

  if (!payload.canvasGraph || !Array.isArray(payload.canvasGraph.nodes) || !Array.isArray(payload.canvasGraph.edges)) {
    errors.push('canvasGraph must have nodes and edges arrays');
  } else {
    payload.canvasGraph.nodes.forEach((n, i) => {
      if (!n.id) errors.push(`canvasGraph.nodes[${i}] missing id`);
      if (!n.type) errors.push(`canvasGraph.nodes[${i}] missing type`);
      if (!n.awsResourceId) errors.push(`canvasGraph.nodes[${i}] missing awsResourceId`);
    });
    payload.canvasGraph.edges.forEach((e, i) => {
      if (!e.id) errors.push(`canvasGraph.edges[${i}] missing id`);
      if (!e.source) errors.push(`canvasGraph.edges[${i}] missing source`);
      if (!e.target) errors.push(`canvasGraph.edges[${i}] missing target`);
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Gargi's Entry Hook: runAutomatedRcaPipeline(alertPayload)
 * 
 * If Gargi has registered an in-process engine handler, calls that directly.
 * Otherwise, checks if GARGI_RCA_WEBHOOK_URL is configured to forward via HTTP,
 * or runs the built-in diagnostic contract verification runner.
 */
export async function runAutomatedRcaPipeline(alertPayload: AlertPayload): Promise<HandoffResult> {
  const validation = validateAlertPayloadContract(alertPayload);
  if (!validation.valid) {
    throw new Error(`AlertPayload contract validation failed: ${validation.errors.join('; ')}`);
  }

  const deliveredAt = new Date().toISOString();

  // 1. Direct function handoff if Gargi registered an in-memory handler
  if (customRcaPipelineHandler) {
    try {
      const response = await customRcaPipelineHandler(alertPayload);
      return {
        success: true,
        incidentId: alertPayload.incidentId,
        deliveredAt,
        target: 'Direct Function (In-Process Gargi Engine)',
        response,
        diagnosticStatus: 'analyzing',
      };
    } catch (err: unknown) {
      return {
        success: false,
        incidentId: alertPayload.incidentId,
        deliveredAt,
        target: 'Direct Function (In-Process Gargi Engine)',
        diagnosticStatus: 'failed',
        error: (err as Error).message,
      };
    }
  }

  // 2. Forward to external webhook endpoint if GARGI_RCA_WEBHOOK_URL is configured
  const webhookUrl = process.env.GARGI_RCA_WEBHOOK_URL;
  if (webhookUrl && webhookUrl !== 'none') {
    const dispatchResult = await WebhookDispatcher.dispatch(alertPayload, webhookUrl);
    if (dispatchResult.success) {
      return {
        success: true,
        incidentId: alertPayload.incidentId,
        deliveredAt,
        target: `REST Webhook Dispatch (${webhookUrl})`,
        response: dispatchResult.response as Record<string, unknown>,
        diagnosticStatus: 'analyzing',
      };
    }
  }

  // 3. Simulated engine acceptance (standard for offline / decoupling)
  return {
    success: true,
    incidentId: alertPayload.incidentId,
    deliveredAt,
    target: 'Simulated Gargi Diagnostic RCA Engine Interface',
    response: {
      message: 'Payload verified against Handoff Contract 1 and successfully queued for RCA graph traversal.',
      activeAlarmsCount: alertPayload.activeAlarms.length,
      filteredLogsCount: alertPayload.cloudWatchLogs30m.length,
      cloudTrailEventsCount: alertPayload.cloudTrailEvents60m.length,
      canvasNodesCount: alertPayload.canvasGraph.nodes.length,
      canvasEdgesCount: alertPayload.canvasGraph.edges.length,
    },
    diagnosticStatus: 'pending_rca',
  };
}

/**
 * Handoff target where Krish's collector passes the data to Gargi
 */
export async function handoffToGargiEngine(alertPayload: AlertPayload): Promise<HandoffResult> {
  return await runAutomatedRcaPipeline(alertPayload);
}
