import type { DiagnosisReport, VerifiedFixPackage } from './types.js';
import { AutoRemediationEngine } from './autoRemediation.js';
import { PolicyAsCodeEngine } from './policyAsCodeEngine.js';
import { RemediationSimulator } from './simulator.js';

/**
 * Sweta's AI Engine Lead: Remediation Synthesis, Simulation & Safety Engine
 * 
 * Master Orchestrator implementing `synthesizeRemediationPackage(rcaReport)`:
 * 1. Dual-Mode Patch Synthesis: Generates clean Terraform HCL diff + AWS SDK command
 * 2. Pre-Flight Simulation & Cost: Computes before/after metrics and cost delta
 * 3. 3-Gate Deterministic Safety Inspector: Verifies syntax, destruction firewall & security rules
 * 4. Outputs strictly verified Handoff 3 package for Krish's Slack & Web approval card
 */
export class SolutionEngine {
  public static async synthesizeRemediationPackage(
    diagnosisReport: DiagnosisReport
  ): Promise<VerifiedFixPackage> {
    const generatedAt = new Date().toISOString();

    // 1. Dual-Mode Patch Synthesis (Task 1)
    const patch = AutoRemediationEngine.generatePatch(diagnosisReport);

    // 2. Pre-Flight Simulation & Financial Cost Delta (Task 3 & 4)
    const { simulationResult, costImpactMonthly } = RemediationSimulator.simulate(diagnosisReport);

    // 3. 3-Gate Deterministic Safety Inspection (Task 2)
    const inspection = PolicyAsCodeEngine.inspectPatch(
      patch,
      costImpactMonthly.deltaUsd,
      150 // $150/mo max budget delta guardrail
    );

    // 4. Formulate Handoff 3 VerifiedFixPackage for Krish
    return {
      incidentId: diagnosisReport.incidentId,
      guardrailStatus: inspection.guardrailStatus,
      safetyGateDetails: inspection.safetyGateDetails,
      terraformDiff: patch.terraformDiff,
      awsSdkAction: patch.awsSdkAction,
      simulationResult,
      costImpactMonthly,
      rollbackSnapshotConfig: patch.rollbackSnapshotConfig,
      generatedAt,
    };
  }
}

/**
 * Direct function export as specified in Section 5 of the AI Engineering Manual
 */
export async function synthesizeRemediationPackage(
  diagnosisReport: DiagnosisReport
): Promise<VerifiedFixPackage> {
  return SolutionEngine.synthesizeRemediationPackage(diagnosisReport);
}

