import { Router, type Request, type Response } from 'express';
import { incidentStore } from '../store/incidentStore.js';
import { runAutomatedRcaPipeline } from '../engine/agentExecutionEngine.js';
import { synthesizeRemediationPackage } from '../remediation/solutionEngine.js';
import { PolicyAsCodeEngine } from '../remediation/policyAsCodeEngine.js';
import { RemediationExecutor } from '../remediation/remediationExecutor.js';
import { VerificationLoop } from '../remediation/verificationLoop.js';
import { GitHubPrGenerator } from '../remediation/githubPrGenerator.js';
import { SlackCardFormatter } from '../remediation/slackCardFormatter.js';
import { TenantContextManager } from '../store/tenantContext.js';
import type { DiagnosisReport, VerifiedFixPackage } from '../remediation/types.js';
import type { GeneratedPatch } from '../remediation/autoRemediation.js';

export const remediationRouter = Router();

/**
 * POST /api/remediation/synthesize
 * Runs Sweta's Remediation Engine on a DiagnosisReport or fetches by incidentId
 */
remediationRouter.post('/synthesize', async (req: Request, res: Response): Promise<void> => {
  try {
    const { incidentId, report: incomingReport } = req.body;
    let diagnosisReport: DiagnosisReport | undefined;

    if (incomingReport) {
      diagnosisReport = incomingReport as DiagnosisReport;
    } else if (incidentId) {
      const rec = incidentStore.getIncident(incidentId);
      if (!rec) {
        res.status(404).json({ error: `Incident '${incidentId}' not found in store` });
        return;
      }
      diagnosisReport = await runAutomatedRcaPipeline(rec.payload);
    } else {
      const latest = incidentStore.getLatestIncident();
      if (!latest) {
        res.status(400).json({ error: 'No active incidents available to remediate' });
        return;
      }
      diagnosisReport = await runAutomatedRcaPipeline(latest.payload);
    }

    const verifiedFixPackage = await synthesizeRemediationPackage(diagnosisReport);

    res.json({
      success: true,
      verifiedFixPackage,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

/**
 * POST /api/remediation/inspect-patch
 * Directly tests the 3-Gate Safety Inspector against a proposed patch
 */
remediationRouter.post('/inspect-patch', (req: Request, res: Response): void => {
  try {
    const { patch, estimatedMonthlyCostDelta = 0, maxBudgetDelta = 150 } = req.body;
    if (!patch) {
      res.status(400).json({ error: 'Missing patch object in request body' });
      return;
    }

    const inspection = PolicyAsCodeEngine.inspectPatch(
      patch as GeneratedPatch,
      estimatedMonthlyCostDelta,
      maxBudgetDelta
    );

    res.json({
      success: true,
      inspection,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

/**
 * 1. POST /api/remediation/apply
 * Executes the verified AWS SDK action with automated rollback snapshot
 */
remediationRouter.post('/apply', async (req: Request, res: Response): Promise<void> => {
  try {
    const { incidentId, fixPackage, userCredentials, dryRun = false } = req.body;
    let pkg: VerifiedFixPackage = fixPackage;

    if (!pkg && incidentId) {
      const rec = incidentStore.getIncident(incidentId);
      if (!rec) {
        res.status(404).json({ error: `Incident '${incidentId}' not found in store` });
        return;
      }
      const rca = await runAutomatedRcaPipeline(rec.payload);
      pkg = await synthesizeRemediationPackage(rca);
    }

    if (!pkg) {
      res.status(400).json({ error: 'Missing fixPackage or incidentId in request body' });
      return;
    }

    const result = await RemediationExecutor.executeFix({
      incidentId: incidentId || pkg.incidentId,
      fixPackage: pkg,
      userCredentials,
      dryRun,
    });

    res.json({
      success: result.status === 'APPLIED_SUCCESS' || result.status === 'APPLIED_SIMULATED',
      result,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

/**
 * 2. POST /api/remediation/verify/:incidentId
 * Closed-Loop Verification: queries CloudWatch to confirm alarm state is OK
 */
remediationRouter.post('/verify/:incidentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const incidentId = Array.isArray(req.params.incidentId)
      ? req.params.incidentId[0]
      : req.params.incidentId;
    const { alarmName, awsResourceId, metricName, threshold, userCredentials } = req.body || {};

    const report = await VerificationLoop.verifyOutcome({
      incidentId,
      alarmName,
      awsResourceId,
      metricName,
      threshold,
      userCredentials,
    });

    res.json({
      success: report.verified,
      report,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

/**
 * 3. POST /api/remediation/create-pr
 * Mode A: Creates / simulates a GitOps Pull Request with the Terraform diff
 */
remediationRouter.post('/create-pr', async (req: Request, res: Response): Promise<void> => {
  try {
    const { incidentId, fixPackage, repoOwner, repoName, targetBranch } = req.body;
    let pkg: VerifiedFixPackage = fixPackage;

    if (!pkg && incidentId) {
      const rec = incidentStore.getIncident(incidentId);
      if (!rec) {
        res.status(404).json({ error: `Incident '${incidentId}' not found in store` });
        return;
      }
      const rca = await runAutomatedRcaPipeline(rec.payload);
      pkg = await synthesizeRemediationPackage(rca);
    }

    if (!pkg) {
      res.status(400).json({ error: 'Missing fixPackage or incidentId in request body' });
      return;
    }

    const pr = await GitHubPrGenerator.createPr({
      incidentId: incidentId || pkg.incidentId,
      fixPackage: pkg,
      repoOwner,
      repoName,
      targetBranch,
    });

    res.json({
      success: true,
      pr,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

/**
 * 4. POST /api/remediation/slack-card
 * Mode C: Formats and dispatches a Slack Block Kit interactive card
 */
remediationRouter.post('/slack-card', async (req: Request, res: Response): Promise<void> => {
  try {
    const { incidentId, report: incomingReport, fixPackage: incomingPkg, webhookUrl } = req.body;
    let rca = incomingReport;
    let pkg = incomingPkg;

    if ((!rca || !pkg) && incidentId) {
      const rec = incidentStore.getIncident(incidentId);
      if (!rec) {
        res.status(404).json({ error: `Incident '${incidentId}' not found in store` });
        return;
      }
      rca = await runAutomatedRcaPipeline(rec.payload);
      pkg = await synthesizeRemediationPackage(rca);
    }

    if (!rca || !pkg) {
      res.status(400).json({ error: 'Missing report/fixPackage or incidentId in request body' });
      return;
    }

    const card = SlackCardFormatter.formatApprovalCard(rca, pkg);
    let dispatchSuccess = false;
    if (webhookUrl) {
      const dispatch = await SlackCardFormatter.dispatchToSlack(webhookUrl, card);
      dispatchSuccess = dispatch.success;
    }

    res.json({
      success: true,
      card,
      dispatched: dispatchSuccess,
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

/**
 * 5. GET /api/remediation/tenants
 * Lists multi-tenant projects mapped to cloud fleets
 */
remediationRouter.get('/tenants', (_req: Request, res: Response): void => {
  const tenants = TenantContextManager.listTenants();
  res.json({
    total: tenants.length,
    tenants,
  });
});
