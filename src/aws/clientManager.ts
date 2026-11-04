import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';
import {
  AwsCredentialManager,
  type AwsCredentialConfig,
  type AwsUserCredentials,
} from './credentials.js';

export interface AwsClientsBundle {
  cloudWatch: CloudWatchClient;
  logs: CloudWatchLogsClient;
  trail: CloudTrailClient;
  isSimulated: boolean;
  region: string;
}

export class AwsClientManager {
  private static defaultCloudWatchClient?: CloudWatchClient;
  private static defaultLogsClient?: CloudWatchLogsClient;
  private static defaultTrailClient?: CloudTrailClient;

  /**
   * Instantiates AWS SDK v3 clients for CloudWatch, CloudWatch Logs, and CloudTrail
   * using either per-request user credentials or environment credentials.
   */
  public static async getClients(
    userCredentials?: AwsUserCredentials
  ): Promise<AwsClientsBundle> {
    const creds: AwsCredentialConfig = await AwsCredentialManager.resolveCredentials(
      userCredentials
    );

    if (creds.source === 'simulated') {
      return {
        cloudWatch: new CloudWatchClient({ region: creds.region }),
        logs: new CloudWatchLogsClient({ region: creds.region }),
        trail: new CloudTrailClient({ region: creds.region }),
        isSimulated: true,
        region: creds.region,
      };
    }

    const clientConfig = {
      region: creds.region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      },
    };

    // If custom per-user credentials were provided, return dedicated clients
    if (userCredentials && (userCredentials.accessKeyId || userCredentials.roleArn)) {
      return {
        cloudWatch: new CloudWatchClient(clientConfig),
        logs: new CloudWatchLogsClient(clientConfig),
        trail: new CloudTrailClient(clientConfig),
        isSimulated: false,
        region: creds.region,
      };
    }

    // Otherwise use cached default clients
    if (!this.defaultCloudWatchClient) {
      this.defaultCloudWatchClient = new CloudWatchClient(clientConfig);
    }
    if (!this.defaultLogsClient) {
      this.defaultLogsClient = new CloudWatchLogsClient(clientConfig);
    }
    if (!this.defaultTrailClient) {
      this.defaultTrailClient = new CloudTrailClient(clientConfig);
    }

    return {
      cloudWatch: this.defaultCloudWatchClient,
      logs: this.defaultLogsClient,
      trail: this.defaultTrailClient,
      isSimulated: false,
      region: creds.region,
    };
  }

  public static reset(): void {
    this.defaultCloudWatchClient = undefined;
    this.defaultLogsClient = undefined;
    this.defaultTrailClient = undefined;
  }
}
