import type {
  DiagnosisReport,
  AwsSdkAction,
  RollbackSnapshotConfig,
} from './types.js';

export interface GeneratedPatch {
  terraformDiff: string;
  awsSdkAction: AwsSdkAction;
  rollbackSnapshotConfig?: RollbackSnapshotConfig;
}

/**
 * Sweta's Task 1: Dual-Mode Patch Synthesizer
 * Generates both:
 *  1. Clean Git-style Terraform HCL Diff for GitHub Pull Request
 *  2. Direct AWS SDK v3 Command payload for 1-click immediate emergency fix
 */
export class AutoRemediationEngine {
  public static generatePatch(report: DiagnosisReport): GeneratedPatch {
    const intent = report.recommendedFixIntent || '';

    if (intent.includes('UPGRADE_RDS_INSTANCE')) {
      return this.generateRdsUpgradePatch(report);
    }
    if (intent.includes('INCREASE_CONTAINER_MEMORY')) {
      return this.generateContainerMemoryPatch(report);
    }
    if (intent.includes('REVOKE_PUBLIC_INGRESS_RULE')) {
      return this.generateRevokeIngressPatch(report);
    }
    if (intent.includes('INCREASE_LAMBDA_TIMEOUT')) {
      return this.generateLambdaTimeoutPatch(report);
    }
    if (intent.includes('SNAPSHOT_AND_DELETE_EBS')) {
      return this.generateEbsCleanupPatch(report);
    }

    return this.generateGenericFallbackPatch(report);
  }

  // 1. RDS Database Bottleneck Fix
  private static generateRdsUpgradePatch(report: DiagnosisReport): GeneratedPatch {
    const resourceId = report.awsResourceId || 'db-prod-postgres';
    const targetClass = (report.targetParameters?.targetClass as string) || 'db.r6g.xlarge';

    const terraformDiff = [
      '--- a/terraform/rds.tf',
      '+++ b/terraform/rds.tf',
      '@@ -12,4 +12,4 @@',
      ' resource "aws_db_instance" "primary" {',
      '-  instance_class = "db.t3.medium"',
      `+  instance_class = "${targetClass}"`,
      '   allocated_storage = 100',
      ' }',
    ].join('\n');

    const awsSdkAction: AwsSdkAction = {
      service: 'rds',
      command: 'ModifyDBInstanceCommand',
      parameters: {
        DBInstanceIdentifier: resourceId,
        DBInstanceClass: targetClass,
        ApplyImmediately: true,
      },
    };

    const rollbackSnapshotConfig: RollbackSnapshotConfig = {
      action: 'CreateDBSnapshotCommand',
      description: 'Pre-upgrade automated snapshot taken before instance resize',
      params: {
        DBInstanceIdentifier: resourceId,
        DBSnapshotIdentifier: `pre-remediation-${report.incidentId}`,
      },
    };

    return { terraformDiff, awsSdkAction, rollbackSnapshotConfig };
  }

  // 2. Container CrashLoop (Exit Code 137 / OOM) Fix
  private static generateContainerMemoryPatch(report: DiagnosisReport): GeneratedPatch {
    const resourceId = report.awsResourceId || 'ecs-service-app';
    const newMemory = (report.targetParameters?.targetMemory as string) || '1024';
    const newCpu = (report.targetParameters?.targetCpu as string) || '512';

    const terraformDiff = [
      '--- a/terraform/ecs.tf',
      '+++ b/terraform/ecs.tf',
      '@@ -15,5 +15,5 @@',
      ' resource "aws_ecs_task_definition" "service_task" {',
      '-  cpu    = "256"',
      '-  memory = "512"',
      `+  cpu    = "${newCpu}"`,
      `+  memory = "${newMemory}"`,
      ' }',
    ].join('\n');

    const awsSdkAction: AwsSdkAction = {
      service: 'ecs',
      command: 'UpdateServiceCommand',
      parameters: {
        cluster: 'prod-cluster',
        service: resourceId,
        forceNewDeployment: true,
        taskDefinitionOverride: {
          cpu: newCpu,
          memory: newMemory,
        },
      },
    };

    const rollbackSnapshotConfig: RollbackSnapshotConfig = {
      action: 'RegisterTaskDefinitionCommand',
      description: 'Rollback definition pointer to previous task revision',
      params: {
        taskDefinition: `${resourceId}:previous`,
      },
    };

    return { terraformDiff, awsSdkAction, rollbackSnapshotConfig };
  }

  // 3. Security Group Drift Fix (Revoke 0.0.0.0/0 on sensitive port)
  private static generateRevokeIngressPatch(report: DiagnosisReport): GeneratedPatch {
    const sgId = report.awsResourceId || 'sg-0192837465';
    const port = (report.targetParameters?.port as number) || 5432;

    const terraformDiff = [
      '--- a/terraform/security_groups.tf',
      '+++ b/terraform/security_groups.tf',
      '@@ -18,3 +18,3 @@',
      '   ingress {',
      `     from_port   = ${port}`,
      `     to_port     = ${port}`,
      '     protocol    = "tcp"',
      '-    cidr_blocks = ["0.0.0.0/0"]',
      '+    cidr_blocks = ["10.0.0.0/16"]',
      '   }',
    ].join('\n');

    const awsSdkAction: AwsSdkAction = {
      service: 'ec2',
      command: 'RevokeSecurityGroupIngressCommand',
      parameters: {
        GroupId: sgId,
        IpPermissions: [
          {
            IpProtocol: 'tcp',
            FromPort: port,
            ToPort: port,
            IpRanges: [{ CidrIp: '0.0.0.0/0' }],
          },
        ],
      },
    };

    return { terraformDiff, awsSdkAction };
  }

  // 4. API 5xx Timeouts (Lambda Timeout Extension) Fix
  private static generateLambdaTimeoutPatch(report: DiagnosisReport): GeneratedPatch {
    const functionName = report.awsResourceId || 'api-order-handler';
    const newTimeout = (report.targetParameters?.targetTimeout as number) || 15;

    const terraformDiff = [
      '--- a/terraform/lambda.tf',
      '+++ b/terraform/lambda.tf',
      '@@ -8,4 +8,4 @@',
      ' resource "aws_lambda_function" "api_handler" {',
      '-  timeout = 3',
      `+  timeout = ${newTimeout}`,
      '   memory_size = 512',
      ' }',
    ].join('\n');

    const awsSdkAction: AwsSdkAction = {
      service: 'lambda',
      command: 'UpdateFunctionConfigurationCommand',
      parameters: {
        FunctionName: functionName,
        Timeout: newTimeout,
      },
    };

    return { terraformDiff, awsSdkAction };
  }

  // 5. FinOps Idle Waste (Snapshot & Delete Orphaned EBS Volume) Fix
  private static generateEbsCleanupPatch(report: DiagnosisReport): GeneratedPatch {
    const volumeId = report.awsResourceId || 'vol-0abcdef1234567890';

    const terraformDiff = [
      '--- a/terraform/ebs.tf',
      '+++ b/terraform/ebs.tf',
      '@@ -1,6 +0,0 @@',
      '-resource "aws_ebs_volume" "legacy_unattached_volume" {',
      '-  availability_zone = "us-east-1a"',
      '-  size              = 100',
      '-  type              = "io2"',
      '-}',
    ].join('\n');

    const awsSdkAction: AwsSdkAction = {
      service: 'ec2',
      command: 'DeleteVolumeCommand',
      parameters: {
        VolumeId: volumeId,
      },
    };

    const rollbackSnapshotConfig: RollbackSnapshotConfig = {
      action: 'CreateSnapshotCommand',
      description: 'Mandatory pre-deletion snapshot taken to prevent permanent data loss',
      params: {
        VolumeId: volumeId,
        Description: `Automated safety snapshot for ${volumeId} prior to cleanup`,
      },
    };

    return { terraformDiff, awsSdkAction, rollbackSnapshotConfig };
  }

  // Generic Fallback
  private static generateGenericFallbackPatch(report: DiagnosisReport): GeneratedPatch {
    return {
      terraformDiff: `# Manual inspection advised for intent: ${report.recommendedFixIntent}`,
      awsSdkAction: {
        service: 'generic',
        command: 'InspectResourceCommand',
        parameters: { resourceId: report.awsResourceId },
      },
    };
  }
}

