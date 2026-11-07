import { Router, type Request, type Response } from 'express';
import { incidentStore } from '../store/incidentStore.js';
import { runAutomatedRcaPipeline } from '../engine/agentExecutionEngine.js';
import { synthesizeRemediationPackage } from '../remediation/solutionEngine.js';
import { PolicyAsCodeEngine } from '../remediation/policyAsCodeEngine.js';
import type { DiagnosisReport } from '../remediation/types.js';
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

