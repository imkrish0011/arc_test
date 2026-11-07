/**
 * Handoff 2 & Handoff 3 Data Contracts for Sweta's Remediation, Simulation & Safety Engine
 * As specified in the ArchViz Autonomous Engineering Specification (Sections 5, 6, 7).
 */

import type { ScenarioType } from '../generator/sampleOutageGenerator.js';

/**
 * The 5 supported fix intents emitted by Gargi's RCA Diagnostic Engine
 */
export type FixIntent =
  | 'UPGRADE_RDS_INSTANCE'
  | 'INCREASE_CONTAINER_MEMORY'
  | 'REVOKE_PUBLIC_INGRESS_RULE'
  | 'INCREASE_LAMBDA_TIMEOUT'
  | 'SNAPSHOT_AND_DELETE_EBS';

/**
 * Handoff 2 Input: What Gargi's Diagnostic Engine passes to Sweta
 */
export interface DiagnosisReport {
  incidentId: string;
  failingNodeId: string;
  awsResourceId: string;
  scenarioType: ScenarioType | string;
  confidenceScore: number; // 0.0 to 1.0
  rootCauseSummary: string;
  logEvidenceLine: string;
  recommendedFixIntent: FixIntent | string;
  targetParameters: Record<string, unknown>;
  confidenceBreakdown?: {
    exactErrorCodeLogMatch: number;
    recentCloudTrailChange: number;
    resourceMetricOver90: number;
    runbookSimilarity: number;
  };
  deduplicationAnalysis?: {
    cascadingAlarmsCount: number;
    cascadePath: string[];
  };
  diagnosedAt: string;
}

/**
 * Decision status of the 3-Gate Deterministic Safety Inspector
 */
export type GuardrailStatus =
  | 'PASSED_VERIFIED'
  | 'BLOCKED_DESTRUCTIVE_OP'
  | 'SECURITY_VIOLATION';

/**
 * Detailed breakdown of each safety gate check
 */
export interface SafetyGateDetails {
  gate1SyntaxPassed: boolean;
  gate2DestructionFirewallPassed: boolean;
  gate3SecurityBudgetPassed: boolean;
  rejectionReason?: string;
  blockedOperations?: string[];
  violatingRules?: string[];
}

/**
 * Executable AWS SDK command payload for 1-click immediate remediation
 */
export interface AwsSdkAction {
  service: 'rds' | 'ecs' | 'ec2' | 'lambda' | string;
  command: string;
  parameters: Record<string, unknown>;
}

/**
 * Pre-flight simulation outcome showing metric recovery
 */
export interface SimulationResult {
  metricName: string;
  beforeValue: number;
  afterValue: number;
  unit: string;
  threshold: number;
  predictedRecoveryStatus: 'HEALTHY' | 'DEGRADED';
  simulationNotes: string;
}

/**
 * Financial cost impact calculation (+/- $/month)
 */
export interface CostImpactMonthly {
  deltaUsd: number;
  formattedDelta: string; // e.g. "+$64.80/mo" or "-$45.00/mo"
  oldCostUsd: number;
  newCostUsd: number;
}

/**
 * Rollback parameters in case the applied fix needs to be reverted
 */
export interface RollbackSnapshotConfig {
  action: string;
  description: string;
  params: Record<string, unknown>;
}

/**
 * Handoff 3 Output: What Sweta's Remediation Engine produces for Krish
 * Rendered on Slack & ArchViz Web UI with [Approve & Apply Fix] button
 */
export interface VerifiedFixPackage {
  incidentId: string;
  guardrailStatus: GuardrailStatus;
  safetyGateDetails: SafetyGateDetails;
  terraformDiff: string;
  awsSdkAction: AwsSdkAction;
  simulationResult: SimulationResult;
  costImpactMonthly: CostImpactMonthly;
  rollbackSnapshotConfig?: RollbackSnapshotConfig;
  generatedAt: string;
}

