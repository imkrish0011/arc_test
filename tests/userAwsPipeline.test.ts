import { describe, it, expect, vi } from 'vitest';
import {
  collectUserAwsTelemetry,
  collectUserAwsTelemetryAndHandoff,
  TelemetryCoordinator,
} from '../src/collector/telemetryCoordinator.js';
import { CloudWatchCollector } from '../src/collector/cloudWatchCollector.js';
import { CloudTrailCollector } from '../src/collector/cloudTrailCollector.js';
import { AwsCredentialManager, type AwsUserCredentials } from '../src/aws/credentials.js';
import { validateAlertPayloadContract, registerGargiEngine } from '../src/handoff/gargiConnector.js';

describe('User AWS Telemetry & Handoff Pipeline (Krish -> Gargi)', () => {
  it('should resolve dynamic per-user credentials correctly', async () => {
    const userCreds: AwsUserCredentials = {
      accessKeyId: 'AKIA_USER_TEST_KEY_123',
      secretAccessKey: 'SECRET_TEST_KEY_456',
      region: 'us-west-2',
    };

    const resolved = await AwsCredentialManager.resolveCredentials(userCreds);
    expect(resolved.accessKeyId).toBe('AKIA_USER_TEST_KEY_123');
    expect(resolved.region).toBe('us-west-2');
    expect(resolved.source).toBe('direct');
  });

  it('should deduce candidate log groups for any AWS resource ARN', async () => {
    // Mock client to return candidate prefixes
    const mockClient: any = {
      send: vi.fn().mockImplementation(async (cmd: any) => {
        if (cmd.input?.logGroupNamePrefix?.includes('OrderProcessingService')) {
          return { logGroups: [{ logGroupName: '/aws/lambda/OrderProcessingService' }] };
        }
        return { logGroups: [] };
      }),
    };

    const groups = await CloudWatchCollector.discoverLogGroups(
      mockClient,
      'arn:aws:lambda:us-east-1:123456789012:function:OrderProcessingService'
    );

    expect(groups).toContain('/aws/lambda/OrderProcessingService');
  });

  it('should execute end-to-end telemetry collection for user AWS account', async () => {
    const alertPayload = await collectUserAwsTelemetry({
      awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-orders-primary',
      alarmName: 'HighCPU-RDS-Order',
      metricName: 'CPUUtilization',
      metricValue: 94.2,
      threshold: 90.0,
      logMinutes: 30,
      trailMinutes: 60,
    });

    // Validate against Handoff 1 contract
    const validation = validateAlertPayloadContract(alertPayload);
    expect(validation.valid).toBe(true);

    // Verify 4 data sources
    expect(alertPayload.activeAlarms.length).toBeGreaterThanOrEqual(1);
    expect(alertPayload.cloudWatchLogs30m).toBeDefined();
    expect(alertPayload.cloudTrailEvents60m).toBeDefined();
    expect(alertPayload.canvasGraph.nodes.length).toBeGreaterThan(0);
    expect(alertPayload.canvasGraph.edges.length).toBeGreaterThan(0);
  });

  it('should deliver collected telemetry directly to Gargi engine entry hook', async () => {
    const mockGargiRcaEngine = vi.fn().mockResolvedValue({
      status: 'rca_complete',
      rootFailingNodeId: 'node-rds-01',
      confidenceScore: 0.95,
      recommendedFixIntent: 'UPGRADE_RDS_INSTANCE',
    });

    registerGargiEngine(mockGargiRcaEngine);

    const { alertPayload, handoffResult } = await collectUserAwsTelemetryAndHandoff({
      awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-orders-primary',
      alarmName: 'RDS-Connection-Spike',
      metricName: 'DatabaseConnections',
      metricValue: 495,
      threshold: 450,
    });

    expect(mockGargiRcaEngine).toHaveBeenCalledWith(alertPayload);
    expect(handoffResult.success).toBe(true);
    expect(handoffResult.diagnosticStatus).toBe('analyzing');
    expect(handoffResult.response).toHaveProperty('rootFailingNodeId', 'node-rds-01');

    registerGargiEngine(null as any);
  });
});
