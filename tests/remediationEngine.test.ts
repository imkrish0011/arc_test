import { describe, it, expect } from 'vitest';
import { SampleOutageGenerator } from '../src/generator/sampleOutageGenerator.js';
import { runAutomatedRcaPipeline } from '../src/engine/agentExecutionEngine.js';
import { synthesizeRemediationPackage } from '../src/remediation/solutionEngine.js';
import { PolicyAsCodeEngine } from '../src/remediation/policyAsCodeEngine.js';
import type { GeneratedPatch } from '../src/remediation/autoRemediation.js';

describe("Sweta's Remediation, Simulation & Safety Engine (Handoff 3)", () => {
  it('Scenario 1: should synthesize a verified fix for RDS Bottleneck (UPGRADE_RDS_INSTANCE)', async () => {
    // 1. Krish: Ingests outage
    const alertPayload = SampleOutageGenerator.generate('rds_bottleneck');
    // 2. Gargi: Diagnoses root cause
    const rcaReport = await runAutomatedRcaPipeline(alertPayload);
    // 3. Sweta: Synthesizes verified remediation package
    const fixPackage = await synthesizeRemediationPackage(rcaReport);

    expect(fixPackage.incidentId).toBe(rcaReport.incidentId);
    expect(fixPackage.guardrailStatus).toBe('PASSED_VERIFIED');
    expect(fixPackage.safetyGateDetails.gate1SyntaxPassed).toBe(true);
    expect(fixPackage.safetyGateDetails.gate2DestructionFirewallPassed).toBe(true);
    expect(fixPackage.safetyGateDetails.gate3SecurityBudgetPassed).toBe(true);

    // Verify Terraform diff
    expect(fixPackage.terraformDiff).toContain('instance_class = "db.r6g.xlarge"');

    // Verify AWS SDK command
    expect(fixPackage.awsSdkAction.service).toBe('rds');
    expect(fixPackage.awsSdkAction.command).toBe('ModifyDBInstanceCommand');
    expect(fixPackage.awsSdkAction.parameters).toHaveProperty('ApplyImmediately', true);

    // Verify Simulation: CPU drops below 45%
    expect(fixPackage.simulationResult.metricName).toBe('CPUUtilization');
    expect(fixPackage.simulationResult.afterValue).toBeLessThanOrEqual(45.0);
    expect(fixPackage.simulationResult.predictedRecoveryStatus).toBe('HEALTHY');

    // Verify Cost: +$64.80/mo
    expect(fixPackage.costImpactMonthly.formattedDelta).toBe('+$64.80/mo');
    expect(fixPackage.rollbackSnapshotConfig).toBeDefined();
  });

  it('Scenario 2: should synthesize a verified fix for Container CrashLoop (INCREASE_CONTAINER_MEMORY)', async () => {
    const alertPayload = SampleOutageGenerator.generate('container_crashloop');
    const rcaReport = await runAutomatedRcaPipeline(alertPayload);
    const fixPackage = await synthesizeRemediationPackage(rcaReport);

    expect(fixPackage.guardrailStatus).toBe('PASSED_VERIFIED');
    expect(fixPackage.terraformDiff).toContain('memory = "1024"');
    expect(fixPackage.awsSdkAction.command).toBe('UpdateServiceCommand');
    expect(fixPackage.simulationResult.predictedRecoveryStatus).toBe('HEALTHY');
    expect(fixPackage.costImpactMonthly.formattedDelta).toBe('+$13.50/mo');
  });

  it('Scenario 3: should synthesize a verified fix for Security Group Drift (REVOKE_PUBLIC_INGRESS_RULE)', async () => {
    const alertPayload = SampleOutageGenerator.generate('security_group_drift');
    const rcaReport = await runAutomatedRcaPipeline(alertPayload);
    const fixPackage = await synthesizeRemediationPackage(rcaReport);

    expect(fixPackage.guardrailStatus).toBe('PASSED_VERIFIED');
    expect(fixPackage.terraformDiff).toContain('cidr_blocks = ["10.0.0.0/16"]');
    expect(fixPackage.awsSdkAction.command).toBe('RevokeSecurityGroupIngressCommand');
    expect(fixPackage.simulationResult.predictedRecoveryStatus).toBe('HEALTHY');
    expect(fixPackage.costImpactMonthly.formattedDelta).toBe('+$0.00/mo');
  });

  it('Scenario 4: should synthesize a verified fix for API 5xx Timeouts (INCREASE_LAMBDA_TIMEOUT)', async () => {
    const alertPayload = SampleOutageGenerator.generate('api_5xx_timeouts');
    const rcaReport = await runAutomatedRcaPipeline(alertPayload);
    const fixPackage = await synthesizeRemediationPackage(rcaReport);

    expect(fixPackage.guardrailStatus).toBe('PASSED_VERIFIED');
    expect(fixPackage.terraformDiff).toContain('timeout = 15');
    expect(fixPackage.awsSdkAction.command).toBe('UpdateFunctionConfigurationCommand');
    expect(fixPackage.simulationResult.afterValue).toBe(0.0);
    expect(fixPackage.simulationResult.predictedRecoveryStatus).toBe('HEALTHY');
  });

  it('Scenario 5: should synthesize a verified fix for FinOps Idle Waste (SNAPSHOT_AND_DELETE_EBS)', async () => {
    const alertPayload = SampleOutageGenerator.generate('finops_idle_waste');
    const rcaReport = await runAutomatedRcaPipeline(alertPayload);
    const fixPackage = await synthesizeRemediationPackage(rcaReport);

    expect(fixPackage.guardrailStatus).toBe('PASSED_VERIFIED');
    expect(fixPackage.awsSdkAction.command).toBe('DeleteVolumeCommand');
    expect(fixPackage.rollbackSnapshotConfig?.action).toBe('CreateSnapshotCommand');
    expect(fixPackage.costImpactMonthly.deltaUsd).toBeLessThan(0); // Monthly savings!
  });

  describe('3-Gate Deterministic Safety Inspector Rules', () => {
    it('Gate 2: should BLOCK any patch containing destructive operations (e.g. DeleteDBInstance)', () => {
      const maliciousPatch: GeneratedPatch = {
        terraformDiff: 'resource "aws_db_instance" "primary" {}',
        awsSdkAction: {
          service: 'rds',
          command: 'DeleteDBInstance',
          parameters: { DBInstanceIdentifier: 'prod-db' },
        },
      };

      const result = PolicyAsCodeEngine.inspectPatch(maliciousPatch);
      expect(result.guardrailStatus).toBe('BLOCKED_DESTRUCTIVE_OP');
      expect(result.safetyGateDetails.gate2DestructionFirewallPassed).toBe(false);
      expect(result.safetyGateDetails.rejectionReason).toContain('Destructive AWS command detected');
    });

    it('Gate 3: should REJECT patches opening sensitive ports to 0.0.0.0/0', () => {
      const insecurePatch: GeneratedPatch = {
        terraformDiff: '+\tcidr_blocks = ["0.0.0.0/0"]',
        awsSdkAction: {
          service: 'ec2',
          command: 'AuthorizeSecurityGroupIngressCommand',
          parameters: {},
        },
      };

      const result = PolicyAsCodeEngine.inspectPatch(insecurePatch);
      expect(result.guardrailStatus).toBe('SECURITY_VIOLATION');
      expect(result.safetyGateDetails.gate3SecurityBudgetPassed).toBe(false);
      expect(result.safetyGateDetails.rejectionReason).toContain('0.0.0.0/0');
    });

    it('Gate 3: should REJECT patches that exceed maximum allowed monthly budget delta (>$150/mo)', () => {
      const expensivePatch: GeneratedPatch = {
        terraformDiff: 'resource "aws_db_instance" "primary" {}',
        awsSdkAction: {
          service: 'rds',
          command: 'ModifyDBInstanceCommand',
          parameters: {},
        },
      };

      const result = PolicyAsCodeEngine.inspectPatch(expensivePatch, 350, 150);
      expect(result.guardrailStatus).toBe('SECURITY_VIOLATION');
      expect(result.safetyGateDetails.gate3SecurityBudgetPassed).toBe(false);
      expect(result.safetyGateDetails.rejectionReason).toContain('exceeds maximum allowed budget');
    });
  });
});

