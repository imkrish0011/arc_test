import type { ActiveAlarm, CloudWatchLogEntry, CloudTrailEventEntry } from '../types/alertPayload.js';
import type { RagMatchResult } from './ragRetriever.js';

export interface ConfidenceScoreBreakdown {
  score: number; // Final score from 0.0 to 1.0 (or 0 to 100%)
  signals: {
    exactErrorCodeLogMatch: number; // max 0.40
    recentCloudTrailChange: number; // max 0.25
    resourceMetricOver90: number;   // max 0.20
    runbookSimilarity: number;       // max 0.15
  };
  details: {
    matchedErrorCode?: string;
    correlatedEventName?: string;
    peakMetricValue?: number;
    runbookId?: string;
  };
}

/**
 * Gargi's Task 3: Mathematical Confidence Scoring
 * 
 * Strict formula based on Section 3:
 * - 40% if an exact error code is matched in CloudWatch logs
 * - 25% if a CloudTrail change occurred shortly before the alarm
 * - 20% if a resource metric crossed 90%+
 * - 15% based on runbook similarity
 */
export function calculateRcaConfidence(
  rootAlarm: ActiveAlarm,
  rootLogs: CloudWatchLogEntry[],
  trailEvents: CloudTrailEventEntry[],
  ragMatch?: RagMatchResult
): ConfidenceScoreBreakdown {
  let logScore = 0;
  let trailScore = 0;
  let metricScore = 0;
  let runbookScore = 0;

  const details: ConfidenceScoreBreakdown['details'] = {};

  // 1. Exact error code in CloudWatch logs (40%)
  const exactErrorRegex = /(FATAL|Exit Code 137|OutOfMemoryError|Timeout|Task timed out|504|Gateway Timeout|Unauthorized|brute-force|remaining connection slots|Cost Anomaly|Trusted Advisor|unattached|available)/i;
  const errorLog = rootLogs.find(l => exactErrorRegex.test(l.message));
  if (errorLog) {
    logScore = 0.40;
    const match = errorLog.message.match(exactErrorRegex);
    details.matchedErrorCode = match ? match[0] : 'ERROR_PATTERN';
  } else if (rootLogs.length > 0) {
    logScore = 0.20; // partial if logs exist but generic
  }

  // 2. Correlated CloudTrail change shortly before the alarm (25%)
  if (trailEvents.length > 0) {
    const alarmTime = new Date(rootAlarm.timestamp).getTime();
    // Look for mutations within 60 minutes prior to alarm
    const priorEvent = trailEvents.find(e => {
      const eTime = new Date(e.eventTime).getTime();
      return eTime <= alarmTime && (alarmTime - eTime) <= 60 * 60 * 1000;
    }) || trailEvents[0];

    if (priorEvent) {
      trailScore = 0.25;
      details.correlatedEventName = priorEvent.eventName;
    }
  }

  // 3. Resource metric crossed 90%+ (20%)
  details.peakMetricValue = rootAlarm.metricValue;
  if (rootAlarm.metricValue >= 90) {
    metricScore = 0.20;
  } else if (rootAlarm.metricName === 'ComplianceType' && rootAlarm.metricValue === 1) {
    // AWS Config non-compliant flag
    metricScore = 0.20;
  } else if (rootAlarm.metricName === 'VolumeTotalReadWriteOps' && rootAlarm.metricValue === 0) {
    // 0 IOPS waste condition
    metricScore = 0.20;
  } else if (rootAlarm.metricName === 'BytesOutToDestination' && rootAlarm.metricValue === 0) {
    metricScore = 0.20;
  } else if (rootAlarm.threshold > 0 && rootAlarm.metricValue >= rootAlarm.threshold) {
    metricScore = 0.15; // Threshold crossed
  }

  // 4. Runbook similarity score (15%)
  if (ragMatch && ragMatch.score > 0) {
    runbookScore = Math.min(0.15, Number((ragMatch.score * 0.15).toFixed(3)));
    details.runbookId = ragMatch.runbook.id;
  }

  const totalScore = Number((logScore + trailScore + metricScore + runbookScore).toFixed(2));

  return {
    score: totalScore,
    signals: {
      exactErrorCodeLogMatch: logScore,
      recentCloudTrailChange: trailScore,
      resourceMetricOver90: metricScore,
      runbookSimilarity: runbookScore,
    },
    details,
  };
}
