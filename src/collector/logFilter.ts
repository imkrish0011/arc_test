import type { CloudWatchLogEntry, LogLevel } from '../types/alertPayload.js';

export interface RawLogLine {
  timestamp?: number | string;
  message: string;
}

const NOISE_PATTERNS = [
  /\[INFO\]/i,
  /\bINFO\b/,
  /\bDEBUG\b/i,
  /\bTRACE\b/i,
  /GET \/health(check)? 200/i,
  /HTTP\/1\.[01] 200 OK/i,
  /Heartbeat ACK/i,
  /Keep-Alive probe received/i,
  /Metrics flushed successfully/i,
];

const ERROR_PATTERNS = [
  { level: 'FATAL' as LogLevel, regex: /\b(FATAL|CRITICAL|PANIC|EMERGENCY)\b|remaining connection slots are reserved/i },
  { level: 'TIMEOUT' as LogLevel, regex: /\b(TIMEOUT|TIMED OUT|ETIMEDOUT|ESOCKETTIMEDOUT|Task timed out|Gateway Time-out|504 Gateway)\b/i },
  { level: 'ERROR' as LogLevel, regex: /\b(ERROR|FAIL|FAILED|FAILURE|Exception|CrashLoopBackOff|Exit Code 137|OutOfMemoryError|OOM|ECONNREFUSED|ENOTFOUND)\b/i },
  { level: 'WARN' as LogLevel, regex: /\b(WARN|WARNING|HighLatency|ThresholdExceeded|Degraded|ApproachingLimit)\b/i },
];

/**
 * Strips noisy INFO/DEBUG lines and classifies matching error lines
 * into 'ERROR' | 'FATAL' | 'WARN' | 'TIMEOUT'.
 */
export function filterAndClassifyLogs(
  rawLogs: RawLogLine[],
  nodeId: string,
  awsResourceId: string
): CloudWatchLogEntry[] {
  const filtered: CloudWatchLogEntry[] = [];

  for (const raw of rawLogs) {
    const msg = (raw.message || '').trim();
    if (!msg) continue;

    // 1. Pre-filter noisy INFO lines (unless they contain an explicit error/fatal/timeout substring)
    const isExplicitError = ERROR_PATTERNS.some(p => p.regex.test(msg));
    const isNoisy = NOISE_PATTERNS.some(p => p.test(msg));

    if (isNoisy && !isExplicitError) {
      continue;
    }

    // 2. Classify log level
    let matchedLevel: LogLevel | null = null;
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.regex.test(msg)) {
        matchedLevel = pattern.level;
        break;
      }
    }

    // Only retain lines that match an error/fatal/warn/timeout pattern
    if (matchedLevel) {
      const ts = typeof raw.timestamp === 'number'
        ? new Date(raw.timestamp).toISOString()
        : raw.timestamp ? new Date(raw.timestamp).toISOString() : new Date().toISOString();

      filtered.push({
        timestamp: ts,
        nodeId,
        awsResourceId,
        level: matchedLevel,
        message: msg,
      });
    }
  }

  return filtered;
}
