import { Router, type Request, type Response } from 'express';
import { SampleOutageGenerator, type ScenarioType } from '../generator/sampleOutageGenerator.js';
import { incidentStore } from '../store/incidentStore.js';

export const scenarioRouter = Router();

const SCENARIOS: Array<{
  id: ScenarioType;
  name: string;
  category: string;
  description: string;
  triggerMetrics: string;
}> = [
  {
    id: 'rds_bottleneck',
    name: 'RDS Database Bottleneck',
    category: 'Storage & Database',
    description: 'CPUUtilization > 92%, DatabaseConnections > 90%, cascading Lambda/APIGW timeouts, FATAL: remaining connection slots reserved.',
    triggerMetrics: 'CPUUtilization: 96.4%, Connections: 498/500',
  },
  {
    id: 'container_crashloop',
    name: 'ECS/EKS Container CrashLoop',
    category: 'Compute & Containers',
    description: 'Task stop count > 3 in 10 mins, container Exit Code 137 (OutOfMemoryError), correlated with CloudTrail RegisterTaskDefinition memory limit regression.',
    triggerMetrics: 'CrashCount: 7, ExitCode: 137 (OOM)',
  },
  {
    id: 'security_group_drift',
    name: 'Security Group Drift',
    category: 'Security & Governance',
    description: 'AWS Config non-compliant rule & GuardDuty portscan, correlated with CloudTrail AuthorizeSecurityGroupIngress opening port 22/5432 to 0.0.0.0/0.',
    triggerMetrics: 'Ingress: 0.0.0.0/0 on Port 22 & 5432',
  },
  {
    id: 'api_5xx_timeouts',
    name: 'API 5xx Timeouts',
    category: 'Network & API',
    description: '5XXError > 5%, TargetResponseTime > 3000ms, Lambda timeout after 3.00s, AutoScalingGroup at 100% max capacity.',
    triggerMetrics: 'TargetResponseTime: 3450ms, 5XX Rate: 48%',
  },
  {
    id: 'finops_idle_waste',
    name: 'FinOps Idle Waste',
    category: 'Cost Optimization',
    description: '0 IOPS / 0 active connections for 7 days on provisioned io2 EBS volume (status: available), and idle NAT Gateway with 0 BytesOut.',
    triggerMetrics: '7-Day IOPS: 0, 7-Day NAT Bytes: 0',
  },
];

scenarioRouter.get('/list', (_req: Request, res: Response): void => {
  res.json({ scenarios: SCENARIOS });
});

scenarioRouter.post('/trigger/:scenarioId', (req: Request, res: Response): void => {
  const { scenarioId } = req.params;
  const match = SCENARIOS.find(s => s.id === scenarioId);

  if (!match) {
    res.status(404).json({
      error: `Scenario '${scenarioId}' not found. Available scenarios: ${SCENARIOS.map(s => s.id).join(', ')}`,
    });
    return;
  }

  const payload = SampleOutageGenerator.generate(match.id);
  const incident = incidentStore.saveIncident(payload, 'simulated', match.name);

  res.status(201).json({
    success: true,
    scenario: match,
    incidentId: incident.incidentId,
    payload,
  });
});
