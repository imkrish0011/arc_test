/**
 * AlertPayload Data Contract (Handoff 1)
 * 
 * Strict boundary interface between Krish's AWS Telemetry Ingestion Pipeline
 * and Gargi's Diagnostic & Root-Cause Analysis (RCA) Engine.
 */

export interface ActiveAlarm {
  alarmId: string;
  alarmName: string;
  nodeId: string;          // Node ID in the ArchViz canvas
  awsResourceId: string;   // AWS ARN or Resource ID
  metricName: string;
  metricValue: number;
  threshold: number;
  timestamp: string;
}

export type LogLevel = 'ERROR' | 'FATAL' | 'WARN' | 'TIMEOUT';

export interface CloudWatchLogEntry {
  timestamp: string;
  nodeId: string;
  awsResourceId: string;
  level: LogLevel;
  message: string;
}

export interface CloudTrailEventEntry {
  eventId: string;
  eventTime: string;
  eventName: string;
  awsResourceId: string;
  userIdentity: string;
  requestParameters: Record<string, unknown>;
}

export interface CanvasGraphNode {
  id: string;
  type: string;
  awsResourceId: string;
  data: Record<string, unknown>;
}

export interface CanvasGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface CanvasGraph {
  nodes: CanvasGraphNode[];
  edges: CanvasGraphEdge[];
}

export interface AlertPayload {
  incidentId: string;
  triggeredAt: string;
  activeAlarms: ActiveAlarm[];
  cloudWatchLogs30m: CloudWatchLogEntry[];
  cloudTrailEvents60m: CloudTrailEventEntry[];
  canvasGraph: CanvasGraph;
}

export interface HandoffResult {
  success: boolean;
  incidentId: string;
  deliveredAt: string;
  target: string;
  response?: Record<string, unknown>;
  diagnosticStatus?: 'pending_rca' | 'analyzing' | 'completed' | 'failed';
  error?: string;
}
