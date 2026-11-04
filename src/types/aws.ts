/**
 * AWS Telemetry and Webhook Input Types
 */

export interface EventBridgeAlarmDetail {
  alarmName: string;
  state: {
    value: 'ALARM' | 'OK' | 'INSUFFICIENT_DATA';
    reason: string;
    reasonData?: string;
    timestamp: string;
  };
  previousState?: {
    value: string;
    reason: string;
    timestamp: string;
  };
  configuration?: {
    description?: string;
    metrics?: Array<{
      id: string;
      metricStat?: {
        metric: {
          namespace: string;
          name: string;
          dimensions?: Record<string, string>;
        };
        period: number;
        stat: string;
      };
    }>;
  };
}

export interface EventBridgeCloudWatchAlarmEvent {
  version?: string;
  id?: string;
  'detail-type': 'CloudWatch Alarm State Change';
  source: 'aws.cloudwatch';
  account?: string;
  time: string;
  region: string;
  resources: string[]; // ARNs
  detail: EventBridgeAlarmDetail;
}

export interface SNSNotificationWrapper {
  Type: 'Notification' | 'SubscriptionConfirmation';
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string; // JSON string of alarm or raw text
  Timestamp: string;
  SignatureVersion?: string;
  SigningCertURL?: string;
}

export interface ManualAlarmTriggerRequest {
  scenario?: 'rds_bottleneck' | 'container_crashloop' | 'security_group_drift' | 'api_5xx_timeouts' | 'finops_idle_waste';
  alarmName?: string;
  awsResourceId?: string;
  metricName?: string;
  metricValue?: number;
  threshold?: number;
  region?: string;
  simulate?: boolean;
}
