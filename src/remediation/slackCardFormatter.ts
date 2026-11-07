import type { VerifiedFixPackage, DiagnosisReport } from './types.js';

export interface SlackBlockKitCard {
  text: string;
  blocks: Array<Record<string, unknown>>;
}

/**
 * Formats autonomous incident packages into rich Slack Block Kit cards
 * with 1-click interactive approval buttons.
 */
export class SlackCardFormatter {
  public static formatApprovalCard(
    report: DiagnosisReport,
    fixPackage: VerifiedFixPackage
  ): SlackBlockKitCard {
    const blocks: Array<Record<string, unknown>> = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨 ArchViz Autonomous Incident: ${report.incidentId}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Root Failing Resource:*\n\`${report.awsResourceId}\` (${report.failingNodeId})`,
          },
          {
            type: 'mrkdwn',
            text: `*Diagnostic Confidence:*\n*${Math.round(report.confidenceScore * 100)}%* (${fixPackage.guardrailStatus})`,
          },
          {
            type: 'mrkdwn',
            text: `*Root Cause Summary:*\n${report.rootCauseSummary}`,
          },
          {
            type: 'mrkdwn',
            text: `*Recommended Fix:*\n\`${report.recommendedFixIntent}\``,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Key Log Evidence:*\n>${report.logEvidenceLine}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Pre-Flight Simulation:*\n${fixPackage.simulationResult.metricName}: \`${fixPackage.simulationResult.beforeValue}${fixPackage.simulationResult.unit}\` ➔ \`${fixPackage.simulationResult.afterValue}${fixPackage.simulationResult.unit}\` (${fixPackage.simulationResult.predictedRecoveryStatus})`,
          },
          {
            type: 'mrkdwn',
            text: `*Monthly Cost Impact:*\n*${fixPackage.costImpactMonthly.formattedDelta}* (Old: $${fixPackage.costImpactMonthly.oldCostUsd.toFixed(2)}, New: $${fixPackage.costImpactMonthly.newCostUsd.toFixed(2)})`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Mode A — Terraform Diff:*\n\`\`\`${fixPackage.terraformDiff.slice(0, 300)}\`\`\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✓ Approve & Apply Fix',
              emoji: true,
            },
            style: 'primary',
            value: JSON.stringify({
              incidentId: report.incidentId,
              action: 'approve_and_apply',
            }),
            action_id: 'approve_autonomous_fix',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📝 Create GitHub PR',
              emoji: true,
            },
            value: JSON.stringify({
              incidentId: report.incidentId,
              action: 'create_pr',
            }),
            action_id: 'create_github_pr',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⚠️ Escalate to SRE',
              emoji: true,
            },
            style: 'danger',
            value: JSON.stringify({
              incidentId: report.incidentId,
              action: 'escalate',
            }),
            action_id: 'escalate_incident',
          },
        ],
      },
    ];

    return {
      text: `ArchViz Alert: Incident ${report.incidentId} diagnosed (${report.failingNodeId}). Awaiting 1-click remediation approval.`,
      blocks,
    };
  }

  public static async dispatchToSlack(
    webhookUrl: string,
    card: SlackBlockKitCard
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      });
      return { success: res.status >= 200 && res.status < 300 };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
}
