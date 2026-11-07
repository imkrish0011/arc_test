import { describe, it, expect } from 'vitest';
import { SampleOutageGenerator } from '../src/generator/sampleOutageGenerator.js';
import { runAutomatedRcaPipeline } from '../src/engine/agentExecutionEngine.js';
import { synthesizeRemediationPackage } from '../src/remediation/solutionEngine.js';
import { RemediationExecutor } from '../src/remediation/remediationExecutor.js';
import { VerificationLoop } from '../src/remediation/verificationLoop.js';
import { GitHubPrGenerator } from '../src/remediation/githubPrGenerator.js';
import { SlackCardFormatter } from '../src/remediation/slackCardFormatter.js';
import { TenantContextManager } from '../src/store/tenantContext.js';

describe('Production Readiness Implementation: The 5 Final Capabilities', () => {
  // --------------------------------------------------------------------------
  // Item 1: Live AWS Execution Endpoint & Pre-Snapshot Rollback
  // --------------------------------------------------------------------------
  it('Item 1: RemediationExecutor applies verified fix and captures safety snapshot', async () => {
    const alertPayload = SampleOutageGenerator.generate('rds_bottleneck');
    const rcaReport = await runAutomatedRcaPipeline(alertPayload);
    const fixPackage = await synthesizeRemediationPackage(rcaReport);

    const execResult = await RemediationExecutor.executeFix({
      incidentId: rcaReport.incidentId,
      fixPackage,
      dryRun: true,
    });

    expect(execResult.status).toBe('APPLIED_SIMULATED');
    expect(execResult.service).toBe('rds');
    expect(execResult.command).toBe('ModifyDBInstanceCommand');
    expect(execResult.snapshotCreated).toBeDefined();
    expect(execResult.snapshotCreated?.action).toBe('CreateDBSnapshotCommand');
    expect(execResult.durationMs).toBeGreaterThan(0);
  });

  it('Item 1 (Safety): RemediationExecutor blocks execution if guardrail status is not PASSED_VERIFIED', async () => {
    const alertPayload = SampleOutageGenerator.generate('rds_bottleneck');
    const rcaReport = await runAutomatedRcaPipeline(alertPayload);
    const fixPackage = await synthesizeRemediationPackage(rcaReport);

    // Tamper with guardrail
    const tampered = {
      ...fixPackage,
      guardrailStatus: 'SECURITY_VIOLATION' as const,
      safetyGateDetails: {
        ...fixPackage.safetyGateDetails,
        gate3SecurityBudgetPassed: false,
        rejectionReason: 'Exposing sensitive infrastructure to 0.0.0.0/0 is forbidden',
      },
    };

    const blockedResult = await RemediationExecutor.executeFix({
      incidentId: rcaReport.incidentId,
      fixPackage: tampered,
    });

    expect(blockedResult.status).toBe('BLOCKED_BY_GUARDRAIL');
    expect(blockedResult.details).toContain('Execution aborted');
  });

  // --------------------------------------------------------------------------
  // Item 2: Post-Remediation Verification Loop (ALARM -> OK)
  // --------------------------------------------------------------------------
  it('Item 2: VerificationLoop verifies telemetry recovery and marks incident RESOLVED', async () => {
    const alertPayload = SampleOutageGenerator.generate('container_crashloop');
    const rcaReport = await runAutomatedRcaPipeline(alertPayload);

    const report = await VerificationLoop.verifyOutcome({
      incidentId: rcaReport.incidentId,
      awsResourceId: rcaReport.awsResourceId,
      metricName: 'ContainerCrashCount',
      threshold: 3,
    });

    expect(report.verified).toBe(true);
    expect(report.alarmState).toBe('OK');
    expect(report.incidentStatus).toBe('RESOLVED');
    expect(report.errorLogCountLast5m).toBe(0);
    expect(report.currentMetricValue).toBeLessThanOrEqual(3);
    expect(report.verificationSummary).toContain('Incident autonomously resolved');
  });

  // --------------------------------------------------------------------------
  // Item 3: Mode A GitHub Pull Request Generator
  // --------------------------------------------------------------------------
  it('Item 3: GitHubPrGenerator constructs full GitOps Pull Request with Markdown review body', async () => {
    const alertPayload = SampleOutageGenerator.generate('security_group_drift');
    const rcaReport = await runAutomatedRcaPipeline(alertPayload);
    const fixPackage = await synthesizeRemediationPackage(rcaReport);

    const pr = await GitHubPrGenerator.createPr({
      incidentId: rcaReport.incidentId,
      fixPackage,
      repoOwner: 'imkrish0011',
      repoName: 'archviz',
    });

    expect(pr.branchName).toBe(`fix/autonomous-${rcaReport.incidentId}`);
    expect(pr.prUrl).toContain('https://github.com/imkrish0011/archviz/pull/');
    expect(pr.markdownBody).toContain('ArchViz Autonomous Incident Remediation');
    expect(pr.markdownBody).toContain('```diff');
    expect(pr.markdownBody).toContain('3-Gate Deterministic Safety Verification');
  });

  // --------------------------------------------------------------------------
  // Item 4: Slack Block Kit Interactive Approval Card
  // --------------------------------------------------------------------------
  it('Item 4: SlackCardFormatter generates Block Kit card with interactive approval buttons', async () => {
    const alertPayload = SampleOutageGenerator.generate('api_5xx_timeouts');
    const rcaReport = await runAutomatedRcaPipeline(alertPayload);
    const fixPackage = await synthesizeRemediationPackage(rcaReport);

    const card = SlackCardFormatter.formatApprovalCard(rcaReport, fixPackage);

    expect(card.blocks.length).toBeGreaterThanOrEqual(6);
    expect(card.text).toContain(rcaReport.incidentId);

    // Verify Action buttons in block
    const actionBlock = card.blocks.find(b => b.type === 'actions') as any;
    expect(actionBlock).toBeDefined();
    const actionIds = actionBlock.elements.map((e: any) => e.action_id);
    expect(actionIds).toContain('approve_autonomous_fix');
    expect(actionIds).toContain('create_github_pr');
    expect(actionIds).toContain('escalate_incident');
  });

  // --------------------------------------------------------------------------
  // Item 5: Multi-Tenant & Project Isolation Mapping
  // --------------------------------------------------------------------------
  it('Item 5: TenantContextManager scopes architectures by tenantId and projectId', () => {
    const defaultTenant = TenantContextManager.getTenant('tenant-default');
    expect(defaultTenant.tenantId).toBe('tenant-default');
    expect(defaultTenant.projectId).toBe('project-ecommerce-prod');

    const fintechTenant = TenantContextManager.getTenant('tenant-fintech');
    expect(fintechTenant.awsAccountId).toBe('987654321098');

    const allTenants = TenantContextManager.listTenants();
    expect(allTenants.length).toBeGreaterThanOrEqual(2);
  });
});
