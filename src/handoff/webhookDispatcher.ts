import type { AlertPayload } from '../types/alertPayload.js';

export interface DispatchResult {
  success: boolean;
  statusCode?: number;
  response?: unknown;
  error?: string;
  url: string;
}

export class WebhookDispatcher {
  /**
   * POST the alertPayload JSON to a configurable URL endpoint
   */
  public static async dispatch(payload: AlertPayload, url: string): Promise<DispatchResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ArchAutomation-TelemetryPipeline/1.0',
          'X-Incident-ID': payload.incidentId,
          'X-Triggered-At': payload.triggeredAt,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const responseData = isJson ? await response.json().catch(() => ({})) : await response.text();

      return {
        success: response.ok,
        statusCode: response.status,
        response: responseData,
        url,
        error: response.ok ? undefined : `HTTP Error ${response.status}`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: (err as Error).name === 'AbortError' ? 'Webhook request timed out (5s)' : (err as Error).message,
        url,
      };
    }
  }
}
