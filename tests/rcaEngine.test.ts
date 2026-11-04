import { describe, it, expect } from 'vitest';
import { SampleOutageGenerator } from '../src/generator/sampleOutageGenerator.js';
import { runAutomatedRcaPipeline } from '../src/engine/agentExecutionEngine.js';

describe("Gargi's Diagnostic RCA Engine (End-to-End)", () => {
  it('should diagnose RDS Bottleneck, pinpoint node-rds-01 and UPGRADE_RDS_INSTANCE fix intent', async () => {
    const payload = SampleOutageGenerator.generate('rds_bottleneck');
    const report = await runAutomatedRcaPipeline(payload);

    expect(report.incidentId).toBe(payload.incidentId);
    expect(report.failingNodeId).toBe('node-rds-01');
    expect(report.scenarioType).toBe('rds_bottleneck');
    expect(report.recommendedFixIntent).toContain('UPGRADE_RDS_INSTANCE');
    expect(report.confidenceScore).toBeGreaterThanOrEqual(0.8);
    // 2 alarms were on node-rds-01 (CPU & Conn), 2 cascading on other nodes (lambda, apigw)
    expect(report.deduplicationAnalysis.cascadingAlarmsCount).toBe(2);
    expect(report.logEvidenceLine).toContain('remaining connection slots are reserved');
  });

  it('should diagnose Container CrashLoop, pinpoint node-ecs-01 and INCREASE_CONTAINER_MEMORY fix intent', async () => {
    const payload = SampleOutageGenerator.generate('container_crashloop');
    const report = await runAutomatedRcaPipeline(payload);

    expect(report.failingNodeId).toBe('node-ecs-01');
    expect(report.scenarioType).toBe('container_crashloop');
    expect(report.recommendedFixIntent).toContain('INCREASE_CONTAINER_MEMORY');
    expect(report.confidenceScore).toBeGreaterThanOrEqual(0.7);
    expect(report.deduplicationAnalysis.cascadingAlarmsCount).toBe(1);
    expect(report.logEvidenceLine).toContain('Exit Code 137');
  });

  it('should diagnose Security Group Drift, pinpoint node-sg-01 and REVOKE_PUBLIC_INGRESS_RULE fix intent', async () => {
    const payload = SampleOutageGenerator.generate('security_group_drift');
    const report = await runAutomatedRcaPipeline(payload);

    expect(report.failingNodeId).toBe('node-sg-01');
    expect(report.scenarioType).toBe('security_group_drift');
    expect(report.recommendedFixIntent).toContain('REVOKE_PUBLIC_INGRESS_RULE');
    expect(report.confidenceScore).toBeGreaterThanOrEqual(0.75);
    expect(report.targetParameters).toHaveProperty('correlatedCloudTrailEvent', 'AuthorizeSecurityGroupIngress');
  });

  it('should diagnose API 5xx Timeouts, pinpoint node-lambda-02 and INCREASE_LAMBDA_TIMEOUT fix intent', async () => {
    const payload = SampleOutageGenerator.generate('api_5xx_timeouts');
    const report = await runAutomatedRcaPipeline(payload);

    expect(report.failingNodeId).toBe('node-lambda-02');
    expect(report.scenarioType).toBe('api_5xx_timeouts');
    expect(report.recommendedFixIntent).toContain('INCREASE_LAMBDA_TIMEOUT');
    expect(report.confidenceScore).toBeGreaterThanOrEqual(0.7);
    expect(report.logEvidenceLine).toContain('Task timed out after 3.00 seconds');
  });

  it('should diagnose FinOps Idle Waste, pinpoint unattached resource and SNAPSHOT_AND_DELETE_EBS fix intent', async () => {
    const payload = SampleOutageGenerator.generate('finops_idle_waste');
    const report = await runAutomatedRcaPipeline(payload);

    expect(report.scenarioType).toBe('finops_idle_waste');
    expect(report.recommendedFixIntent).toContain('SNAPSHOT_AND_DELETE_EBS');
    expect(report.confidenceScore).toBeGreaterThanOrEqual(0.7);
  });
});
