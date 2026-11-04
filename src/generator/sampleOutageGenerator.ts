import type { AlertPayload } from '../types/alertPayload.js';
import {
  RDS_BOTTLENECK_GRAPH,
  ECS_CRASHLOOP_GRAPH,
  SECURITY_GROUP_DRIFT_GRAPH,
  API_5XX_TIMEOUT_GRAPH,
  FINOPS_IDLE_WASTE_GRAPH,
} from './mockGraphs.js';

export type ScenarioType =
  | 'rds_bottleneck'
  | 'container_crashloop'
  | 'security_group_drift'
  | 'api_5xx_timeouts'
  | 'finops_idle_waste';

export class SampleOutageGenerator {
  /**
   * Generates a complete AlertPayload matching the exact contract
   * for any of the 5 AWS outage scenarios.
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
}
