import { describe, it, expect, vi } from 'vitest';
import { SampleOutageGenerator } from '../src/generator/sampleOutageGenerator.js';
import {
  handoffToGargiEngine,
  registerGargiEngine,
  runAutomatedRcaPipeline,
} from '../src/handoff/gargiConnector.js';

describe('Gargi Engine Handoff Connector', () => {
  it('should deliver payload via default simulation / verification hook', async () => {
    const payload = SampleOutageGenerator.generate('rds_bottleneck');
    const result = await handoffToGargiEngine(payload);

    expect(result.success).toBe(true);
    expect(result.incidentId).toBe(payload.incidentId);
    expect(result.deliveredAt).toBeDefined();
    expect(result.diagnosticStatus).toBe('pending_rca');
  });

  it('should invoke custom registered Gargi engine when attached', async () => {
    const mockGargiFn = vi.fn().mockResolvedValue({
      status: 'rca_in_progress',
      rootCauseCandidate: 'rds_connection_pool_starvation',
      confidence: 0.94,
    });

    registerGargiEngine(mockGargiFn);

    const payload = SampleOutageGenerator.generate('container_crashloop');
    const result = await handoffToGargiEngine(payload);

    expect(mockGargiFn).toHaveBeenCalledWith(payload);
    expect(result.success).toBe(true);
    expect(result.diagnosticStatus).toBe('analyzing');
    expect(result.response).toEqual({
      status: 'rca_in_progress',
      rootCauseCandidate: 'rds_connection_pool_starvation',
      confidence: 0.94,
    });

    // Reset handler for subsequent tests
    registerGargiEngine(null as any);
  });

  it('should reject invalid payload with contract validation error', async () => {
    const brokenPayload: any = { incidentId: 'invalid' };
    await expect(runAutomatedRcaPipeline(brokenPayload)).rejects.toThrow(
      /AlertPayload contract validation failed/
    );
  });
});
