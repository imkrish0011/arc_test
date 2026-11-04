import { Router, type Request, type Response } from 'express';
import { TelemetryCoordinator } from '../collector/telemetryCoordinator.js';
import { incidentStore } from '../store/incidentStore.js';
import { handoffToGargiEngine } from '../handoff/gargiConnector.js';
import type { EventBridgeCloudWatchAlarmEvent, SNSNotificationWrapper, ManualAlarmTriggerRequest } from '../types/aws.js';

export const webhookRouter = Router();

/**
 * POST /api/webhooks/aws-alarm
 * Listens for incoming AWS EventBridge / CloudWatch Alarm events or manual trigger requests
 */
webhookRouter.post('/aws-alarm', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    let source: 'eventbridge' | 'cloudwatch' | 'manual' | 'simulated' = 'manual';
    let alarmName = 'AlarmTrigger';
    let awsResourceId = 'unknown-resource';
    let metricName = 'CustomMetric';
    let metricValue = 100;
    let threshold = 50;
    let scenario: any = undefined;

    // 1. AWS SNS Notification Handling
    if (body.Type === 'SubscriptionConfirmation') {
      console.log(`[Webhook] AWS SNS Subscription Confirmation received for Topic: ${body.TopicArn}`);
      res.status(200).json({ status: 'SubscriptionConfirmationAcknowledged', topicArn: body.TopicArn });
      return;
    }

    if (body.Type === 'Notification' && body.Message) {
      source = 'cloudwatch';
      try {
        const parsedMessage = JSON.parse(body.Message);
        alarmName = parsedMessage.AlarmName || alarmName;
        awsResourceId = parsedMessage.Trigger?.Dimensions?.[0]?.value || parsedMessage.NewStateReason || awsResourceId;
        metricName = parsedMessage.Trigger?.MetricName || metricName;
        threshold = parsedMessage.Trigger?.Threshold ?? threshold;
      } catch {
        alarmName = body.Subject || 'SNS-CloudWatch-Alarm';
      }
    }
    // 2. AWS EventBridge CloudWatch Alarm Event
    else if (body.source === 'aws.cloudwatch' && body['detail-type'] === 'CloudWatch Alarm State Change') {
      const ebEvent = body as EventBridgeCloudWatchAlarmEvent;
      source = 'eventbridge';
      alarmName = ebEvent.detail?.alarmName || 'EventBridge-Alarm';
      awsResourceId = ebEvent.resources?.[0] || 'aws-cloudwatch-resource';
      const metricStat = ebEvent.detail?.configuration?.metrics?.[0]?.metricStat;
      metricName = metricStat?.metric?.name || 'AlarmMetric';
    }
    // 3. Direct Manual Trigger
    else if (body.scenario) {
      source = 'simulated';
      scenario = body.scenario;
      alarmName = `Scenario-${scenario}`;
    } else {
      alarmName = body.alarmName || alarmName;
      awsResourceId = body.awsResourceId || awsResourceId;
      metricName = body.metricName || metricName;
      metricValue = body.metricValue ?? metricValue;
      threshold = body.threshold ?? threshold;
    }

    // Ingest and coordinate telemetry from user's AWS account
    const alertPayload = await TelemetryCoordinator.collectTelemetry({
      alarmName,
      awsResourceId,
      metricName,
      metricValue,
      threshold,
      scenario,
      userCredentials: body.userCredentials || body.credentials,
      canvasGraph: body.canvasGraph,
    });

    // Save incident to store
    const incident = incidentStore.saveIncident(alertPayload, source, alarmName);

    // Auto-handoff to Gargi's engine by default for live alarms or if requested
    let handoffResult = undefined;
    const shouldHandoff =
      req.query.autoHandoff === 'true' ||
      body.autoHandoff === true ||
      source === 'cloudwatch' ||
      source === 'eventbridge';

    if (shouldHandoff && body.autoHandoff !== false) {
      handoffResult = await handoffToGargiEngine(alertPayload);
      incidentStore.updateHandoffStatus(alertPayload.incidentId, handoffResult);
    }

    res.status(201).json({
      success: true,
      incidentId: alertPayload.incidentId,
      triggeredAt: alertPayload.triggeredAt,
      source,
      alarmCount: alertPayload.activeAlarms.length,
      filteredLogsCount: alertPayload.cloudWatchLogs30m.length,
      cloudTrailEventsCount: alertPayload.cloudTrailEvents60m.length,
      canvasNodesCount: alertPayload.canvasGraph.nodes.length,
      payload: alertPayload,
      handoffResult,
    });
  } catch (err: unknown) {
    console.error('[Webhook] Ingestion error:', err);
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});
