import { describe, it, expect } from 'vitest';
import { SampleOutageGenerator, type ScenarioType } from '../src/generator/sampleOutageGenerator.js';
import { validateAlertPayloadContract } from '../src/handoff/gargiConnector.js';

describe('AlertPayload Handoff Contract (Handoff 1)', () => {
  const scenarios: ScenarioType[] = [
    'rds_bottleneck',
    'container_crashloop',
    'security_group_drift',
    'api_5xx_timeouts',
    'finops_idle_waste',
  ];

  scenarios.forEach(scenario => {
    it(`should strictly satisfy AlertPayload schema for scenario: ${scenario}`, () => {
      const payload = SampleOutageGenerator.generate(scenario);
      const validation = validateAlertPayloadContract(payload);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Verify essential contract properties
      expect(payload.incidentId).toBeDefined();
      expect(typeof payload.incidentId).toBe('string');
      expect(payload.triggeredAt).toBeDefined();
      expect(new Date(payload.triggeredAt).toString()).not.toBe('Invalid Date');

      // Verify active alarms
      expect(Array.isArray(payload.activeAlarms)).toBe(true);
      expect(payload.activeAlarms.length).toBeGreaterThan(0);
      payload.activeAlarms.forEach(alarm => {
        expect(alarm.alarmId).toBeDefined();
        expect(alarm.alarmName).toBeDefined();
        expect(alarm.nodeId).toBeDefined();
        expect(alarm.awsResourceId).toBeDefined();
        expect(typeof alarm.metricValue).toBe('number');
        expect(typeof alarm.threshold).toBe('number');
        expect(alarm.timestamp).toBeDefined();
      });

      // Verify 30m CloudWatch logs
      expect(Array.isArray(payload.cloudWatchLogs30m)).toBe(true);
      expect(payload.cloudWatchLogs30m.length).toBeGreaterThan(0);
      const validLevels = ['ERROR', 'FATAL', 'WARN', 'TIMEOUT'];
      payload.cloudWatchLogs30m.forEach(log => {
        expect(log.timestamp).toBeDefined();
        expect(log.nodeId).toBeDefined();
        expect(log.awsResourceId).toBeDefined();
        expect(validLevels).toContain(log.level);
        expect(typeof log.message).toBe('string');
        expect(log.message.length).toBeGreaterThan(0);
      });

      // Verify 60m CloudTrail events
      expect(Array.isArray(payload.cloudTrailEvents60m)).toBe(true);
      expect(payload.cloudTrailEvents60m.length).toBeGreaterThan(0);
      payload.cloudTrailEvents60m.forEach(evt => {
        expect(evt.eventId).toBeDefined();
        expect(evt.eventTime).toBeDefined();
        expect(evt.eventName).toBeDefined();
        expect(evt.awsResourceId).toBeDefined();
        expect(evt.userIdentity).toBeDefined();
        expect(typeof evt.requestParameters).toBe('object');
      });

      // Verify ArchViz canvas graph
      expect(payload.canvasGraph).toBeDefined();
      expect(Array.isArray(payload.canvasGraph.nodes)).toBe(true);
      expect(Array.isArray(payload.canvasGraph.edges)).toBe(true);
      expect(payload.canvasGraph.nodes.length).toBeGreaterThan(0);

      payload.canvasGraph.nodes.forEach(node => {
        expect(node.id).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.awsResourceId).toBeDefined();
        expect(typeof node.data).toBe('object');
      });

      payload.canvasGraph.edges.forEach(edge => {
        expect(edge.id).toBeDefined();
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
      });
    });
  });

  it('should reject malformed payloads missing mandatory contract fields', () => {
    const malformed: any = {
      incidentId: 'test',
      // missing triggeredAt, activeAlarms, etc.
    };

    const validation = validateAlertPayloadContract(malformed);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
