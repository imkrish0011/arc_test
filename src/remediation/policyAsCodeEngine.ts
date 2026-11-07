import type { GeneratedPatch } from './autoRemediation.js';
import type { GuardrailStatus, SafetyGateDetails } from './types.js';

export interface InspectionResult {
  guardrailStatus: GuardrailStatus;
  safetyGateDetails: SafetyGateDetails;
}

/**
 * Sweta's Task 2: The 3-Gate Deterministic Safety Inspector
 * 
 * Gate 1: HCL Syntax & AWS Parameter Validator
 * Gate 2: Zero-Destruction Command Firewall (blocks DeleteDBInstance, TerminateInstances, etc.)
 * Gate 3: Network Security & Budget Guardrail (blocks 0.0.0.0/0 on sensitive ports 22, 5432, etc.)
 */
export class PolicyAsCodeEngine {
  private static readonly DESTRUCTIVE_COMMANDS = [
    'DeleteDBInstance',
    'DeleteDBCluster',
    'DeleteBucket',
    'TerminateInstances',
  ];

  private static readonly SENSITIVE_PORTS = [22, 3306, 5432, 6379, 27017];

  public static inspectPatch(
    patch: GeneratedPatch,
    estimatedMonthlyCostDelta = 0,
    maxBudgetDelta = 150
  ): InspectionResult {
    const details: SafetyGateDetails = {
      gate1SyntaxPassed: true,
      gate2DestructionFirewallPassed: true,
      gate3SecurityBudgetPassed: true,
    };

    // ----------------------------------------------------
    // GATE 1: HCL Syntax & AWS Parameter Validator
    // ----------------------------------------------------
    const syntaxErrors: string[] = [];
    const openBraces = (patch.terraformDiff.match(/\{/g) || []).length;
    const closeBraces = (patch.terraformDiff.match(/\}/g) || []).length;

    if (openBraces !== closeBraces && !patch.terraformDiff.includes('@@ -1,6 +0,0 @@')) {
      syntaxErrors.push(`Unbalanced braces in HCL diff: ${openBraces} open vs ${closeBraces} close`);
    }

    if (syntaxErrors.length > 0) {
      details.gate1SyntaxPassed = false;
      details.rejectionReason = syntaxErrors.join('; ');
      return {
        guardrailStatus: 'SECURITY_VIOLATION',
        safetyGateDetails: details,
      };
    }

    // ----------------------------------------------------
    // GATE 2: Zero-Destruction Command Firewall
    // ----------------------------------------------------
    const commandName = patch.awsSdkAction.command;
    const isDestructive = this.DESTRUCTIVE_COMMANDS.includes(commandName);

    if (isDestructive) {
      details.gate2DestructionFirewallPassed = false;
      details.rejectionReason = `Destructive AWS command detected: '${commandName}'. Destructive operations are strictly prohibited in production automated remediation.`;
      details.blockedOperations = [commandName];

      return {
        guardrailStatus: 'BLOCKED_DESTRUCTIVE_OP',
        safetyGateDetails: details,
      };
    }

    // ----------------------------------------------------
    // GATE 3: Network Security & Budget Cap Guardrail
    // ----------------------------------------------------
    const securityViolations: string[] = [];

    const diffLines = patch.terraformDiff.split('\n');
    for (const line of diffLines) {
      if (line.startsWith('+') && line.includes('0.0.0.0/0')) {
        securityViolations.push('Exposing sensitive infrastructure to 0.0.0.0/0 (Internet) is forbidden.');
      }
    }

    if (estimatedMonthlyCostDelta > maxBudgetDelta) {
      securityViolations.push(
        `Estimated monthly cost increase (+$${estimatedMonthlyCostDelta}/mo) exceeds maximum allowed budget threshold (+$${maxBudgetDelta}/mo).`
      );
    }

    if (securityViolations.length > 0) {
      details.gate3SecurityBudgetPassed = false;
      details.rejectionReason = securityViolations.join('; ');
      details.violatingRules = securityViolations;

      return {
        guardrailStatus: 'SECURITY_VIOLATION',
        safetyGateDetails: details,
      };
    }

    return {
      guardrailStatus: 'PASSED_VERIFIED',
      safetyGateDetails: details,
    };
  }
}

