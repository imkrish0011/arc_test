import { describe, it, expect } from 'vitest';
import { filterAndClassifyLogs, type RawLogLine } from '../src/collector/logFilter.js';

describe('CloudWatch Log Pre-Filter & Level Classifier', () => {
  it('should strip noisy INFO, DEBUG, healthcheck and heartbeat lines', () => {
    const rawLogs: RawLogLine[] = [
      { timestamp: Date.now(), message: '2026-11-04 [INFO] Application started listening on port 8080' },
      { timestamp: Date.now(), message: 'GET /health 200 OK - 1.2ms' },
      { timestamp: Date.now(), message: 'DEBUG: Connection pool allocated slot 14' },
      { timestamp: Date.now(), message: 'Keep-Alive probe received from 10.0.1.20' },
      { timestamp: Date.now(), message: 'Metrics flushed successfully' },
      { timestamp: Date.now(), message: 'FATAL: remaining connection slots are reserved for non-replication superuser connections' },
    ];

    const filtered = filterAndClassifyLogs(rawLogs, 'node-db-01', 'arn:aws:rds:db:pg-prod');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].level).toBe('FATAL');
    expect(filtered[0].message).toContain('remaining connection slots are reserved');
    expect(filtered[0].nodeId).toBe('node-db-01');
    expect(filtered[0].awsResourceId).toBe('arn:aws:rds:db:pg-prod');
  });

  it('should accurately categorize FATAL, ERROR, TIMEOUT, and WARN', () => {
    const rawLogs: RawLogLine[] = [
      { timestamp: Date.now(), message: 'WARN: Connection pool utilization above 85%' },
      { timestamp: Date.now(), message: 'ERROR: Exit Code 137 (OutOfMemoryError) triggered by kernel' },
      { timestamp: Date.now(), message: 'CRITICAL: Database primary node in panic state' },
      { timestamp: Date.now(), message: 'Task timed out after 3.00 seconds while invoking downstream' },
    ];

    const filtered = filterAndClassifyLogs(rawLogs, 'node-app-01', 'i-123456');

    expect(filtered).toHaveLength(4);
    expect(filtered[0].level).toBe('WARN');
    expect(filtered[1].level).toBe('ERROR');
    expect(filtered[2].level).toBe('FATAL');
    expect(filtered[3].level).toBe('TIMEOUT');
  });

  it('should preserve errors even if line contains info token', () => {
    const rawLogs: RawLogLine[] = [
      { timestamp: Date.now(), message: '[INFO] Encountered unexpected ERROR in order pipeline' },
    ];

    const filtered = filterAndClassifyLogs(rawLogs, 'node-app-01', 'i-123456');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].level).toBe('ERROR');
  });
});
