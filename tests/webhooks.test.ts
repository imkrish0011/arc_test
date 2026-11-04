import { describe, it, expect, beforeAll } from 'vitest';
import { createServer } from '../src/index.js';
import type { Express } from 'express';

describe('API Routes: Webhooks, Handoff & Scenarios', () => {
  let app: Express;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createServer();
  });

  it('GET /api/health returns healthy status and service info', async () => {
    // We can simulate request or test route handlers
    const res = await fetchResponse(app, '/api/health', 'GET');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('arch-automation-telemetry');
  });

  it('POST /api/webhooks/aws-alarm accepts manual trigger and ingests telemetry', async () => {
    const res = await fetchResponse(app, '/api/webhooks/aws-alarm', 'POST', {
      scenario: 'rds_bottleneck',
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.incidentId).toBeDefined();
    expect(body.payload).toBeDefined();
    expect(body.payload.activeAlarms.length).toBeGreaterThan(0);
  });

  it('GET /api/handoff/incidents lists collected incidents', async () => {
    const res = await fetchResponse(app, '/api/handoff/incidents', 'GET');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBeGreaterThan(0);
    expect(Array.isArray(body.incidents)).toBe(true);
  });

  it('GET /api/handoff/incidents/:id returns exact alertPayload', async () => {
    // First list to get an ID
    const listRes = await fetchResponse(app, '/api/handoff/incidents', 'GET');
    const listBody = await listRes.json();
    const targetId = listBody.incidents[0].incidentId;

    const res = await fetchResponse(app, `/api/handoff/incidents/${targetId}`, 'GET');
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.incidentId).toBe(targetId);
    expect(payload.activeAlarms).toBeDefined();
    expect(payload.cloudWatchLogs30m).toBeDefined();
    expect(payload.cloudTrailEvents60m).toBeDefined();
    expect(payload.canvasGraph).toBeDefined();
  });

  it('POST /api/scenarios/trigger/:scenarioId generates scenario payload', async () => {
    const res = await fetchResponse(app, '/api/scenarios/trigger/container_crashloop', 'POST');
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.scenario.id).toBe('container_crashloop');
    expect(body.payload.cloudWatchLogs30m.some((l: any) => l.message.includes('Exit Code 137'))).toBe(true);
  });
});

// Helper for testing express app without listening on a port
import http from 'http';

function fetchResponse(app: Express, path: string, method: string, body?: any): Promise<{ status: number; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address() as any;
      const port = addr.port;
      const url = `http://127.0.0.1:${port}${path}`;

      fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
        .then(async res => {
          const json = await res.json();
          server.close();
          resolve({
            status: res.status,
            json: async () => json,
          });
        })
        .catch(err => {
          server.close();
          reject(err);
        });
    });
  });
}
