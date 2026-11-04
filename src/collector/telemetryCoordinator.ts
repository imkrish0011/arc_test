import type {
  AlertPayload,
  CanvasGraph,
  ActiveAlarm,
  HandoffResult,
} from '../types/alertPayload.js';
import { findNodeIdForResource } from '../types/canvasGraph.js';
import { CloudWatchCollector } from './cloudWatchCollector.js';
import { CloudTrailCollector } from './cloudTrailCollector.js';
import { discoverAwsTopology } from '../aws/resourceDiscovery.js';
import { AwsCredentialManager, type AwsUserCredentials } from '../aws/credentials.js';
import {
  SampleOutageGenerator,
  type ScenarioType,
} from '../generator/sampleOutageGenerator.js';
import { handoffToGargiEngine } from '../handoff/gargiConnector.js';

export interface TelemetryIngestOptions {
  userCredentials?: AwsUserCredentials;
  alarmName?: string;
  awsResourceId?: string;
  metricName?: string;
  metricValue?: number;
  threshold?: number;
  canvasGraph?: CanvasGraph;
  scenario?: ScenarioType;
  logMinutes?: number;   // default 30
  trailMinutes?: number; // default 60
}

export class TelemetryCoordinator {
  /**
   * Main backend ingestion pipeline:
   * Connects to user's AWS account, retrieves trailing 30m CloudWatch logs
   * and 60m CloudTrail events, correlates with ArchViz canvas graph,
   * and builds a compliant AlertPayload.
   */
  public static async collectTelemetry(
    options: TelemetryIngestOptions
  ): Promise<AlertPayload> {
    // 1. If an offline scenario is requested explicitly
    if (options.scenario) {
      return SampleOutageGenerator.generate(options.scenario);
    }

    const credStatus = AwsCredentialManager.getStatus(options.userCredentials);
    const triggeredAt = new Date().toISOString();
    const incidentId = `inc-aws-${Date.now().toString(36)}`;

    // 2. Resolve ArchViz Canvas Graph Topology
    let graph: CanvasGraph = options.canvasGraph || { nodes: [], edges: [] };
    if (!graph.nodes || graph.nodes.length === 0) {
      const discovery = await discoverAwsTopology();
      graph = discovery.canvasGraph;
    }

    // 3. Resolve affected AWS resource and correlate with ArchViz Canvas Node ID
    const resId =
      options.awsResourceId ||
      graph.nodes[0]?.awsResourceId ||
      'aws-resource-unknown';
    const nodeId = findNodeIdForResource(graph, resId);

    // 4. Construct Active AWS Alarm Details
    const activeAlarms: ActiveAlarm[] = [
      {
        alarmId: `alarm-${options.alarmName || 'custom'}-${Date.now()}`,
        alarmName: options.alarmName || 'CloudWatch-Alarm-Trigger',
        nodeId,
        awsResourceId: resId,
        metricName: options.metricName || 'HighErrorRate',
        metricValue: options.metricValue ?? 100,
        threshold: options.threshold ?? 50,
        timestamp: triggeredAt,
      },
    ];

    // If running without AWS credentials in simulated mode, provide realistic test data
    if (credStatus.isSimulated) {
      const fallback = SampleOutageGenerator.generate('rds_bottleneck', incidentId);
      return {
        ...fallback,
        incidentId,
        triggeredAt,
        activeAlarms: activeAlarms.concat(fallback.activeAlarms.slice(1)),
        canvasGraph: graph.nodes.length > 0 ? graph : fallback.canvasGraph,
      };
    }

    // 5. Query trailing 30-minute CloudWatch Logs from user's AWS account
    const logs30m = await CloudWatchCollector.collect30mLogs({
      awsResourceId: resId,
      nodeId,
      minutes: options.logMinutes || 30,
      userCredentials: options.userCredentials,
    });

    // 6. Query trailing 60-minute CloudTrail configuration mutations from user's AWS account
    const trailEvents60m = await CloudTrailCollector.collect60mEvents({
      awsResourceId: resId,
      minutes: options.trailMinutes || 60,
      userCredentials: options.userCredentials,
    });

    return {
      incidentId,
      triggeredAt,
      activeAlarms,
      cloudWatchLogs30m: logs30m,
      cloudTrailEvents60m: trailEvents60m,
      canvasGraph: graph,
    };
  }

  /**
   * End-to-end backend automation:
   * Collects telemetry from user's AWS account and immediately executes
   * handoff to Gargi's Diagnostic RCA Engine.
   */
  public static async collectAndHandoff(
    options: TelemetryIngestOptions
  ): Promise<{
    alertPayload: AlertPayload;
    handoffResult: HandoffResult;
  }> {
    const alertPayload = await this.collectTelemetry(options);
    const handoffResult = await handoffToGargiEngine(alertPayload);
    return { alertPayload, handoffResult };
  }
}

/**
 * Top-level programmatic helper functions for ArchViz backend integration:
 */
export async function collectUserAwsTelemetry(
  options: TelemetryIngestOptions
): Promise<AlertPayload> {
  return await TelemetryCoordinator.collectTelemetry(options);
}

export async function collectUserAwsTelemetryAndHandoff(
  options: TelemetryIngestOptions
): Promise<{
  alertPayload: AlertPayload;
  handoffResult: HandoffResult;
}> {
  return await TelemetryCoordinator.collectAndHandoff(options);
}
