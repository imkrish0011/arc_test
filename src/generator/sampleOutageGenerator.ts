import type { AlertPayload } from '../types/alertPayload.js';
import {
  RDS_BOTTLENECK_GRAPH,
  ECS_CRASHLOOP_GRAPH,
  SECURITY_GROUP_DRIFT_GRAPH,
  API_5XX_TIMEOUT_GRAPH,
  FINOPS_IDLE_WASTE_GRAPH,
  RETRY_STORM_GRAPH,
  DATABASE_DEADLOCK_GRAPH,
  VPC_DNS_STARVATION_GRAPH,
  SQS_POISON_PILL_GRAPH,
  SUBNET_IP_EXHAUSTION_GRAPH,
} from './mockGraphs.js';

export type ScenarioType =
  | 'rds_bottleneck'
  | 'container_crashloop'
  | 'security_group_drift'
  | 'api_5xx_timeouts'
  | 'finops_idle_waste'
  | 'retry_storm_thundering_herd'
  | 'database_deadlock_contention'
  | 'vpc_dns_starvation'
  | 'sqs_poison_pill_crashloop'
  | 'subnet_ip_exhaustion';

export class SampleOutageGenerator {
  /**
   * Generates a complete AlertPayload matching the exact contract
   * for any of the AWS outage scenarios.
   */
  public static generate(scenario: ScenarioType, customIncidentId?: string): AlertPayload {
    const triggeredAt = new Date().toISOString();
    const incidentId = customIncidentId || `inc-${scenario.replace(/_/g, '-')}-${Date.now().toString(36)}`;

    switch (scenario) {
      case 'rds_bottleneck':
        return this.generateRdsBottleneck(incidentId, triggeredAt);

      case 'container_crashloop':
        return this.generateContainerCrashLoop(incidentId, triggeredAt);

      case 'security_group_drift':
        return this.generateSecurityGroupDrift(incidentId, triggeredAt);

      case 'api_5xx_timeouts':
        return this.generateApi5xxTimeouts(incidentId, triggeredAt);

      case 'finops_idle_waste':
        return this.generateFinOpsIdleWaste(incidentId, triggeredAt);

      case 'retry_storm_thundering_herd':
        return this.generateRetryStormThunderingHerd(incidentId, triggeredAt);

      case 'database_deadlock_contention':
        return this.generateDatabaseDeadlockContention(incidentId, triggeredAt);

      case 'vpc_dns_starvation':
        return this.generateVpcDnsStarvation(incidentId, triggeredAt);

      case 'sqs_poison_pill_crashloop':
        return this.generateSqsPoisonPillCrashloop(incidentId, triggeredAt);

      case 'subnet_ip_exhaustion':
        return this.generateSubnetIpExhaustion(incidentId, triggeredAt);

      default:
        throw new Error(`Unknown scenario type: ${scenario}`);
    }
  }

  // 1. RDS Database Bottleneck
  private static generateRdsBottleneck(incidentId: string, triggeredAt: string): AlertPayload {
    const now = new Date(triggeredAt).getTime();
    const tMinus = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

    return {
      incidentId,
      triggeredAt,
      activeAlarms: [
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:rds-aurora-cpu-exhaustion',
          alarmName: 'RDS-High-CPU-Utilization',
          nodeId: 'node-rds-01',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-orders-primary',
          metricName: 'CPUUtilization',
          metricValue: 96.4,
          threshold: 90.0,
          timestamp: tMinus(2),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:rds-aurora-conn-saturation',
          alarmName: 'RDS-DatabaseConnections-Exceeded',
          nodeId: 'node-rds-01',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-orders-primary',
          metricName: 'DatabaseConnections',
          metricValue: 498,
          threshold: 450,
          timestamp: tMinus(3),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:lambda-order-error-cascading',
          alarmName: 'Lambda-Order-Error-Rate-High',
          nodeId: 'node-lambda-01',
          awsResourceId: 'arn:aws:lambda:us-east-1:123456789012:function:OrderProcessingService',
          metricName: 'Errors',
          metricValue: 312,
          threshold: 10,
          timestamp: tMinus(1),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:apigw-order-5xx-spike',
          alarmName: 'ApiGateway-5XXError-Threshold',
          nodeId: 'node-apigw-01',
          awsResourceId: 'arn:aws:apigateway:us-east-1::/restapis/agw-prod-order/stages/prod',
          metricName: '5XXError',
          metricValue: 48.2,
          threshold: 5.0,
          timestamp: tMinus(1),
        },
      ],
      cloudWatchLogs30m: [
        {
          timestamp: tMinus(18),
          nodeId: 'node-rds-01',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-orders-primary',
          level: 'WARN',
          message: 'checkpoint starting: time',
        },
        {
          timestamp: tMinus(12),
          nodeId: 'node-rds-01',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-orders-primary',
          level: 'WARN',
          message: 'Connection pool saturation at 92% (460/500 client connections allocated)',
        },
        {
          timestamp: tMinus(7),
          nodeId: 'node-rds-01',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-orders-primary',
          level: 'FATAL',
          message: 'FATAL: remaining connection slots are reserved for non-replication superuser connections',
        },
        {
          timestamp: tMinus(5),
          nodeId: 'node-lambda-01',
          awsResourceId: 'arn:aws:lambda:us-east-1:123456789012:function:OrderProcessingService',
          level: 'ERROR',
          message: 'SequelizeConnectionAcquireTimeoutError: Operation timeout: Unable to acquire connection from pool within 10000ms',
        },
        {
          timestamp: tMinus(3),
          nodeId: 'node-lambda-01',
          awsResourceId: 'arn:aws:lambda:us-east-1:123456789012:function:OrderProcessingService',
          level: 'TIMEOUT',
          message: 'Task timed out after 15.01 seconds while executing checkout transaction',
        },
        {
          timestamp: tMinus(2),
          nodeId: 'node-apigw-01',
          awsResourceId: 'arn:aws:apigateway:us-east-1::/restapis/agw-prod-order/stages/prod',
          level: 'ERROR',
          message: 'Execution failed due to configuration error: Gateway Timeout (504) on integration Lambda invocation',
        },
      ],
      cloudTrailEvents60m: [
        {
          eventId: 'trail-evt-88a7b1c2-d3e4-4f50-98a7-0123456789ab',
          eventTime: tMinus(42),
          eventName: 'ModifyDBParameterGroup',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:pg:aurora-pg-custom-params',
          userIdentity: 'devops-automation-pipeline',
          requestParameters: {
            dBParameterGroupName: 'aurora-pg-custom-params',
            parameters: [
              {
                parameterName: 'max_connections',
                parameterValue: '{DBInstanceClassMemory/31457280}',
                applyMethod: 'immediate',
              },
              {
                parameterName: 'statement_timeout',
                parameterValue: '15000',
                applyMethod: 'immediate',
              },
            ],
          },
        },
        {
          eventId: 'trail-evt-99b8c2d3-e4f5-5a61-09b8-1234567890cd',
          eventTime: tMinus(35),
          eventName: 'RebootDBInstance',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-orders-primary',
          userIdentity: 'devops-lead-user',
          requestParameters: {
            dBInstanceIdentifier: 'aurora-pg-orders-primary',
            forceFailover: false,
          },
        },
      ],
      canvasGraph: RDS_BOTTLENECK_GRAPH,
    };
  }

  // 2. ECS/EKS Container CrashLoop
  private static generateContainerCrashLoop(incidentId: string, triggeredAt: string): AlertPayload {
    const now = new Date(triggeredAt).getTime();
    const tMinus = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

    return {
      incidentId,
      triggeredAt,
      activeAlarms: [
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:ecs-service-tasks-crashing',
          alarmName: 'ECS-Task-StopCount-Exceeded',
          nodeId: 'node-ecs-01',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/production-cluster/payment-auth-service',
          metricName: 'ContainerCrashCount',
          metricValue: 7,
          threshold: 3,
          timestamp: tMinus(2),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:alb-unhealthy-host-count',
          alarmName: 'ALB-UnHealthyHostCount-Spike',
          nodeId: 'node-alb-01',
          awsResourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/k8s-ingress-alb/1a2b3c',
          metricName: 'UnHealthyHostCount',
          metricValue: 5,
          threshold: 1,
          timestamp: tMinus(3),
        },
      ],
      cloudWatchLogs30m: [
        {
          timestamp: tMinus(14),
          nodeId: 'node-ecs-01',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/production-cluster/payment-auth-service',
          level: 'WARN',
          message: 'V8 Garbage Collection high duration: Scavenge took 1840ms, memory heap limit approaching 512MB',
        },
        {
          timestamp: tMinus(11),
          nodeId: 'node-ecs-01',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/production-cluster/payment-auth-service',
          level: 'FATAL',
          message: '<--- Last few GCs ---> [1:0x55a29f8c] 498 MB: Mark-sweep (reduce) 498.2 (512.0) MB: allocation failure; JavaScript heap out of memory',
        },
        {
          timestamp: tMinus(9),
          nodeId: 'node-ecs-01',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/production-cluster/payment-auth-service',
          level: 'ERROR',
          message: 'Essential container in task exited with Exit Code 137 (OutOfMemoryError) - Process terminated by Linux kernel OOM-killer',
        },
        {
          timestamp: tMinus(6),
          nodeId: 'node-ecs-01',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/production-cluster/payment-auth-service',
          level: 'ERROR',
          message: 'Task container payment-auth-v2 stop code: EssentialContainerExited, Exit Code 137 (OutOfMemoryError)',
        },
        {
          timestamp: tMinus(3),
          nodeId: 'node-alb-01',
          awsResourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/k8s-ingress-alb/1a2b3c',
          level: 'ERROR',
          message: 'Target.FailedHealthChecks: Registered target 10.0.12.84:8080 failed 3 consecutive HTTP /health checks (Status: 502 Bad Gateway)',
        },
      ],
      cloudTrailEvents60m: [
        {
          eventId: 'trail-evt-c1d2e3f4-5678-4901-abcd-ef0123456789',
          eventTime: tMinus(25),
          eventName: 'RegisterTaskDefinition',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:task-definition/payment-auth-service:48',
          userIdentity: 'github-actions-cd-bot',
          requestParameters: {
            family: 'payment-auth-service',
            cpu: '512',
            memory: '512', // Critical regression: reduced from 2048 to 512
            containerDefinitions: [
              {
                name: 'payment-auth',
                image: '123456789012.dkr.ecr.us-east-1.amazonaws.com/payment:v2.14.0',
                memoryReservation: 384,
              },
            ],
          },
        },
        {
          eventId: 'trail-evt-d2e3f4a5-6789-4012-bcde-f0123456789a',
          eventTime: tMinus(22),
          eventName: 'UpdateService',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/production-cluster/payment-auth-service',
          userIdentity: 'github-actions-cd-bot',
          requestParameters: {
            cluster: 'production-cluster',
            service: 'payment-auth-service',
            taskDefinition: 'payment-auth-service:48',
            forceNewDeployment: true,
          },
        },
      ],
      canvasGraph: ECS_CRASHLOOP_GRAPH,
    };
  }

  // 3. Security Group Drift
  private static generateSecurityGroupDrift(incidentId: string, triggeredAt: string): AlertPayload {
    const now = new Date(triggeredAt).getTime();
    const tMinus = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

    return {
      incidentId,
      triggeredAt,
      activeAlarms: [
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:config-restricted-common-ports',
          alarmName: 'AWSConfig-Rule-Restricted-Common-Ports-Drift',
          nodeId: 'node-sg-01',
          awsResourceId: 'sg-0a1b2c3d4e5f67890',
          metricName: 'ComplianceType',
          metricValue: 1, // 1 = NON_COMPLIANT
          threshold: 0,
          timestamp: tMinus(4),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:guardduty-unauthorized-access-portscan',
          alarmName: 'GuardDuty-Recon-EC2-Portscan',
          nodeId: 'node-sg-01',
          awsResourceId: 'sg-0a1b2c3d4e5f67890',
          metricName: 'FindingCount',
          metricValue: 14,
          threshold: 1,
          timestamp: tMinus(2),
        },
      ],
      cloudWatchLogs30m: [
        {
          timestamp: tMinus(18),
          nodeId: 'node-sg-01',
          awsResourceId: 'sg-0a1b2c3d4e5f67890',
          level: 'WARN',
          message: 'VPC Flow Logs: ACCEPT TCP 198.51.100.42:51234 -> 10.0.5.12:22 [SSH handshake initiated from unverified external CIDR]',
        },
        {
          timestamp: tMinus(11),
          nodeId: 'node-sg-01',
          awsResourceId: 'sg-0a1b2c3d4e5f67890',
          level: 'WARN',
          message: 'VPC Flow Logs: ACCEPT TCP 203.0.113.88:49210 -> 10.0.5.12:5432 [PostgreSQL handshake initiated from external internet]',
        },
        {
          timestamp: tMinus(8),
          nodeId: 'node-db-01',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:customer-pii-database',
          level: 'ERROR',
          message: 'pg_hba.conf rejected: no pg_hba.conf entry for host "203.0.113.88", user "postgres", database "customer_pii", SSL off',
        },
        {
          timestamp: tMinus(5),
          nodeId: 'node-db-01',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:customer-pii-database',
          level: 'FATAL',
          message: 'FATAL: password authentication failed for user "postgres" from client 203.0.113.88: brute-force dictionary attempt detected',
        },
      ],
      cloudTrailEvents60m: [
        {
          eventId: 'trail-evt-e3f4a5b6-7890-4123-cdef-0123456789ab',
          eventTime: tMinus(28),
          eventName: 'AuthorizeSecurityGroupIngress',
          awsResourceId: 'sg-0a1b2c3d4e5f67890',
          userIdentity: 'arn:aws:iam::123456789012:user/developer-quickfix-role',
          requestParameters: {
            groupId: 'sg-0a1b2c3d4e5f67890',
            ipPermissions: [
              {
                ipProtocol: 'tcp',
                fromPort: 22,
                toPort: 22,
                ipRanges: [{ cidrIp: '0.0.0.0/0', description: 'Emergency SSH debug - remove immediately' }],
              },
              {
                ipProtocol: 'tcp',
                fromPort: 5432,
                toPort: 5432,
                ipRanges: [{ cidrIp: '0.0.0.0/0', description: 'Temporary DB access for test' }],
              },
            ],
          },
        },
      ],
      canvasGraph: SECURITY_GROUP_DRIFT_GRAPH,
    };
  }

  // 4. API 5xx Timeouts
  private static generateApi5xxTimeouts(incidentId: string, triggeredAt: string): AlertPayload {
    const now = new Date(triggeredAt).getTime();
    const tMinus = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

    return {
      incidentId,
      triggeredAt,
      activeAlarms: [
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:alb-api-5xx-rate',
          alarmName: 'ALB-High-HTTP-5XXError-Rate',
          nodeId: 'node-alb-02',
          awsResourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/api-gateway-alb/987654',
          metricName: 'HTTPCode_Target_5XX_Count',
          metricValue: 1420,
          threshold: 50,
          timestamp: tMinus(2),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:alb-target-response-time',
          alarmName: 'ALB-TargetResponseTime-Exceeded',
          nodeId: 'node-alb-02',
          awsResourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/api-gateway-alb/987654',
          metricName: 'TargetResponseTime',
          metricValue: 3450.8,
          threshold: 3000.0,
          timestamp: tMinus(3),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:asg-max-capacity-capped',
          alarmName: 'ASG-GroupInServiceInstances-MaxCapacity',
          nodeId: 'node-lambda-02',
          awsResourceId: 'arn:aws:lambda:us-east-1:123456789012:function:CheckoutServiceFunction',
          metricName: 'ConcurrentExecutions',
          metricValue: 1000,
          threshold: 1000,
          timestamp: tMinus(4),
        },
      ],
      cloudWatchLogs30m: [
        {
          timestamp: tMinus(20),
          nodeId: 'node-lambda-02',
          awsResourceId: 'arn:aws:lambda:us-east-1:123456789012:function:CheckoutServiceFunction',
          level: 'WARN',
          message: 'Slow response from upstream CartTransactions table query (duration: 2780ms)',
        },
        {
          timestamp: tMinus(14),
          nodeId: 'node-lambda-02',
          awsResourceId: 'arn:aws:lambda:us-east-1:123456789012:function:CheckoutServiceFunction',
          level: 'TIMEOUT',
          message: 'Task timed out after 3.00 seconds. Function: CheckoutServiceFunction, RequestId: 4f1a2b3c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
        },
        {
          timestamp: tMinus(10),
          nodeId: 'node-lambda-02',
          awsResourceId: 'arn:aws:lambda:us-east-1:123456789012:function:CheckoutServiceFunction',
          level: 'TIMEOUT',
          message: 'Task timed out after 3.00 seconds. Function: CheckoutServiceFunction, RequestId: 8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d',
        },
        {
          timestamp: tMinus(7),
          nodeId: 'node-alb-02',
          awsResourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/api-gateway-alb/987654',
          level: 'ERROR',
          message: 'HTTP 504 Gateway Timeout: Target did not respond within timeout window of 3000ms. Client: 192.0.2.14',
        },
        {
          timestamp: tMinus(3),
          nodeId: 'node-cf-01',
          awsResourceId: 'arn:aws:cloudfront::123456789012:distribution/EDFDVBD6EXAMPLE',
          level: 'ERROR',
          message: 'CloudFront Origin Error: 504 Gateway Timeout received from Origin alb-api-gateway-alb-987654.us-east-1.elb.amazonaws.com',
        },
      ],
      cloudTrailEvents60m: [
        {
          eventId: 'trail-evt-f4a5b6c7-8901-4234-def0-123456789abc',
          eventTime: tMinus(50),
          eventName: 'PutScalingPolicy',
          awsResourceId: 'arn:aws:autoscaling:us-east-1:123456789012:autoScalingGroup:checkout-asg',
          userIdentity: 'infrastructure-cd-pipeline',
          requestParameters: {
            autoScalingGroupName: 'checkout-asg',
            policyName: 'scale-on-target-tracking',
            targetTrackingConfiguration: {
              targetValue: 80.0,
              predefinedMetricSpecification: { predefinedMetricType: 'ASGAverageCPUUtilization' },
            },
            maxCapacity: 10, // Max size limit hit during unexpected flash sale traffic spike
          },
        },
      ],
      canvasGraph: API_5XX_TIMEOUT_GRAPH,
    };
  }

  // 5. FinOps Idle Waste
  private static generateFinOpsIdleWaste(incidentId: string, triggeredAt: string): AlertPayload {
    const now = new Date(triggeredAt).getTime();
    const tMinus = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

    return {
      incidentId,
      triggeredAt,
      activeAlarms: [
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:finops-ebs-zero-iops-7days',
          alarmName: 'FinOps-EBS-Zero-IOPS-Unattached',
          nodeId: 'node-ebs-01',
          awsResourceId: 'vol-09a8bc7d6e5f4a123',
          metricName: 'VolumeTotalReadWriteOps',
          metricValue: 0,
          threshold: 0,
          timestamp: tMinus(5),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:finops-natgw-zero-bytes-destination',
          alarmName: 'FinOps-NATGW-Idle-BytesOutZero',
          nodeId: 'node-nat-01',
          awsResourceId: 'nat-01ab23cd45ef67890',
          metricName: 'BytesOutToDestination',
          metricValue: 0,
          threshold: 0,
          timestamp: tMinus(8),
        },
      ],
      cloudWatchLogs30m: [
        {
          timestamp: tMinus(25),
          nodeId: 'node-ebs-01',
          awsResourceId: 'vol-09a8bc7d6e5f4a123',
          level: 'WARN',
          message: 'AWS Cost Anomaly Detection: Anomaly detected on EBS Provisioned IOPS Volume vol-09a8bc7d6e5f4a123. Unattached for 168 consecutive hours ($125.00/mo waste).',
        },
        {
          timestamp: tMinus(18),
          nodeId: 'node-nat-01',
          awsResourceId: 'nat-01ab23cd45ef67890',
          level: 'WARN',
          message: 'AWS Trusted Advisor Notification: Idle NAT Gateway nat-01ab23cd45ef67890 processed 0 bytes in the past 7 days while incurring hourly base fee ($32.40/mo waste).',
        },
        {
          timestamp: tMinus(5),
          nodeId: 'node-ebs-01',
          awsResourceId: 'vol-09a8bc7d6e5f4a123',
          level: 'WARN',
          message: 'FinOps Metric Alert: Resource state remains "available" (unattached). Immediate remediation candidate: Take final snapshot and delete volume.',
        },
      ],
      cloudTrailEvents60m: [
        {
          eventId: 'trail-evt-05a6b7c8-9012-4345-ef01-23456789abcd',
          eventTime: tMinus(58),
          eventName: 'DetachVolume',
          awsResourceId: 'vol-09a8bc7d6e5f4a123',
          userIdentity: 'arn:aws:iam::123456789012:user/qa-tester',
          requestParameters: {
            volumeId: 'vol-09a8bc7d6e5f4a123',
            instanceId: 'i-0987654321fedcba0',
            device: '/dev/xvdf',
            force: false,
          },
        },
      ],
      canvasGraph: FINOPS_IDLE_WASTE_GRAPH,
    };
  }

  // 6. Cascading Retry Storm & Thundering Herd
  private static generateRetryStormThunderingHerd(incidentId: string, triggeredAt: string): AlertPayload {
    const now = new Date(triggeredAt).getTime();
    const tMinus = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

    return {
      incidentId,
      triggeredAt,
      activeAlarms: [
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:payment-vault-throttled-429',
          alarmName: 'PaymentVault-ThrottledRequests-Critical',
          nodeId: 'node-payment-vault',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/ecommerce-cluster/payment-token-vault',
          metricName: 'ThrottledRequests',
          metricValue: 42800,
          threshold: 100,
          timestamp: tMinus(4),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:checkout-503-service-unavailable',
          alarmName: 'Checkout-503-ServiceUnavailable-Spike',
          nodeId: 'node-checkout-svc',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/ecommerce-cluster/checkout-service',
          metricName: '5XXError',
          metricValue: 78.4,
          threshold: 5.0,
          timestamp: tMinus(2),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:edge-ingress-504-timeout',
          alarmName: 'Edge-HTTP-504-GatewayTimeout',
          nodeId: 'node-api-edge',
          awsResourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/api-edge-proxy/55aa66bb',
          metricName: 'HTTPCode_Target_5XX_Count',
          metricValue: 14200,
          threshold: 50,
          timestamp: tMinus(1),
        },
      ],
      cloudWatchLogs30m: [
        {
          timestamp: tMinus(12),
          nodeId: 'node-payment-vault',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/ecommerce-cluster/payment-token-vault',
          level: 'FATAL',
          message: 'upstream HTTP 429 Too Many Requests: token bucket rate limit exhausted. Throttling 42,800 callers/min. Immediate retry attempt 7/10 failed without jitter.',
        },
        {
          timestamp: tMinus(8),
          nodeId: 'node-checkout-svc',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/ecommerce-cluster/checkout-service',
          level: 'ERROR',
          message: 'envoy.circuit_breaker: connection pool overflow, pending requests 1284 exceeded max_pending_requests 100. Circuit open required.',
        },
        {
          timestamp: tMinus(3),
          nodeId: 'node-checkout-svc',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/ecommerce-cluster/checkout-service',
          level: 'WARN',
          message: 'retry_storm_detected: concurrent retry amplification factor = 8.4x upstream load. Scaling instances will worsen upstream thundering herd.',
        },
      ],
      cloudTrailEvents60m: [
        {
          eventId: 'trail-evt-retry-storm-01',
          eventTime: tMinus(22),
          eventName: 'UpdateService',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/ecommerce-cluster/checkout-service',
          userIdentity: 'arn:aws:iam::123456789012:user/release-pipeline',
          requestParameters: {
            serviceName: 'checkout-service',
            clientRetryStrategy: 'AGGRESSIVE_FIXED_50MS',
            circuitBreakerEnabled: false,
          },
        },
      ],
      canvasGraph: RETRY_STORM_GRAPH,
    };
  }

  // 7. Database Row Deadlock & Lock Contention Storm
  private static generateDatabaseDeadlockContention(incidentId: string, triggeredAt: string): AlertPayload {
    const now = new Date(triggeredAt).getTime();
    const tMinus = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

    return {
      incidentId,
      triggeredAt,
      activeAlarms: [
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:aurora-deadlock-contention-critical',
          alarmName: 'Aurora-DeadlockContention-High',
          nodeId: 'node-aurora-deadlock-db',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-inventory-cluster',
          metricName: 'Deadlocks',
          metricValue: 342,
          threshold: 1,
          timestamp: tMinus(5),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:order-workers-transaction-timeout',
          alarmName: 'Worker-TransactionTimeout-504',
          nodeId: 'node-order-workers',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/orders-cluster/order-processor-fleet',
          metricName: 'TaskTimeouts',
          metricValue: 890,
          threshold: 5,
          timestamp: tMinus(3),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:order-apigw-504-gateway-timeout',
          alarmName: 'OrderApi-504GatewayTimeout',
          nodeId: 'node-orders-apigw',
          awsResourceId: 'arn:aws:apigateway:us-east-1::/restapis/order-ingest-api/stages/prod',
          metricName: '5XXError',
          metricValue: 64.2,
          threshold: 5.0,
          timestamp: tMinus(1),
        },
      ],
      cloudWatchLogs30m: [
        {
          timestamp: tMinus(15),
          nodeId: 'node-aurora-deadlock-db',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-inventory-cluster',
          level: 'FATAL',
          message: 'postgres: ERROR: deadlock detected. Process 21044 waits for ExclusiveLock on tuple (14, 2) of relation "inventory"; Process 21088 waits for ShareLock on transaction 98401.',
        },
        {
          timestamp: tMinus(10),
          nodeId: 'node-aurora-deadlock-db',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-inventory-cluster',
          level: 'ERROR',
          message: 'pg_stat_activity: 488 of 500 sessions waiting in state "ClientRead" / "Lock:tuple" exceeding transaction timeout. CPU at 6% (pure row contention).',
        },
        {
          timestamp: tMinus(4),
          nodeId: 'node-order-workers',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/orders-cluster/order-processor-fleet',
          level: 'WARN',
          message: 'application_error: query timed out after 30000ms while acquiring row lock for SKU IPHONE-16-PRO. Scaling RDS instance will not resolve row locking.',
        },
      ],
      cloudTrailEvents60m: [
        {
          eventId: 'trail-evt-deadlock-01',
          eventTime: tMinus(35),
          eventName: 'ModifyDBParameterGroup',
          awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-inventory-cluster',
          userIdentity: 'arn:aws:iam::123456789012:user/db-admin',
          requestParameters: {
            DBParameterGroupName: 'pg15-inventory-params',
            Parameters: [
              { ParameterName: 'lock_timeout', ParameterValue: '0', ApplyMethod: 'immediate' },
            ],
          },
        },
      ],
      canvasGraph: DATABASE_DEADLOCK_GRAPH,
    };
  }

  // 8. VPC Route53 DNS Resolution Starvation (1024 UDP pkt/s ENI Cap)
  private static generateVpcDnsStarvation(incidentId: string, triggeredAt: string): AlertPayload {
    const now = new Date(triggeredAt).getTime();
    const tMinus = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

    return {
      incidentId,
      triggeredAt,
      activeAlarms: [
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:vpc-dns-eni-packet-drop-critical',
          alarmName: 'VPC-ENI-DNS-PacketDrop-Exhaustion',
          nodeId: 'node-vpc-dns-resolver',
          awsResourceId: 'arn:aws:route53resolver:us-east-1:123456789012:rni/rni-vpc-core-resolver',
          metricName: 'LinkLocalPacketDrops',
          metricValue: 4890,
          threshold: 0,
          timestamp: tMinus(6),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:mesh-microservice-dns-timeout',
          alarmName: 'Microservices-DnsLookupTimeout-Spike',
          nodeId: 'node-mesh-microservices',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/mesh-cluster/core-microservices',
          metricName: 'DnsResolutionLatencyMs',
          metricValue: 5200,
          threshold: 100,
          timestamp: tMinus(3),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:ingress-502-bad-gateway',
          alarmName: 'Ingress-HTTP-502-BadGateway',
          nodeId: 'node-k8s-ingress',
          awsResourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/k8s-core-ingress/8899aabb',
          metricName: 'HTTP502Rate',
          metricValue: 52.8,
          threshold: 1.0,
          timestamp: tMinus(1),
        },
      ],
      cloudWatchLogs30m: [
        {
          timestamp: tMinus(14),
          nodeId: 'node-mesh-microservices',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/mesh-cluster/core-microservices',
          level: 'FATAL',
          message: 'nodejs: Error: getaddrinfo EAI_AGAIN catalog.internal.prod:5432 after 5002ms timeout. DNS resolution failed across 18 worker tasks.',
        },
        {
          timestamp: tMinus(9),
          nodeId: 'node-vpc-dns-resolver',
          awsResourceId: 'arn:aws:route53resolver:us-east-1:123456789012:rni/rni-vpc-core-resolver',
          level: 'ERROR',
          message: 'kernel: [eni-048c9a1b] link-local 169.254.169.253 / 10.0.0.2 UDP packet rate exceeded 1024 pkts/sec limit. 4,890 packets dropped.',
        },
        {
          timestamp: tMinus(2),
          nodeId: 'node-mesh-microservices',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/mesh-cluster/core-microservices',
          level: 'WARN',
          message: 'kube-dns: upstream nameserver 10.0.0.2:53 timeout; query retries exhausted. NodeLocal DNSCache DaemonSet required to eliminate ENI packet throttling.',
        },
      ],
      cloudTrailEvents60m: [
        {
          eventId: 'trail-evt-dns-01',
          eventTime: tMinus(28),
          eventName: 'CreateService',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/mesh-cluster/core-microservices',
          userIdentity: 'arn:aws:iam::123456789012:user/platform-deployer',
          requestParameters: {
            serviceName: 'core-microservices',
            desiredCount: 60,
            enableDnsCache: false,
          },
        },
      ],
      canvasGraph: VPC_DNS_STARVATION_GRAPH,
    };
  }

  // 9. Poison Pill Queue Consumer CrashLoop
  private static generateSqsPoisonPillCrashloop(incidentId: string, triggeredAt: string): AlertPayload {
    const now = new Date(triggeredAt).getTime();
    const tMinus = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

    return {
      incidentId,
      triggeredAt,
      activeAlarms: [
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:sqs-payment-events-toxic-retries',
          alarmName: 'SQS-MessageAge-And-ToxicRetries',
          nodeId: 'node-sqs-payment-events',
          awsResourceId: 'arn:aws:sqs:us-east-1:123456789012:payment-events-queue',
          metricName: 'ApproximateAgeOfOldestMessage',
          metricValue: 18400,
          threshold: 300,
          timestamp: tMinus(8),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:ecs-ledger-workers-crashloop',
          alarmName: 'ECS-Worker-CrashLoop-ExitCode1',
          nodeId: 'node-ecs-queue-consumers',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/payments-cluster/ledger-worker-task',
          metricName: 'TaskStopCount',
          metricValue: 48,
          threshold: 3,
          timestamp: tMinus(3),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:producer-lambda-dlq-missing',
          alarmName: 'Producer-Queue-Healthy-Throughput-Zero',
          nodeId: 'node-event-producer',
          awsResourceId: 'arn:aws:lambda:us-east-1:123456789012:function:PaymentEventProducer',
          metricName: 'Errors',
          metricValue: 0,
          threshold: 10,
          timestamp: tMinus(1),
        },
      ],
      cloudWatchLogs30m: [
        {
          timestamp: tMinus(20),
          nodeId: 'node-ecs-queue-consumers',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/payments-cluster/ledger-worker-task',
          level: 'FATAL',
          message: 'worker: Uncaught Exception: TypeError: Cannot read property amount_cents of undefined at processTransaction (processor.js:142). Task exited with code 1.',
        },
        {
          timestamp: tMinus(12),
          nodeId: 'node-sqs-payment-events',
          awsResourceId: 'arn:aws:sqs:us-east-1:123456789012:payment-events-queue',
          level: 'ERROR',
          message: 'sqs_consumer: Message ID 4b8d7e2-toxic-payload received 46 times without acknowledgment. Visibility timeout expired, redelivering toxic message to next worker.',
        },
        {
          timestamp: tMinus(4),
          nodeId: 'node-ecs-queue-consumers',
          awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/payments-cluster/ledger-worker-task',
          level: 'WARN',
          message: 'container: 12 of 12 worker tasks repeatedly killed by poison pill payload. Scaling ECS tasks crashes new containers immediately. Dead-letter queue required.',
        },
      ],
      cloudTrailEvents60m: [
        {
          eventId: 'trail-evt-sqs-poison-01',
          eventTime: tMinus(42),
          eventName: 'SendMessage',
          awsResourceId: 'arn:aws:sqs:us-east-1:123456789012:payment-events-queue',
          userIdentity: 'arn:aws:iam::123456789012:user/legacy-integration-partner',
          requestParameters: {
            queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/payment-events-queue',
            messageBody: '{"schemaVersion": "v0.1-corrupt", "payload": null}',
          },
        },
      ],
      canvasGraph: SQS_POISON_PILL_GRAPH,
    };
  }

  // 10. VPC Subnet IP Address Exhaustion
  private static generateSubnetIpExhaustion(incidentId: string, triggeredAt: string): AlertPayload {
    const now = new Date(triggeredAt).getTime();
    const tMinus = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

    return {
      incidentId,
      triggeredAt,
      activeAlarms: [
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:subnet-available-ips-zero',
          alarmName: 'VPC-Subnet-AvailableIP-Zero',
          nodeId: 'node-subnet-exhausted',
          awsResourceId: 'subnet-0987654321fedcba0',
          metricName: 'AvailableIpAddressCount',
          metricValue: 0,
          threshold: 10,
          timestamp: tMinus(7),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:asg-launch-failure-insufficient-ips',
          alarmName: 'ASG-EC2-LaunchFailure-Spike',
          nodeId: 'node-asg-scale-fleet',
          awsResourceId: 'arn:aws:autoscaling:us-east-1:123456789012:autoScalingGroup:asg-prod-app-fleet',
          metricName: 'SuccessfulInstances',
          metricValue: 0,
          threshold: 10,
          timestamp: tMinus(4),
        },
        {
          alarmId: 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:vpc-allocation-halt',
          alarmName: 'VPC-Subnet-AllocationHalt',
          nodeId: 'node-vpc-enterprise',
          awsResourceId: 'vpc-0789abcdef0123456',
          metricName: 'SubnetStatus',
          metricValue: 1,
          threshold: 0,
          timestamp: tMinus(1),
        },
      ],
      cloudWatchLogs30m: [
        {
          timestamp: tMinus(18),
          nodeId: 'node-subnet-exhausted',
          awsResourceId: 'subnet-0987654321fedcba0',
          level: 'FATAL',
          message: 'ec2.amazonaws.com: InsufficientFreeAddressesInSubnet - The subnet subnet-0987654321fedcba0 has 0 available IP addresses. All 251 addresses allocated.',
        },
        {
          timestamp: tMinus(11),
          nodeId: 'node-asg-scale-fleet',
          awsResourceId: 'arn:aws:autoscaling:us-east-1:123456789012:autoScalingGroup:asg-prod-app-fleet',
          level: 'ERROR',
          message: 'autoscaling: Launching a new EC2 instance failed with Client.InsufficientFreeAddressesInSubnet. Desired capacity 40 cannot be fulfilled.',
        },
        {
          timestamp: tMinus(3),
          nodeId: 'node-asg-scale-fleet',
          awsResourceId: 'arn:aws:autoscaling:us-east-1:123456789012:autoScalingGroup:asg-prod-app-fleet',
          level: 'WARN',
          message: 'aws-node-cni: failed to allocate ENI IP: no free private IP addresses available in subnet. Associate secondary VPC CIDR block (100.64.0.0/16) to remediate.',
        },
      ],
      cloudTrailEvents60m: [
        {
          eventId: 'trail-evt-subnet-ip-01',
          eventTime: tMinus(48),
          eventName: 'CreateNetworkInterface',
          awsResourceId: 'subnet-0987654321fedcba0',
          userIdentity: 'arn:aws:iam::123456789012:user/ci-cd-runner',
          requestParameters: {
            subnetId: 'subnet-0987654321fedcba0',
            description: 'Automated CI/CD ephemeral test runner ENI allocation',
          },
        },
      ],
      canvasGraph: SUBNET_IP_EXHAUSTION_GRAPH,
    };
  }
}
