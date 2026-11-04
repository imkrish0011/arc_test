import type { CanvasGraph, CanvasGraphNode, CanvasGraphEdge } from '../types/alertPayload.js';
import { AwsCredentialManager } from './credentials.js';

export interface AwsDiscoveryResult {
  vpcs: Array<{ id: string; cidr: string; name?: string }>;
  subnets: Array<{ id: string; vpcId: string; cidr: string; az: string; name?: string }>;
  instances: Array<{ id: string; type: string; subnetId: string; vpcId: string; state: string; name?: string }>;
  databases: Array<{ id: string; engine: string; instanceClass: string; status: string; multiAz: boolean }>;
  loadBalancers: Array<{ arn: string; name: string; dnsName: string; type: string; vpcId?: string }>;
  canvasGraph: CanvasGraph;
  isSimulated: boolean;
}

/**
 * Transforms discovered AWS resources into ArchViz canvas graph format:
 * nodes: [{ id, type, awsResourceId, data }]
 * edges: [{ id, source, target }]
 */
export function buildCanvasGraphFromResources(
  resources: {
    vpcs?: any[];
    subnets?: any[];
    instances?: any[];
    databases?: any[];
    loadBalancers?: any[];
  }
): CanvasGraph {
  const nodes: CanvasGraphNode[] = [];
  const edges: CanvasGraphEdge[] = [];

  const vpcs = resources.vpcs || [];
  const subnets = resources.subnets || [];
  const instances = resources.instances || [];
  const databases = resources.databases || [];
  const lbs = resources.loadBalancers || [];

  // 1. VPC Nodes
  vpcs.forEach((vpc, idx) => {
    const vpcId = vpc.VpcId || vpc.id || `vpc-${idx + 1}`;
    const name = vpc.Tags?.find((t: any) => t.Key === 'Name')?.Value || vpc.name || vpcId;
    nodes.push({
      id: `node-vpc-${idx + 1}`,
      type: 'vpc',
      awsResourceId: vpcId,
      data: {
        label: name,
        cidr: vpc.CidrBlock || vpc.cidr,
        category: 'boundary',
      },
    });
  });

  // 2. Load Balancer Nodes
  lbs.forEach((lb, idx) => {
    const lbArn = lb.LoadBalancerArn || lb.arn || `arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/alb-${idx + 1}`;
    const name = lb.LoadBalancerName || lb.name || `alb-${idx + 1}`;
    const lbNodeId = `node-alb-${idx + 1}`;
    nodes.push({
      id: lbNodeId,
      type: 'alb',
      awsResourceId: lbArn,
      data: {
        label: name,
        dnsName: lb.DNSName || lb.dnsName,
        category: 'network',
      },
    });
  });

  // 3. Compute / EC2 / ECS Nodes
  instances.forEach((inst, idx) => {
    const instId = inst.InstanceId || inst.id || `i-0a8f9c1b2d3e4f50${idx + 1}`;
    const name = inst.Tags?.find((t: any) => t.Key === 'Name')?.Value || inst.name || instId;
    const instNodeId = `node-app-${idx + 1}`;
    nodes.push({
      id: instNodeId,
      type: 'ec2',
      awsResourceId: instId,
      data: {
        label: name,
        instanceType: inst.InstanceType || inst.type || 'm5.large',
        category: 'compute',
      },
    });

    // Connect ALB to App Instances
    if (nodes.some(n => n.type === 'alb')) {
      const albNode = nodes.find(n => n.type === 'alb')!;
      edges.push({
        id: `edge-${albNode.id}-${instNodeId}`,
        source: albNode.id,
        target: instNodeId,
      });
    }
  });

  // 4. RDS Database Nodes
  databases.forEach((db, idx) => {
    const dbId = db.DBInstanceIdentifier || db.id || `aurora-db-primary-${idx + 1}`;
    const dbNodeId = `node-rds-${idx + 1}`;
    nodes.push({
      id: dbNodeId,
      type: 'rds',
      awsResourceId: dbId,
      data: {
        label: dbId,
        engine: db.Engine || db.engine || 'postgres',
        instanceClass: db.DBInstanceClass || db.instanceClass || 'db.r6g.large',
        category: 'storage',
      },
    });

    // Connect Compute Instances to RDS Database
    const appNodes = nodes.filter(n => n.type === 'ec2');
    appNodes.forEach(app => {
      edges.push({
        id: `edge-${app.id}-${dbNodeId}`,
        source: app.id,
        target: dbNodeId,
      });
    });
  });

  return { nodes, edges };
}

/**
 * Discovers live AWS resources or returns sample discovered topology
 */
export async function discoverAwsTopology(): Promise<AwsDiscoveryResult> {
  const credStatus = AwsCredentialManager.getStatus();

  if (credStatus.isSimulated) {
    const simulatedResources = {
      vpcs: [{ id: 'vpc-01a2b3c4d5e6f7g8h', cidr: '10.0.0.0/16', name: 'production-vpc' }],
      subnets: [
        { id: 'subnet-pub-01', vpcId: 'vpc-01a2b3c4d5e6f7g8h', cidr: '10.0.1.0/24', az: 'us-east-1a', name: 'public-subnet-1a' },
        { id: 'subnet-priv-01', vpcId: 'vpc-01a2b3c4d5e6f7g8h', cidr: '10.0.10.0/24', az: 'us-east-1a', name: 'private-app-subnet-1a' },
      ],
      instances: [
        { id: 'i-0a8f9c1b2d3e4f501', type: 'm5.large', subnetId: 'subnet-priv-01', vpcId: 'vpc-01a2b3c4d5e6f7g8h', state: 'running', name: 'core-api-server' },
      ],
      databases: [
        { id: 'aurora-postgres-primary', engine: 'postgres', instanceClass: 'db.r6g.large', status: 'available', multiAz: true },
      ],
      loadBalancers: [
        {
          arn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/public-alb/50dc6c495c0c9188',
          name: 'public-traffic-alb',
          dnsName: 'public-traffic-alb.us-east-1.elb.amazonaws.com',
          type: 'application',
          vpcId: 'vpc-01a2b3c4d5e6f7g8h',
        },
      ],
    };

    return {
      ...simulatedResources,
      canvasGraph: buildCanvasGraphFromResources(simulatedResources),
      isSimulated: true,
    };
  }

  // Live query using AWS SDK v3
  const creds = await AwsCredentialManager.getResolvedCredentials();
  const { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand, DescribeInstancesCommand } = await import('@aws-sdk/client-ec2');
  const { RDSClient, DescribeDBInstancesCommand } = await import('@aws-sdk/client-rds');
  const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand } = await import('@aws-sdk/client-elastic-load-balancing-v2');

  const clientConfig = {
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  };

  const ec2 = new EC2Client(clientConfig);
  const rds = new RDSClient(clientConfig);
  const elbv2 = new ElasticLoadBalancingV2Client(clientConfig);

  const [vpcsRes, subnetsRes, instancesRes, dbsRes, lbsRes] = await Promise.allSettled([
    ec2.send(new DescribeVpcsCommand({})),
    ec2.send(new DescribeSubnetsCommand({})),
    ec2.send(new DescribeInstancesCommand({})),
    rds.send(new DescribeDBInstancesCommand({})),
    elbv2.send(new DescribeLoadBalancersCommand({})),
  ]);

  const vpcs = vpcsRes.status === 'fulfilled' ? vpcsRes.value.Vpcs || [] : [];
  const subnets = subnetsRes.status === 'fulfilled' ? subnetsRes.value.Subnets || [] : [];
  const instances = instancesRes.status === 'fulfilled'
    ? (instancesRes.value.Reservations || []).flatMap(r => r.Instances || [])
    : [];
  const databases = dbsRes.status === 'fulfilled' ? dbsRes.value.DBInstances || [] : [];
  const loadBalancers = lbsRes.status === 'fulfilled' ? lbsRes.value.LoadBalancers || [] : [];

  const rawResources = { vpcs, subnets, instances, databases, loadBalancers };
  return {
    vpcs: vpcs.map(v => ({ id: v.VpcId!, cidr: v.CidrBlock || '', name: v.Tags?.find(t => t.Key === 'Name')?.Value })),
    subnets: subnets.map(s => ({ id: s.SubnetId!, vpcId: s.VpcId || '', cidr: s.CidrBlock || '', az: s.AvailabilityZone || '', name: s.Tags?.find(t => t.Key === 'Name')?.Value })),
    instances: instances.map(i => ({ id: i.InstanceId!, type: i.InstanceType || '', subnetId: i.SubnetId || '', vpcId: i.VpcId || '', state: i.State?.Name || 'unknown', name: i.Tags?.find(t => t.Key === 'Name')?.Value })),
    databases: databases.map(d => ({ id: d.DBInstanceIdentifier!, engine: d.Engine || '', instanceClass: d.DBInstanceClass || '', status: d.DBInstanceStatus || '', multiAz: d.MultiAZ || false })),
    loadBalancers: loadBalancers.map((l: any) => ({ arn: l.LoadBalancerArn!, name: l.LoadBalancerName || '', dnsName: l.DNSName || '', type: l.Type || 'application', vpcId: l.VpcId })),
    canvasGraph: buildCanvasGraphFromResources(rawResources),
    isSimulated: false,
  };
}
