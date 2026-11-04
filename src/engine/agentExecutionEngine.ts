import type { AlertPayload } from '../types/alertPayload.js';
import { findRootFailingNode, type RootFailureAnalysis } from './buildDependencyGraph.js';
import { RagRetriever, type RagMatchResult } from './ragRetriever.js';
import { calculateRcaConfidence, type ConfidenceScoreBreakdown } from './confidenceScorer.js';

/**
 * Handoff 2 Data Contract: What Gargi's Engine Sends to Sweta
 * As strictly specified in Section 7 of the AI Engineering Manual.
 */
export interface DiagnosisReport {
  incidentId: string;
  failingNodeId: string;
  awsResourceId: string;
  scenarioType: string;
  confidenceScore: number; // 0.0 to 1.0
  rootCauseSummary: string;
  logEvidenceLine: string;
  recommendedFixIntent: string;
  targetParameters: Record<string, unknown>;
  confidenceBreakdown: ConfidenceScoreBreakdown['signals'];
  deduplicationAnalysis: {
    cascadingAlarmsCount: number;
    cascadePath: string[];
  };
  diagnosedAt: string;
}

/**
 * Gargi's Diagnostic & Root-Cause Analysis (RCA) Orchestrator
 * Implements `runAutomatedRcaPipeline(alertPayload)`
 */
export class AgentExecutionEngine {
  public static async runAutomatedRcaPipeline(alertPayload: AlertPayload): Promise<DiagnosisReport> {
    const diagnosedAt = new Date().toISOString();

    // 1. Task 1 — Graph-Based Alert Deduplication
    const rootAnalysis: RootFailureAnalysis = findRootFailingNode(
      alertPayload.activeAlarms,
      alertPayload.canvasGraph
    );

    const rootNode = alertPayload.canvasGraph.nodes.find(
      n => n.id === rootAnalysis.rootFailingNodeId
    );
    const rootResourceId = rootNode?.awsResourceId || rootAnalysis.rootAlarm.awsResourceId;

    // 2. Task 2 — Log, CloudTrail & Runbook Search via RAG
    const ragResults: RagMatchResult[] = RagRetriever.query(
      alertPayload.cloudWatchLogs30m,
      alertPayload.cloudTrailEvents60m,
      rootAnalysis.rootFailingNodeId
    );

    const bestRagMatch = ragResults.length > 0 ? ragResults[0] : undefined;

    // Filter root node error logs for confidence calculation
    const rootLogs = alertPayload.cloudWatchLogs30m.filter(
      l => l.nodeId === rootAnalysis.rootFailingNodeId || l.awsResourceId === rootResourceId
    );

    // 3. Task 3 — Mathematical Confidence Scoring
    const confidence = calculateRcaConfidence(
      rootAnalysis.rootAlarm,
      rootLogs.length > 0 ? rootLogs : alertPayload.cloudWatchLogs30m,
      alertPayload.cloudTrailEvents60m,
      bestRagMatch
    );

    // 4. Formulate Handoff 2 Target Parameters based on matched intent
    const scenarioType = bestRagMatch?.runbook.scenario || 'unknown_incident';
    const recommendedFixIntent = bestRagMatch?.runbook.fixIntent || 'INSPECT_AND_REMEDIATE';

    // Problem context passed to Sweta (strictly problem parameters, not solutions)
    const targetParameters: Record<string, unknown> = {
      failingNodeId: rootAnalysis.rootFailingNodeId,
      awsResourceId: rootResourceId,
      nodeType: rootNode?.type || 'unknown',
      metricName: rootAnalysis.rootAlarm.metricName,
      metricValue: rootAnalysis.rootAlarm.metricValue,
      threshold: rootAnalysis.rootAlarm.threshold,
    };

    // Include CloudTrail mutation params if present as factual evidence of recent change
    const recentTrail = alertPayload.cloudTrailEvents60m[0];
    if (recentTrail) {
      targetParameters.correlatedCloudTrailEvent = recentTrail.eventName;
      targetParameters.recentMutationParams = recentTrail.requestParameters;
    }

    const logEvidenceLine =
      bestRagMatch?.keyEvidenceLine ||
      rootLogs[0]?.message ||
      alertPayload.cloudWatchLogs30m[0]?.message ||
      'No specific error line matched';

    const rootCauseDetail = bestRagMatch?.runbook.rootCauses?.[0]
      ? ` Primary cause: ${bestRagMatch.runbook.rootCauses[0]}`
      : '';

    const rootCauseSummary = bestRagMatch
      ? `Root cause identified as ${bestRagMatch.runbook.title}.${rootCauseDetail} ${rootAnalysis.cascadingAlarms.length} cascading alerts collapsed to ${rootAnalysis.rootFailingNodeId}.`
      : `Anomalous behavior detected on resource ${rootResourceId} crossing threshold (${rootAnalysis.rootAlarm.metricName}: ${rootAnalysis.rootAlarm.metricValue}).`;

    return {
      incidentId: alertPayload.incidentId,
      failingNodeId: rootAnalysis.rootFailingNodeId,
      awsResourceId: rootResourceId,
      scenarioType,
      confidenceScore: confidence.score,
      rootCauseSummary,
      logEvidenceLine,
      recommendedFixIntent,
      targetParameters,
      confidenceBreakdown: confidence.signals,
      deduplicationAnalysis: {
        cascadingAlarmsCount: rootAnalysis.cascadingAlarms.length,
        cascadePath: rootAnalysis.cascadePath,
      },
      diagnosedAt,
    };
  }
}

/**
 * Direct function export as specified in Section 3 & 7
 */
export async function runAutomatedRcaPipeline(alertPayload: AlertPayload): Promise<DiagnosisReport> {
  return AgentExecutionEngine.runAutomatedRcaPipeline(alertPayload);
}

