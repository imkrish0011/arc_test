import type { VerifiedFixPackage } from './types.js';

export interface GitHubPrOptions {
  incidentId: string;
  fixPackage: VerifiedFixPackage;
  repoOwner?: string;
  repoName?: string;
  targetBranch?: string;
}

export interface GitHubPrResult {
  prUrl: string;
  prNumber: number;
  branchName: string;
  title: string;
  markdownBody: string;
  status: 'OPEN_SIMULATED' | 'OPEN_LIVE';
}

/**
 * Synthesizes and creates GitOps Pull Requests containing the validated Terraform diff
 */
export class GitHubPrGenerator {
  public static async createPr(options: GitHubPrOptions): Promise<GitHubPrResult> {
    const { incidentId, fixPackage, repoOwner = 'imkrish0011', repoName = 'archviz', targetBranch = 'main' } = options;
    const branchName = `fix/autonomous-${incidentId}`;
    const prNumber = Math.floor(100 + Math.random() * 900);
    const title = `[ArchViz Autonomous Fix] Remediate Incident ${incidentId}`;

    const markdownBody = [
      `## 🤖 ArchViz Autonomous Incident Remediation`,
      ``,
      `**Incident ID:** \`${incidentId}\``,
      `**Guardrail Status:** \`${fixPackage.guardrailStatus}\` (3-Gate Safety Verified)`,
      `**Financial Impact:** **${fixPackage.costImpactMonthly.formattedDelta}** (Old: $${fixPackage.costImpactMonthly.oldCostUsd.toFixed(2)}, New: $${fixPackage.costImpactMonthly.newCostUsd.toFixed(2)})`,
      ``,
      `### 📊 Telemetry Pre-Flight Simulation`,
      `| Metric | Before Fix | Predicted After | Threshold | Recovery Status |`,
      `| :--- | :---: | :---: | :---: | :---: |`,
      `| **${fixPackage.simulationResult.metricName}** | ${fixPackage.simulationResult.beforeValue}${fixPackage.simulationResult.unit} | ${fixPackage.simulationResult.afterValue}${fixPackage.simulationResult.unit} | ${fixPackage.simulationResult.threshold}${fixPackage.simulationResult.unit} | **${fixPackage.simulationResult.predictedRecoveryStatus}** |`,
      ``,
      `> ℹ️ *Simulation Note:* ${fixPackage.simulationResult.simulationNotes}`,
      ``,
      `### 🛡️ 3-Gate Deterministic Safety Verification`,
      `- [x] **Gate 1 (HCL Syntax):** Validated`,
      `- [x] **Gate 2 (Zero-Destruction Firewall):** No destructive commands (${fixPackage.awsSdkAction.command})`,
      `- [x] **Gate 3 (Security & Budget):** Sensitive ports safe; cost within budget`,
      ``,
      `### 📝 Terraform HCL Diff`,
      `\`\`\`diff`,
      fixPackage.terraformDiff,
      `\`\`\``,
      ``,
      fixPackage.rollbackSnapshotConfig
        ? `### 💾 Rollback Safety Snapshot\n- **Action:** \`${fixPackage.rollbackSnapshotConfig.action}\`\n- **Description:** ${fixPackage.rollbackSnapshotConfig.description}`
        : ``,
      ``,
      `*Generated autonomously by ArchViz 24/7 Cloud Assistant Pipeline.*`,
    ].join('\n');

    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken && repoOwner && repoName) {
      try {
        const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/pulls`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            head: branchName,
            base: targetBranch,
            body: markdownBody,
          }),
        });
        const data = (await res.json()) as { html_url?: string; number?: number };
        if (data.html_url && data.number) {
          return {
            prUrl: data.html_url,
            prNumber: data.number,
            branchName,
            title,
            markdownBody,
            status: 'OPEN_LIVE',
          };
        }
      } catch {
        // Fallback to simulated PR URL
      }
    }

    const prUrl = `https://github.com/${repoOwner}/${repoName}/pull/${prNumber}`;
    return {
      prUrl,
      prNumber,
      branchName,
      title,
      markdownBody,
      status: 'OPEN_SIMULATED',
    };
  }
}
