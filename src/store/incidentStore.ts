import type { AlertPayload, HandoffResult } from '../types/alertPayload.js';
import { SampleOutageGenerator } from '../generator/sampleOutageGenerator.js';

export interface IncidentRecord {
  incidentId: string;
  scenarioName?: string;
  source: 'eventbridge' | 'cloudwatch' | 'manual' | 'simulated';
  payload: AlertPayload;
  handoffStatus?: HandoffResult;
  createdAt: string;
}

class IncidentStore {
  private incidents: Map<string, IncidentRecord> = new Map();
  private latestIncidentId: string | null = null;

  constructor() {
    // Seed with the initial 5 scenarios so the dashboard has rich data on first load
    const scenarios = [
      { id: 'rds_bottleneck' as const, name: 'RDS Database Bottleneck' },
      { id: 'container_crashloop' as const, name: 'ECS/EKS Container CrashLoop' },
      { id: 'security_group_drift' as const, name: 'Security Group Drift' },
      { id: 'api_5xx_timeouts' as const, name: 'API 5xx Timeouts' },
      { id: 'finops_idle_waste' as const, name: 'FinOps Idle Waste' },
    ];

    for (const s of scenarios) {
      const payload = SampleOutageGenerator.generate(s.id);
      this.saveIncident(payload, 'simulated', s.name);
    }
  }

  public saveIncident(
    payload: AlertPayload,
    source: 'eventbridge' | 'cloudwatch' | 'manual' | 'simulated' = 'manual',
    scenarioName?: string
  ): IncidentRecord {
    const record: IncidentRecord = {
      incidentId: payload.incidentId,
      scenarioName: scenarioName || payload.activeAlarms[0]?.alarmName || 'Custom Incident',
      source,
      payload,
      createdAt: payload.triggeredAt || new Date().toISOString(),
    };

    this.incidents.set(payload.incidentId, record);
    this.latestIncidentId = payload.incidentId;
    return record;
  }

  public updateHandoffStatus(incidentId: string, result: HandoffResult): void {
    const rec = this.incidents.get(incidentId);
    if (rec) {
      rec.handoffStatus = result;
    }
  }

  public getIncident(id: string): IncidentRecord | undefined {
    return this.incidents.get(id);
  }

  public getLatestIncident(): IncidentRecord | undefined {
    if (!this.latestIncidentId) return undefined;
    return this.incidents.get(this.latestIncidentId);
  }

  public getAllIncidents(): IncidentRecord[] {
    return Array.from(this.incidents.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public clear(): void {
    this.incidents.clear();
    this.latestIncidentId = null;
  }
}

export const incidentStore = new IncidentStore();
