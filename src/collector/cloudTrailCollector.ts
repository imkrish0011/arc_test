import {
  CloudTrailClient,
  LookupEventsCommand,
  type Event as AwsCloudTrailEvent,
} from '@aws-sdk/client-cloudtrail';
import type { CloudTrailEventEntry } from '../types/alertPayload.js';
import { AwsClientManager } from '../aws/clientManager.js';
import type { AwsUserCredentials } from '../aws/credentials.js';

export interface CloudTrailCollectorOptions {
  awsResourceId?: string;
  minutes?: number; // default 60
  userCredentials?: AwsUserCredentials;
}

const CRITICAL_CONFIG_EVENTS = [
  'AuthorizeSecurityGroupIngress',
  'RevokeSecurityGroupIngress',
  'ModifyDBParameterGroup',
  'RebootDBInstance',
  'ModifyDBInstance',
  'RegisterTaskDefinition',
  'UpdateService',
  'PutScalingPolicy',
  'DetachVolume',
  'DeleteVolume',
  'CreateNatGateway',
  'ModifyInstanceAttribute',
];

export class CloudTrailCollector {
  /**
   * Queries CloudTrail events for trailing 60 minutes on user's AWS account,
   * searching by resource and key infrastructure mutation events.
   */
  public static async collect60mEvents(
    options: CloudTrailCollectorOptions
  ): Promise<CloudTrailEventEntry[]> {
    const { awsResourceId, minutes = 60, userCredentials } = options;
    const { trail, isSimulated } = await AwsClientManager.getClients(userCredentials);

    if (isSimulated) {
      return [];
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);

    const eventMap = new Map<string, CloudTrailEventEntry>();

    // 1. Query events specifically associated with the target resource (if given)
    if (awsResourceId) {
      const shortId = awsResourceId.split(':').pop()?.split('/').pop() || awsResourceId;

      for (const resTarget of [awsResourceId, shortId]) {
        try {
          const command = new LookupEventsCommand({
            StartTime: startTime,
            EndTime: endTime,
            MaxResults: 50,
            LookupAttributes: [
              { AttributeKey: 'ResourceName', AttributeValue: resTarget },
            ],
          });

          const res = await trail.send(command);
          for (const e of res.Events || []) {
            const entry = this.formatCloudTrailEntry(e, awsResourceId);
            if (entry && !eventMap.has(entry.eventId)) {
              eventMap.set(entry.eventId, entry);
            }
          }
        } catch (err: unknown) {
          console.warn(
            `[CloudTrailCollector] Lookup for resource ${resTarget} failed: ${(err as Error).message}`
          );
        }
      }
    }

    // 2. Query recent critical configuration mutations across the account
    for (const eventName of CRITICAL_CONFIG_EVENTS.slice(0, 4)) {
      try {
        const command = new LookupEventsCommand({
          StartTime: startTime,
          EndTime: endTime,
          MaxResults: 15,
          LookupAttributes: [
            { AttributeKey: 'EventName', AttributeValue: eventName },
          ],
        });

        const res = await trail.send(command);
        for (const e of res.Events || []) {
          const entry = this.formatCloudTrailEntry(e, awsResourceId);
          if (entry && !eventMap.has(entry.eventId)) {
            eventMap.set(entry.eventId, entry);
          }
        }
      } catch {
        // Continue if event lookup times out or lacks permission
      }
    }

    // Sort descending by eventTime
    return Array.from(eventMap.values()).sort(
      (a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime()
    );
  }

  private static formatCloudTrailEntry(
    e: AwsCloudTrailEvent,
    defaultResourceId?: string
  ): CloudTrailEventEntry | null {
    if (!e.EventId) return null;

    // Filter out read-only / poll events so Gargi receives clean infrastructure mutations
    const READ_ONLY_PREFIXES = ['Describe', 'Get', 'List', 'Lookup', 'BatchGet', 'Search', 'Check'];
    if (e.EventName && READ_ONLY_PREFIXES.some(prefix => e.EventName?.startsWith(prefix))) {
      return null;
    }

    let requestParameters: Record<string, unknown> = {};
    let parsedIdentity = e.Username || 'aws-system';

    if (e.CloudTrailEvent) {
      try {
        const parsed = JSON.parse(e.CloudTrailEvent);
        requestParameters = parsed.requestParameters || {};

        if (parsed.userIdentity) {
          parsedIdentity =
            parsed.userIdentity.userName ||
            parsed.userIdentity.principalId ||
            parsed.userIdentity.arn ||
            parsedIdentity;
        }
      } catch {
        // Keep fallback
      }
    }

    const matchedResource =
      e.Resources?.[0]?.ResourceName || defaultResourceId || 'aws-resource';

    return {
      eventId: e.EventId,
      eventTime: e.EventTime ? new Date(e.EventTime).toISOString() : new Date().toISOString(),
      eventName: e.EventName || 'UnknownCloudTrailEvent',
      awsResourceId: matchedResource,
      userIdentity: parsedIdentity,
      requestParameters,
    };
  }
}
