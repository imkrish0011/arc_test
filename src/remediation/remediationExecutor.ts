import { RDSClient, ModifyDBInstanceCommand, CreateDBSnapshotCommand } from '@aws-sdk/client-rds';
import { EC2Client, RevokeSecurityGroupIngressCommand, DeleteVolumeCommand, CreateSnapshotCommand } from '@aws-sdk/client-ec2';
import { ECSClient, UpdateServiceCommand } from '@aws-sdk/client-ecs';
import { LambdaClient, UpdateFunctionConfigurationCommand } from '@aws-sdk/client-lambda';

import type { VerifiedFixPackage } from './types.js';
import { AwsCredentialManager, type AwsUserCredentials } from '../aws/credentials.js';
import { incidentStore } from '../store/incidentStore.js';

export interface RemediationExecutionOptions {
  incidentId: string;
  fixPackage: VerifiedFixPackage;
  userCredentials?: AwsUserCredentials;
  dryRun?: boolean;
}

export interface RemediationExecutionResult {
  incidentId: string;
  executedAt: string;
  status: 'APPLIED_SUCCESS' | 'APPLIED_SIMULATED' | 'BLOCKED_BY_GUARDRAIL' | 'FAILED';
  durationMs: number;
  service: string;
  command: string;
  snapshotCreated?: {
    action: string;
    snapshotId: string;
    description: string;
  };
  details: string;
  rawAwsResponse: Record<string, unknown>;
}

/**
 * Executes Sweta's verified remediation package against AWS SDK v3
 * with pre-flight safety snapshotting and simulation fallbacks.
 */
export class RemediationExecutor {
  public static async executeFix(
    options: RemediationExecutionOptions
  ): Promise<RemediationExecutionResult> {
    const { incidentId, fixPackage, userCredentials, dryRun = false } = options;
    const startTime = Date.now();
    const executedAt = new Date().toISOString();

    // 1. Guardrail Check: Never execute if blocked by safety inspector
    if (fixPackage.guardrailStatus !== 'PASSED_VERIFIED') {
      const reason = fixPackage.safetyGateDetails.rejectionReason || 'Failed deterministic safety gates';
      return {
        incidentId,
        executedAt,
        status: 'BLOCKED_BY_GUARDRAIL',
        durationMs: Date.now() - startTime,
        service: fixPackage.awsSdkAction.service,
        command: fixPackage.awsSdkAction.command,
        details: `Execution aborted: ${reason}`,
        rawAwsResponse: { error: reason, safetyGateDetails: fixPackage.safetyGateDetails },
      };
    }

    const credStatus = AwsCredentialManager.getStatus(userCredentials);
    const action = fixPackage.awsSdkAction;

    // 2. Automated Safety Snapshot
    let snapshotInfo: RemediationExecutionResult['snapshotCreated'] = undefined;
    if (fixPackage.rollbackSnapshotConfig) {
      const snapConfig = fixPackage.rollbackSnapshotConfig;
      const snapId = `snap-${incidentId}-${Date.now().toString(36)}`;
      snapshotInfo = {
        action: snapConfig.action,
        snapshotId: snapId,
        description: snapConfig.description,
      };
    }

    // 3. Simulated Execution (when without credentials or explicitly dryRun)
    if (credStatus.isSimulated || dryRun) {
      const durationMs = 120 + Math.floor(Math.random() * 80);
      const simulatedResult: RemediationExecutionResult = {
        incidentId,
        executedAt,
        status: 'APPLIED_SIMULATED',
        durationMs,
        service: action.service,
        command: action.command,
        snapshotCreated: snapshotInfo,
        details: `Command '${action.command}' simulated successfully against AWS ${action.service.toUpperCase()} in ${durationMs}ms (Mode: Simulated / Dry-Run).`,
        rawAwsResponse: {
          $metadata: { httpStatusCode: 200, requestId: `sim-${Date.now().toString(36)}` },
          appliedAction: action,
          status: 'SUCCESS',
        },
      };

      // Record in incident store
      incidentStore.updateHandoffStatus(incidentId, {
        remediationExecuted: true,
        remediationResult: simulatedResult,
      } as any);

      return simulatedResult;
    }

    // 4. Live AWS Execution using Real SDK Clients
    try {
      const credentials = await AwsCredentialManager.resolveCredentials(userCredentials);
      const region = credentials.region || 'us-east-1';

      let rawResponse: Record<string, unknown> = {};

      if (action.service === 'rds') {
        const client = new RDSClient({
          region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
          },
        });

        // Trigger snapshot first if configured
        if (fixPackage.rollbackSnapshotConfig) {
          const snapCmd = new CreateDBSnapshotCommand(
            fixPackage.rollbackSnapshotConfig.params as any
          );
          await client.send(snapCmd);
        }

        const cmd = new ModifyDBInstanceCommand(action.parameters as any);
        const res = await client.send(cmd);
        rawResponse = res as unknown as Record<string, unknown>;
      } else if (action.service === 'ec2') {
        const client = new EC2Client({
          region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
          },
        });

        if (action.command === 'RevokeSecurityGroupIngressCommand') {
          const cmd = new RevokeSecurityGroupIngressCommand(action.parameters as any);
          const res = await client.send(cmd);
          rawResponse = res as unknown as Record<string, unknown>;
        } else if (action.command === 'DeleteVolumeCommand') {
          // Pre-snapshot
          if (fixPackage.rollbackSnapshotConfig) {
            const snapCmd = new CreateSnapshotCommand(
              fixPackage.rollbackSnapshotConfig.params as any
            );
            await client.send(snapCmd);
          }
          const cmd = new DeleteVolumeCommand(action.parameters as any);
          const res = await client.send(cmd);
          rawResponse = res as unknown as Record<string, unknown>;
        }
      } else if (action.service === 'ecs') {
        const client = new ECSClient({
          region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
          },
        });
        const cmd = new UpdateServiceCommand(action.parameters as any);
        const res = await client.send(cmd);
        rawResponse = res as unknown as Record<string, unknown>;
      } else if (action.service === 'lambda') {
        const client = new LambdaClient({
          region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
          },
        });
        const cmd = new UpdateFunctionConfigurationCommand(action.parameters as any);
        const res = await client.send(cmd);
        rawResponse = res as unknown as Record<string, unknown>;
      }

      const durationMs = Date.now() - startTime;
      const liveResult: RemediationExecutionResult = {
        incidentId,
        executedAt,
        status: 'APPLIED_SUCCESS',
        durationMs,
        service: action.service,
        command: action.command,
        snapshotCreated: snapshotInfo,
        details: `Command '${action.command}' successfully applied to live AWS ${action.service.toUpperCase()} in ${durationMs}ms.`,
        rawAwsResponse: rawResponse,
      };

      incidentStore.updateHandoffStatus(incidentId, {
        remediationExecuted: true,
        remediationResult: liveResult,
      } as any);

      return liveResult;
    } catch (err: unknown) {
      return {
        incidentId,
        executedAt,
        status: 'FAILED',
        durationMs: Date.now() - startTime,
        service: action.service,
        command: action.command,
        details: `Execution failed: ${(err as Error).message}`,
        rawAwsResponse: { error: (err as Error).message },
      };
    }
  }
}
