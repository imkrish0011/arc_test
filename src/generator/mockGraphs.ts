import type { CanvasGraph } from '../types/alertPayload.js';

export const RDS_BOTTLENECK_GRAPH: CanvasGraph = {
  nodes: [
    {
      id: 'node-apigw-01',
      type: 'apiGateway',
      awsResourceId: 'arn:aws:apigateway:us-east-1::/restapis/agw-prod-order/stages/prod',
      data: {
        label: 'Order API Gateway',
        category: 'network',
        icon: 'network',
        instances: 1,
        healthStatus: 'warning',
      },
    },
    {
      id: 'node-lambda-01',
      type: 'lambda',
      awsResourceId: 'arn:aws:lambda:us-east-1:123456789012:function:OrderProcessingService',
      data: {
        label: 'Order Lambda Service',
        category: 'compute',
        icon: 'cpu',
        instances: 25,
        healthStatus: 'critical',
      },
    },
    {
      id: 'node-rds-01',
      type: 'rds',
      awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-orders-primary',
      data: {
        label: 'Aurora Postgres Orders DB',
        category: 'storage',
        icon: 'database',
        instances: 1,
        engine: 'aurora-postgresql',
        healthStatus: 'critical',
      },
    },
  ],
  edges: [
    { id: 'edge-agw-to-lambda', source: 'node-apigw-01', target: 'node-lambda-01' },
    { id: 'edge-lambda-to-rds', source: 'node-lambda-01', target: 'node-rds-01' },
  ],
};

export const ECS_CRASHLOOP_GRAPH: CanvasGraph = {
  nodes: [
    {
      id: 'node-alb-01',
      type: 'alb',
      awsResourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/k8s-ingress-alb/1a2b3c',
      data: {
        label: 'Core Ingress ALB',
        category: 'network',
        icon: 'network',
        healthStatus: 'warning',
      },
    },
    {
      id: 'node-ecs-01',
      type: 'ecs',
      awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/production-cluster/payment-auth-service',
      data: {
        label: 'Payment Auth Microservice (ECS/EKS)',
        category: 'compute',
        icon: 'box',
        desiredCount: 6,
        runningCount: 1,
        healthStatus: 'critical',
      },
    },
    {
      id: 'node-elasticache-01',
      type: 'elasticache',
      awsResourceId: 'arn:aws:elasticache:us-east-1:123456789012:cluster:redis-session-store',
      data: {
        label: 'Redis Session Store',
        category: 'storage',
        icon: 'database',
        healthStatus: 'healthy',
      },
    },
  ],
  edges: [
    { id: 'edge-alb-to-ecs', source: 'node-alb-01', target: 'node-ecs-01' },
    { id: 'edge-ecs-to-redis', source: 'node-ecs-01', target: 'node-elasticache-01' },
  ],
};

export const SECURITY_GROUP_DRIFT_GRAPH: CanvasGraph = {
  nodes: [
    {
      id: 'node-internet-gw',
      type: 'internetGateway',
      awsResourceId: 'igw-0987654321fedcba0',
      data: {
        label: 'Public Internet Gateway (0.0.0.0/0)',
        category: 'boundary',
        icon: 'globe',
        healthStatus: 'healthy',
      },
    },
    {
      id: 'node-sg-01',
      type: 'securityGroup',
      awsResourceId: 'sg-0a1b2c3d4e5f67890',
      data: {
        label: 'Database Security Group (sg-db-prod)',
        category: 'security',
        icon: 'shield-alert',
        insecurePortsOpen: [22, 5432],
        healthStatus: 'critical',
      },
    },
    {
      id: 'node-db-01',
      type: 'rds',
      awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:customer-pii-database',
      data: {
        label: 'Customer PII Database',
        category: 'storage',
        icon: 'database',
        healthStatus: 'critical',
      },
    },
  ],
  edges: [
    { id: 'edge-igw-to-sg', source: 'node-internet-gw', target: 'node-sg-01' },
    { id: 'edge-sg-to-db', source: 'node-sg-01', target: 'node-db-01' },
  ],
};

export const API_5XX_TIMEOUT_GRAPH: CanvasGraph = {
  nodes: [
    {
      id: 'node-cf-01',
      type: 'cloudFront',
      awsResourceId: 'arn:aws:cloudfront::123456789012:distribution/EDFDVBD6EXAMPLE',
      data: {
        label: 'Global CDN (CloudFront)',
        category: 'network',
        icon: 'globe',
        healthStatus: 'warning',
      },
    },
    {
      id: 'node-alb-02',
      type: 'alb',
      awsResourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/api-gateway-alb/987654',
      data: {
        label: 'Public API Load Balancer',
        category: 'network',
        icon: 'network',
        healthStatus: 'critical',
      },
    },
    {
      id: 'node-lambda-02',
      type: 'lambda',
      awsResourceId: 'arn:aws:lambda:us-east-1:123456789012:function:CheckoutServiceFunction',
      data: {
        label: 'Checkout Lambda Handler',
        category: 'compute',
        icon: 'cpu',
        timeoutSeconds: 3,
        healthStatus: 'critical',
      },
    },
    {
      id: 'node-dynamo-01',
      type: 'dynamodb',
      awsResourceId: 'arn:aws:dynamodb:us-east-1:123456789012:table/CartTransactions',
      data: {
        label: 'CartTransactions DynamoDB',
        category: 'storage',
        icon: 'database',
        healthStatus: 'healthy',
      },
    },
  ],
  edges: [
    { id: 'edge-cf-to-alb', source: 'node-cf-01', target: 'node-alb-02' },
    { id: 'edge-alb-to-lambda', source: 'node-alb-02', target: 'node-lambda-02' },
    { id: 'edge-lambda-to-dynamo', source: 'node-lambda-02', target: 'node-dynamo-01' },
  ],
};

export const FINOPS_IDLE_WASTE_GRAPH: CanvasGraph = {
  nodes: [
    {
      id: 'node-nat-01',
      type: 'natGateway',
      awsResourceId: 'nat-01ab23cd45ef67890',
      data: {
        label: 'Orphaned Staging NAT Gateway',
        category: 'network',
        icon: 'network',
        bytesOut7Days: 0,
        hourlyCost: 0.045,
        healthStatus: 'warning',
      },
    },
    {
      id: 'node-ebs-01',
      type: 'ebs',
      awsResourceId: 'vol-09a8bc7d6e5f4a123',
      data: {
        label: 'Unattached io2 EBS Volume (500GB)',
        category: 'storage',
        icon: 'hard-drive',
        status: 'available',
        activeIops7Days: 0,
        monthlyWasteCost: 125.0,
        healthStatus: 'warning',
      },
    },
    {
      id: 'node-vpc-legacy',
      type: 'vpc',
      awsResourceId: 'vpc-0e7d4c2b1a9f8e3d0',
      data: {
        label: 'Decommissioned Staging VPC',
        category: 'boundary',
        icon: 'box',
        healthStatus: 'warning',
      },
    },
  ],
  edges: [
    { id: 'edge-vpc-to-nat', source: 'node-vpc-legacy', target: 'node-nat-01' },
    { id: 'edge-vpc-to-ebs', source: 'node-vpc-legacy', target: 'node-ebs-01' },
  ],
};
