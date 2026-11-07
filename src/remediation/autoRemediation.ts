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
    if (intent.includes('CONFIGURE_CIRCUIT_BREAKER_AND_JITTER')) {
      return this.generateCircuitBreakerPatch(report);
    }
    if (intent.includes('RESOLVE_DATABASE_DEADLOCK_CONTENTION')) {
      return this.generateDatabaseDeadlockPatch(report);
    }
    if (intent.includes('DEPLOY_NODE_LOCAL_DNS_CACHE')) {
      return this.generateNodeLocalDnsPatch(report);
    }
    if (intent.includes('ATTACH_SQS_DEAD_LETTER_QUEUE')) {
      return this.generateSqsDeadLetterQueuePatch(report);
    }
    if (intent.includes('EXPAND_VPC_SECONDARY_CIDR')) {
      return this.generateSecondaryVpcCidrPatch(report);
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

  // 3. Security Group Drift (Revoke 0.0.0.0/0 on sensitive ports) Fix
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

  // 6. Hardcore Scenario 1: Cascading Retry Storm & Thundering Herd Fix
  // Deploys Envoy / Istio Circuit Breaker with outlier detection & jitter backoff
  private static generateCircuitBreakerPatch(report: DiagnosisReport): GeneratedPatch {
    const serviceName = report.awsResourceId || 'checkout-service';

    const terraformDiff = [
      '--- a/terraform/circuit_breaker.tf',
      '+++ b/terraform/circuit_breaker.tf',
      '@@ -10,4 +10,18 @@',
      ' resource "kubernetes_manifest" "resilience_circuit_breaker" {',
      '   manifest = {',
      '+    trafficPolicy = {',
      '+      connectionPool = {',
      '+        tcp  = { maxConnections = 100 }',
      '+        http = { http1MaxPendingRequests = 50, maxRequestsPerConnection = 10 }',
      '+      }',
      '+      outlierDetection = {',
      '+        consecutive5xxErrors = 3',
      '+        interval             = "10s"',
      '+        baseEjectionTime     = "30s"',
      '+      }',
      '+    }',
      '   }',
      ' }',
    ].join('\n');

    const awsSdkAction: AwsSdkAction = {
      service: 'ecs',
      command: 'UpdateServiceCommand',
      parameters: {
        cluster: 'ecommerce-cluster',
        service: serviceName,
        desiredCount: 20,
        enableExecuteCommand: true,
      },
    };

    const rollbackSnapshotConfig: RollbackSnapshotConfig = {
      action: 'DescribeServicesCommand',
      description: 'Backup of ECS service configuration prior to circuit breaker activation',
      params: {
        cluster: 'ecommerce-cluster',
        services: [serviceName],
      },
    };

    return { terraformDiff, awsSdkAction, rollbackSnapshotConfig };
  }

  // 7. Hardcore Scenario 2: Database Deadlock & Lock Contention Fix
  // Enforces lock_timeout = 2000ms & provisions SQS FIFO queue for serialized updates
  private static generateDatabaseDeadlockPatch(report: DiagnosisReport): GeneratedPatch {
    const dbName = report.awsResourceId || 'aurora-pg-inventory-cluster';

    const terraformDiff = [
      '--- a/terraform/aurora_parameters.tf',
      '+++ b/terraform/aurora_parameters.tf',
      '@@ -8,4 +8,17 @@',
      ' resource "aws_db_parameter_group" "aurora_pg" {',
      '   name   = "pg15-inventory-params"',
      '+  parameter {',
      '+    name  = "lock_timeout"',
      '+    value = "2000"',
      '+  }',
      '+  parameter {',
      '+    name  = "idle_in_transaction_session_timeout"',
      '+    value = "5000"',
      '+  }',
      ' }',
      '+resource "aws_sqs_queue" "inventory_fifo" {',
      '+  name                        = "inventory-updates.fifo"',
      '+  fifo_queue                  = true',
      '+  content_based_deduplication = true',
      '+}',
    ].join('\n');

    const awsSdkAction: AwsSdkAction = {
      service: 'rds',
      command: 'ModifyDBParameterGroupCommand',
      parameters: {
        DBParameterGroupName: 'pg15-inventory-params',
        Parameters: [
          { ParameterName: 'lock_timeout', ParameterValue: '2000', ApplyMethod: 'immediate' },
          { ParameterName: 'idle_in_transaction_session_timeout', ParameterValue: '5000', ApplyMethod: 'immediate' },
        ],
      },
    };

    const rollbackSnapshotConfig: RollbackSnapshotConfig = {
      action: 'CreateDBSnapshotCommand',
      description: 'Pre-remediation snapshot of Aurora inventory database before deadlock timeout adjustment',
      params: {
        DBInstanceIdentifier: dbName,
        DBSnapshotIdentifier: `pre-deadlock-remediation-${report.incidentId}`,
      },
    };

    return { terraformDiff, awsSdkAction, rollbackSnapshotConfig };
  }

  // 8. Hardcore Scenario 3: VPC DNS Resolution Starvation (1024 UDP pkt/s ENI Cap) Fix
  // Deploys NodeLocal DNSCache DaemonSet & HTTP keep-alive connection pooling
  private static generateNodeLocalDnsPatch(report: DiagnosisReport): GeneratedPatch {
    const terraformDiff = [
      '--- a/terraform/nodelocal_dns.tf',
      '+++ b/terraform/nodelocal_dns.tf',
      '@@ -1,4 +1,16 @@',
      '+resource "kubernetes_daemonset" "node_local_dns" {',
      '+  metadata {',
      '+    name      = "node-local-dns"',
      '+    namespace = "kube-system"',
      '+  }',
      '+  spec {',
      '+    template {',
      '+      spec {',
      '+        host_network = true',
      '+      }',
      '+    }',
      '+  }',
      '+}',
    ].join('\n');

    const awsSdkAction: AwsSdkAction = {
      service: 'route53resolver',
      command: 'UpdateResolverEndpointCommand',
      parameters: {
        ResolverEndpointId: 'rni-vpc-core-resolver',
        Name: 'nodelocal-dns-cache-accelerated',
      },
    };

    const rollbackSnapshotConfig: RollbackSnapshotConfig = {
      action: 'DescribeResolverEndpointsCommand',
      description: 'Snapshot of VPC resolver configuration prior to NodeLocal DNS deployment',
      params: {
        ResolverEndpointId: 'rni-vpc-core-resolver',
      },
    };

    return { terraformDiff, awsSdkAction, rollbackSnapshotConfig };
  }

  // 9. Hardcore Scenario 4: Poison Pill Queue Consumer CrashLoop Fix
  // Provisions SQS Dead Letter Queue (DLQ) with redrive policy (maxReceiveCount = 3)
  private static generateSqsDeadLetterQueuePatch(report: DiagnosisReport): GeneratedPatch {
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/payment-events-queue';

    const terraformDiff = [
      '--- a/terraform/sqs_resilience.tf',
      '+++ b/terraform/sqs_resilience.tf',
      '@@ -5,4 +5,16 @@',
      '+resource "aws_sqs_queue" "payment_events_dlq" {',
      '+  name                      = "payment-events-dlq"',
      '+  message_retention_seconds = 1209600',
      '+}',
      ' resource "aws_sqs_queue" "payment_events" {',
      '   name = "payment-events-queue"',
      '+  redrive_policy = jsonencode({',
      '+    deadLetterTargetArn = aws_sqs_queue.payment_events_dlq.arn',
      '+    maxReceiveCount     = 3',
      '+  })',
      ' }',
    ].join('\n');

    const awsSdkAction: AwsSdkAction = {
      service: 'sqs',
      command: 'SetQueueAttributesCommand',
      parameters: {
        QueueUrl: queueUrl,
        Attributes: {
          RedrivePolicy: JSON.stringify({
            deadLetterTargetArn: 'arn:aws:sqs:us-east-1:123456789012:payment-events-dlq',
            maxReceiveCount: 3,
          }),
        },
      },
    };

    const rollbackSnapshotConfig: RollbackSnapshotConfig = {
      action: 'GetQueueAttributesCommand',
      description: 'Backup of SQS queue attributes before dead letter queue attachment',
      params: {
        QueueUrl: queueUrl,
        AttributeNames: ['All'],
      },
    };

    return { terraformDiff, awsSdkAction, rollbackSnapshotConfig };
  }

  // 10. Hardcore Scenario 5: VPC Subnet IP Address Exhaustion Fix
  // Associates secondary IPv4 CIDR block (100.64.0.0/16) and allocates secondary /20 subnets
  private static generateSecondaryVpcCidrPatch(report: DiagnosisReport): GeneratedPatch {
    const vpcId = 'vpc-0789abcdef0123456';

    const terraformDiff = [
      '--- a/terraform/vpc_subnets.tf',
      '+++ b/terraform/vpc_subnets.tf',
      '@@ -10,4 +10,15 @@',
      '+resource "aws_vpc_ipv4_cidr_block_association" "secondary_cidr" {',
      '+  vpc_id     = aws_vpc.enterprise.id',
      '+  cidr_block = "100.64.0.0/16"',
      '+}',
      '+resource "aws_subnet" "secondary_app_1a" {',
      '+  vpc_id                  = aws_vpc.enterprise.id',
      '+  cidr_block              = "100.64.10.0/20"',
      '+  availability_zone       = "us-east-1a"',
      '+  map_public_ip_on_launch = false',
      '+}',
    ].join('\n');

    const awsSdkAction: AwsSdkAction = {
      service: 'ec2',
      command: 'AssociateVpcCidrBlockCommand',
      parameters: {
        VpcId: vpcId,
        CidrBlock: '100.64.0.0/16',
      },
    };

    const rollbackSnapshotConfig: RollbackSnapshotConfig = {
      action: 'DescribeVpcsCommand',
      description: 'Snapshot of VPC CIDR block associations before secondary expansion',
      params: {
        VpcIds: [vpcId],
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
