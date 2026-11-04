import { describe, it, expect } from 'vitest';
import { SampleOutageGenerator } from '../src/generator/sampleOutageGenerator.js';

describe('Sample Outage Generator: 5 Target Scenarios', () => {
  it('1. RDS Database Bottleneck scenario should contain database saturation and fatal connection log', () => {
    const payload = SampleOutageGenerator.generate('rds_bottleneck');

    // Check CPU or Connection alarms
    const hasDbAlarm = payload.activeAlarms.some(
      a => (a.metricName === 'CPUUtilization' && a.metricValue > 90) ||
           (a.metricName === 'DatabaseConnections' && a.metricValue > 400)
    );
    expect(hasDbAlarm).toBe(true);

    // Check cascading alarms
    const hasCascading = payload.activeAlarms.some(a => a.nodeId === 'node-lambda-01' || a.nodeId === 'node-apigw-01');
    expect(hasCascading).toBe(true);

    // Check fatal connection log
    const fatalLog = payload.cloudWatchLogs30m.find(l => l.level === 'FATAL');
    expect(fatalLog).toBeDefined();
    expect(fatalLog?.message).toContain('FATAL: remaining connection slots are reserved');

    // Check CloudTrail parameter modification
    const trail = payload.cloudTrailEvents60m.find(e => e.eventName === 'ModifyDBParameterGroup');
    expect(trail).toBeDefined();
    expect(trail?.requestParameters).toBeDefined();
  });

  it('2. ECS/EKS Container CrashLoop scenario should contain task stop count, Exit Code 137 and TaskDef event', () => {
    const payload = SampleOutageGenerator.generate('container_crashloop');

    // Check CrashCount alarm
    const crashAlarm = payload.activeAlarms.find(a => a.metricName === 'ContainerCrashCount');
    expect(crashAlarm).toBeDefined();
    expect(crashAlarm!.metricValue).toBeGreaterThan(3);

    // Check Exit Code 137 in logs
    const oomLog = payload.cloudWatchLogs30m.find(l => l.message.includes('Exit Code 137 (OutOfMemoryError)'));
    expect(oomLog).toBeDefined();
    expect(oomLog!.level).toBe('ERROR');

    // Check CloudTrail RegisterTaskDefinition
    const trail = payload.cloudTrailEvents60m.find(e => e.eventName === 'RegisterTaskDefinition');
    expect(trail).toBeDefined();
    expect((trail?.requestParameters as any)?.memory).toBe('512');
  });

  it('3. Security Group Drift scenario should contain open port 22/5432 to 0.0.0.0/0', () => {
    const payload = SampleOutageGenerator.generate('security_group_drift');

    // Check compliance or portscan alarm
    expect(payload.activeAlarms.length).toBeGreaterThanOrEqual(1);

    // Check CloudTrail AuthorizeSecurityGroupIngress
    const ingressEvt = payload.cloudTrailEvents60m.find(e => e.eventName === 'AuthorizeSecurityGroupIngress');
    expect(ingressEvt).toBeDefined();
    const permissions = (ingressEvt?.requestParameters as any)?.ipPermissions;
    expect(Array.isArray(permissions)).toBe(true);

    const has0000 = permissions.some((p: any) =>
      p.ipRanges?.some((r: any) => r.cidrIp === '0.0.0.0/0') && (p.fromPort === 22 || p.fromPort === 5432)
    );
    expect(has0000).toBe(true);
  });

  it('4. API 5xx Timeouts scenario should contain 3000ms response time and Lambda 3s timeout log', () => {
    const payload = SampleOutageGenerator.generate('api_5xx_timeouts');

    // Check response time or 5xx alarm
    const respTimeAlarm = payload.activeAlarms.find(a => a.metricName === 'TargetResponseTime');
    expect(respTimeAlarm).toBeDefined();
    expect(respTimeAlarm!.metricValue).toBeGreaterThan(3000);

    // Check Lambda timeout log
    const timeoutLog = payload.cloudWatchLogs30m.find(l => l.level === 'TIMEOUT');
    expect(timeoutLog).toBeDefined();
    expect(timeoutLog?.message).toContain('Task timed out after 3.00 seconds');
  });

  it('5. FinOps Idle Waste scenario should contain 0 IOPS or 0 bytes NAT and unattached available EBS', () => {
    const payload = SampleOutageGenerator.generate('finops_idle_waste');

    // Check zero ops/bytes alarms
    const zeroAlarm = payload.activeAlarms.find(
      a => a.metricName === 'VolumeTotalReadWriteOps' || a.metricName === 'BytesOutToDestination'
    );
    expect(zeroAlarm).toBeDefined();
    expect(zeroAlarm!.metricValue).toBe(0);

    // Check EBS node status
    const ebsNode = payload.canvasGraph.nodes.find(n => n.type === 'ebs');
    expect(ebsNode).toBeDefined();
    expect(ebsNode?.data?.status).toBe('available');
    expect(ebsNode?.data?.activeIops7Days).toBe(0);
  });
});
