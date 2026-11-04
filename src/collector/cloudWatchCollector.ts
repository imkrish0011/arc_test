import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  DescribeAlarmsForMetricCommand,
} from '@aws-sdk/client-cloudwatch';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  DescribeLogGroupsCommand,
  type FilteredLogEvent,
} from '@aws-sdk/client-cloudwatch-logs';
import { filterAndClassifyLogs } from './logFilter.js';
import type { ActiveAlarm, CloudWatchLogEntry } from '../types/alertPayload.js';
import { AwsClientManager } from '../aws/clientManager.js';
import type { AwsUserCredentials } from '../aws/credentials.js';

export interface CloudWatchCollectorOptions {
  awsResourceId: string;
  nodeId: string;
  logGroupName?: string;
  minutes?: number; // default 30
  userCredentials?: AwsUserCredentials;
}

export class CloudWatchCollector {
  /**
   * Automatically discovers candidate log group names for a given AWS resource ID or ARN.
   */
  public static async discoverLogGroups(
    logsClient: CloudWatchLogsClient,
    awsResourceId: string
  ): Promise<string[]> {
    const raw = awsResourceId.trim();
    const shortName = raw.split(':').pop()?.split('/').pop() || raw;

    const candidatePrefixes: string[] = [
      `/aws/lambda/${shortName}`,
      `/aws/rds/instance/${shortName}`,
      `/aws/rds/cluster/${shortName}`,
      `/ecs/${shortName}`,
      `/aws/ecs/${shortName}`,
      `/aws/apigateway/${shortName}`,
      `API-Gateway-Execution-Logs_${shortName}`,
      `/aws/elasticloadbalancing/${shortName}`,
      `/var/log/${shortName}`,
      `/aws/ec2/${shortName}`,
      shortName,
    ];

    const discoveredGroups: string[] = [];

    // Query CloudWatch Logs for matching prefixes
    for (const prefix of candidatePrefixes.slice(0, 5)) {
      try {
        const cmd = new DescribeLogGroupsCommand({
          logGroupNamePrefix: prefix,
          limit: 5,
        });
        const res = await logsClient.send(cmd);
        if (res.logGroups && res.logGroups.length > 0) {
          for (const lg of res.logGroups) {
            if (lg.logGroupName && !discoveredGroups.includes(lg.logGroupName)) {
              discoveredGroups.push(lg.logGroupName);
            }
          }
        }
      } catch {
        // Ignore permission or not-found errors during auto-discovery probe
      }
    }

    // If specific prefix match failed, try broader lookup by short name
    if (discoveredGroups.length === 0) {
      try {
        const cmd = new DescribeLogGroupsCommand({
          logGroupNamePrefix: `/aws/`,
          limit: 20,
        });
        const res = await logsClient.send(cmd);
        if (res.logGroups) {
          for (const lg of res.logGroups) {
            if (
              lg.logGroupName &&
              lg.logGroupName.toLowerCase().includes(shortName.toLowerCase())
            ) {
              discoveredGroups.push(lg.logGroupName);
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }

    return discoveredGroups;
  }

  /**
   * Queries CloudWatch logs for trailing 30 minutes on user's AWS account,
   * performs log group discovery, paginates events, and pre-filters noisy INFO.
   */
  public static async collect30mLogs(
    options: CloudWatchCollectorOptions
  ): Promise<CloudWatchLogEntry[]> {
    const { awsResourceId, nodeId, logGroupName, minutes = 30, userCredentials } = options;
    const { logs, isSimulated } = await AwsClientManager.getClients(userCredentials);

    if (isSimulated) {
      return [];
    }

    const endTime = Date.now();
    const startTime = endTime - minutes * 60 * 1000;

    // Resolve target log group(s)
    let targetLogGroups: string[] = [];
    if (logGroupName) {
      targetLogGroups = [logGroupName];
    } else {
      targetLogGroups = await this.discoverLogGroups(logs, awsResourceId);
    }

    if (targetLogGroups.length === 0) {
      // Fallback candidate if discovery returned 0 groups
      const fallbackName = `/aws/service/${awsResourceId.split(':').pop()?.split('/').pop() || 'app'}`;
      targetLogGroups = [fallbackName];
    }

    const allEvents: Array<{ timestamp?: number; message?: string }> = [];

    // Query discovered log groups
    for (const group of targetLogGroups) {
      try {
        let nextToken: string | undefined = undefined;
        let pagesQueried = 0;

        do {
          const command: FilterLogEventsCommand = new FilterLogEventsCommand({
            logGroupName: group,
            startTime,
            endTime,
            limit: 100,
            nextToken,
            // Pre-filter on AWS side for errors, fatals, warnings, timeouts
            filterPattern: '?ERROR ?FATAL ?WARN ?Timeout ?OutOfMemory ?Panic ?504 ?502',
          });

          const response = await logs.send(command);
          if (response.events && response.events.length > 0) {
            allEvents.push(...response.events);
          }

          nextToken = response.nextToken;
          pagesQueried++;
        } while (nextToken && pagesQueried < 5 && allEvents.length < 500);
      } catch (err: unknown) {
        console.warn(
          `[CloudWatchCollector] Could not query logs for group ${group}: ${(err as Error).message}`
        );
      }
    }

    const rawLogs = allEvents.map(e => ({
      timestamp: e.timestamp,
      message: e.message || '',
    }));

    return filterAndClassifyLogs(rawLogs, nodeId, awsResourceId);
  }

  /**
   * Fetches active alarm details from user's AWS CloudWatch for given alarm names or resource
   */
  public static async collectActiveAlarms(
    alarmNames: string[],
    resourceIdToNodeId: Record<string, string>,
    userCredentials?: AwsUserCredentials
  ): Promise<ActiveAlarm[]> {
    const { cloudWatch, isSimulated } = await AwsClientManager.getClients(userCredentials);

    if (isSimulated || alarmNames.length === 0) {
      return [];
    }

    try {
      const command = new DescribeAlarmsCommand({
        AlarmNames: alarmNames,
        StateValue: 'ALARM',
      });

      const res = await cloudWatch.send(command);
      const activeAlarms: ActiveAlarm[] = [];

      for (const a of res.MetricAlarms || []) {
        const resId =
          a.Dimensions?.[0]?.Value ||
          a.AlarmArn ||
          'aws-resource';
        const nodeId = resourceIdToNodeId[resId] || 'node-unknown';

        activeAlarms.push({
          alarmId: a.AlarmArn || a.AlarmName || `alarm-${Date.now()}`,
          alarmName: a.AlarmName || 'CloudWatch-Alarm',
          nodeId,
          awsResourceId: resId,
          metricName: a.MetricName || 'CustomMetric',
          metricValue: a.Threshold || 0,
          threshold: a.Threshold || 0,
          timestamp: a.StateUpdatedTimestamp
            ? new Date(a.StateUpdatedTimestamp).toISOString()
            : new Date().toISOString(),
        });
      }

      return activeAlarms;
    } catch (err: unknown) {
      console.warn(
        `[CloudWatchCollector] Failed to describe live alarms: ${(err as Error).message}`
      );
      return [];
    }
  }
}
