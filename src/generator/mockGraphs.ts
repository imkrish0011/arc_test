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

export const RETRY_STORM_GRAPH: CanvasGraph = {
  nodes: [
    {
      id: 'node-api-edge',
      type: 'alb',
      awsResourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/api-edge-proxy/55aa66bb',
      data: {
        label: 'Edge Gateway / Ingress ALB',
        category: 'network',
        icon: 'network',
        healthStatus: 'warning',
      },
    },
    {
      id: 'node-checkout-svc',
      type: 'ecs',
      awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/ecommerce-cluster/checkout-service',
      data: {
        label: 'Checkout Service (Fargate)',
        category: 'compute',
        icon: 'box',
        desiredCount: 20,
        runningCount: 20,
        healthStatus: 'critical',
      },
    },
    {
      id: 'node-auth-redis',
      type: 'elasticache',
      awsResourceId: 'arn:aws:elasticache:us-east-1:123456789012:cluster:auth-token-redis',
      data: {
        label: 'Auth Token Redis Cache',
        category: 'storage',
        icon: 'database',
        healthStatus: 'warning',
      },
    },
    {
      id: 'node-payment-vault',
      type: 'ecs',
      awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/ecommerce-cluster/payment-token-vault',
      data: {
        label: 'Payment Token Vault API',
        category: 'compute',
        icon: 'box',
        healthStatus: 'critical',
      },
    },
  ],
  edges: [
    { id: 'edge-edge-to-checkout', source: 'node-api-edge', target: 'node-checkout-svc' },
    { id: 'edge-checkout-to-redis', source: 'node-checkout-svc', target: 'node-auth-redis' },
    { id: 'edge-checkout-to-payment', source: 'node-checkout-svc', target: 'node-payment-vault' },
  ],
};

export const DATABASE_DEADLOCK_GRAPH: CanvasGraph = {
  nodes: [
    {
      id: 'node-orders-apigw',
      type: 'apiGateway',
      awsResourceId: 'arn:aws:apigateway:us-east-1::/restapis/order-ingest-api/stages/prod',
      data: {
        label: 'Orders Ingest API Gateway',
        category: 'network',
        icon: 'network',
        healthStatus: 'warning',
      },
    },
    {
      id: 'node-order-workers',
      type: 'ecs',
      awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/orders-cluster/order-processor-fleet',
      data: {
        label: 'Parallel Order Workers Fleet',
        category: 'compute',
        icon: 'box',
        desiredCount: 30,
        runningCount: 30,
        healthStatus: 'critical',
      },
    },
    {
      id: 'node-aurora-deadlock-db',
      type: 'rds',
      awsResourceId: 'arn:aws:rds:us-east-1:123456789012:db:aurora-pg-inventory-cluster',
      data: {
        label: 'Aurora Postgres Inventory DB',
        category: 'storage',
        icon: 'database',
        engine: 'aurora-postgresql',
        healthStatus: 'critical',
      },
    },
  ],
  edges: [
    { id: 'edge-apigw-to-workers', source: 'node-orders-apigw', target: 'node-order-workers' },
    { id: 'edge-workers-to-db', source: 'node-order-workers', target: 'node-aurora-deadlock-db' },
  ],
};

export const VPC_DNS_STARVATION_GRAPH: CanvasGraph = {
  nodes: [
    {
      id: 'node-k8s-ingress',
      type: 'alb',
      awsResourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/k8s-core-ingress/8899aabb',
      data: {
        label: 'K8s Cluster Ingress ALB',
        category: 'network',
        icon: 'network',
        healthStatus: 'warning',
      },
    },
    {
      id: 'node-mesh-microservices',
      type: 'ecs',
      awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/mesh-cluster/core-microservices',
      data: {
        label: 'High-Density Mesh Microservices',
        category: 'compute',
        icon: 'box',
        healthStatus: 'critical',
      },
    },
    {
      id: 'node-vpc-dns-resolver',
      type: 'vpc',
      awsResourceId: 'arn:aws:route53resolver:us-east-1:123456789012:rni/rni-vpc-core-resolver',
      data: {
        label: 'AWS VPC AmazonProvidedDNS (.2)',
        category: 'boundary',
        icon: 'globe',
        healthStatus: 'critical',
      },
    },
  ],
  edges: [
    { id: 'edge-ingress-to-mesh', source: 'node-k8s-ingress', target: 'node-mesh-microservices' },
    { id: 'edge-mesh-to-dns', source: 'node-mesh-microservices', target: 'node-vpc-dns-resolver' },
  ],
};

export const SQS_POISON_PILL_GRAPH: CanvasGraph = {
  nodes: [
    {
      id: 'node-event-producer',
      type: 'lambda',
      awsResourceId: 'arn:aws:lambda:us-east-1:123456789012:function:PaymentEventProducer',
      data: {
        label: 'Payment Event Producer',
        category: 'compute',
        icon: 'cpu',
        healthStatus: 'healthy',
      },
    },
    {
      id: 'node-sqs-payment-events',
      type: 'sqs',
      awsResourceId: 'arn:aws:sqs:us-east-1:123456789012:payment-events-queue',
      data: {
        label: 'SQS Payment Events Queue',
        category: 'storage',
        icon: 'database',
        healthStatus: 'critical',
      },
    },
    {
      id: 'node-ecs-queue-consumers',
      type: 'ecs',
      awsResourceId: 'arn:aws:ecs:us-east-1:123456789012:service/payments-cluster/ledger-worker-task',
      data: {
        label: 'ECS Ledger Queue Workers',
        category: 'compute',
        icon: 'box',
        desiredCount: 12,
        runningCount: 0,
        healthStatus: 'critical',
      },
    },
  ],
  edges: [
    { id: 'edge-producer-to-sqs', source: 'node-event-producer', target: 'node-sqs-payment-events' },
    { id: 'edge-sqs-to-consumers', source: 'node-sqs-payment-events', target: 'node-ecs-queue-consumers' },
  ],
};

export const SUBNET_IP_EXHAUSTION_GRAPH: CanvasGraph = {
  nodes: [
    {
      id: 'node-vpc-enterprise',
      type: 'vpc',
      awsResourceId: 'vpc-0789abcdef0123456',
      data: {
        label: 'Production Enterprise VPC (10.0.0.0/16)',
        category: 'boundary',
        icon: 'box',
        healthStatus: 'warning',
      },
    },
    {
      id: 'node-subnet-exhausted',
      type: 'subnet',
      awsResourceId: 'subnet-0987654321fedcba0',
      data: {
        label: 'Private App Subnet 1A (10.0.1.0/24)',
        category: 'boundary',
        icon: 'box',
        healthStatus: 'critical',
      },
    },
    {
      id: 'node-asg-scale-fleet',
      type: 'asg',
      awsResourceId: 'arn:aws:autoscaling:us-east-1:123456789012:autoScalingGroup:asg-prod-app-fleet',
      data: {
        label: 'Production ASG Fleet (Launch Suspended)',
        category: 'compute',
        icon: 'cpu',
        desiredCapacity: 40,
        runningCount: 16,
        healthStatus: 'critical',
      },
    },
  ],
  edges: [
    { id: 'edge-vpc-to-subnet', source: 'node-vpc-enterprise', target: 'node-subnet-exhausted' },
    { id: 'edge-subnet-to-asg', source: 'node-subnet-exhausted', target: 'node-asg-scale-fleet' },
  ],
};
