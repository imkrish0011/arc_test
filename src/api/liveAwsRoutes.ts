import { Router, type Request, type Response } from 'express';
import { AwsCredentialManager } from '../aws/credentials.js';
import { discoverAwsTopology } from '../aws/resourceDiscovery.js';
import { TelemetryCoordinator } from '../collector/telemetryCoordinator.js';
import { incidentStore } from '../store/incidentStore.js';

export const liveAwsRouter = Router();

liveAwsRouter.get('/status', (_req: Request, res: Response): void => {
  const status = AwsCredentialManager.getStatus();
  res.json({
    status,
    timestamp: new Date().toISOString(),
  });
});

liveAwsRouter.post('/scan-topology', async (_req: Request, res: Response): Promise<void> => {
  try {
    const topology = await discoverAwsTopology();
    res.json({
      success: true,
      topology,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

liveAwsRouter.post('/live-collect', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      awsResourceId,
      alarmName,
      metricName,
      metricValue,
      threshold,
      userCredentials,
      credentials,
      canvasGraph,
    } = req.body;

    const alertPayload = await TelemetryCoordinator.collectTelemetry({
      awsResourceId,
      alarmName: alarmName || 'Live-Resource-Alarm',
      metricName: metricName || 'CustomLiveMetric',
      metricValue: metricValue ?? 100,
      threshold: threshold ?? 80,
      userCredentials: userCredentials || credentials,
      canvasGraph,
    });

    const incident = incidentStore.saveIncident(
      alertPayload,
      'cloudwatch',
      `Live: ${awsResourceId || 'AWS Resource'}`
    );

    res.json({
      success: true,
      incidentId: incident.incidentId,
      payload: alertPayload,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});
