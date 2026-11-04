import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';

export interface AwsUserCredentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
  roleArn?: string;
  externalId?: string;
  roleSessionName?: string;
}

export interface AwsCredentialConfig {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  source: 'direct' | 'assumed_role' | 'simulated';
  roleArn?: string;
}

export interface CredentialStatus {
  hasCredentials: boolean;
  isSimulated: boolean;
  region: string;
  roleArn?: string;
  source: 'direct' | 'assumed_role' | 'simulated';
  message: string;
}

export class AwsCredentialManager {
  private static cachedCredentials?: AwsCredentialConfig;
  private static cacheExpiry: number = 0;

  public static getRegion(fallbackRegion?: string): string {
    return (
      fallbackRegion ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      'us-east-1'
    );
  }

  public static getStatus(overrideCreds?: AwsUserCredentials): CredentialStatus {
    const region = this.getRegion(overrideCreds?.region);
    const key = overrideCreds?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secret = overrideCreds?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    const roleArn = overrideCreds?.roleArn || process.env.AWS_ROLE_ARN;

    if (!key || !secret) {
      if (roleArn) {
        return {
          hasCredentials: true,
          isSimulated: false,
          region,
          roleArn,
          source: 'assumed_role',
          message: `Cross-account IAM Role configured: ${roleArn}`,
        };
      }
      return {
        hasCredentials: false,
        isSimulated: true,
        region,
        source: 'simulated',
        message: 'No AWS credentials detected. Running in high-fidelity simulated telemetry mode.',
      };
    }

    if (roleArn) {
      return {
        hasCredentials: true,
        isSimulated: false,
        region,
        roleArn,
        source: 'assumed_role',
        message: `STS AssumeRole configured for role ${roleArn}`,
      };
    }

    return {
      hasCredentials: true,
      isSimulated: false,
      region,
      source: 'direct',
      message: 'Direct user AWS credentials active.',
    };
  }

  /**
   * Resolves AWS credentials from user-supplied parameters, STS AssumeRole, or environment variables.
   */
  public static async resolveCredentials(
    userCreds?: AwsUserCredentials
  ): Promise<AwsCredentialConfig> {
    const region = this.getRegion(userCreds?.region);
    const now = Date.now();

    const key = userCreds?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secret = userCreds?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    const token = userCreds?.sessionToken || process.env.AWS_SESSION_TOKEN;
    const roleArn = userCreds?.roleArn || process.env.AWS_ROLE_ARN;
    const externalId = userCreds?.externalId || process.env.AWS_ROLE_EXTERNAL_ID;
    const sessionName =
      userCreds?.roleSessionName ||
      process.env.AWS_ROLE_SESSION_NAME ||
      `ArchAutomation-${Date.now().toString(36)}`;

    // 1. If roleArn is provided, perform STS AssumeRole (cross-account pattern)
    if (roleArn) {
      try {
        const stsConfig: any = { region };
        if (key && secret) {
          stsConfig.credentials = {
            accessKeyId: key,
            secretAccessKey: secret,
            sessionToken: token,
          };
        }

        const sts = new STSClient(stsConfig);
        const assumeCmd = new AssumeRoleCommand({
          RoleArn: roleArn,
          RoleSessionName: sessionName,
          ExternalId: externalId || undefined,
          DurationSeconds: 900,
        });

        const res = await sts.send(assumeCmd);
        if (
          !res.Credentials ||
          !res.Credentials.AccessKeyId ||
          !res.Credentials.SecretAccessKey
        ) {
          throw new Error('STS AssumeRole failed to return valid temporary credentials');
        }

        return {
          accessKeyId: res.Credentials.AccessKeyId,
          secretAccessKey: res.Credentials.SecretAccessKey,
          sessionToken: res.Credentials.SessionToken,
          region,
          source: 'assumed_role',
          roleArn,
        };
      } catch (err: unknown) {
        console.warn(
          `[AwsCredentialManager] STS AssumeRole failed for ${roleArn}: ${(err as Error).message}.`
        );
        if (key && secret) {
          console.warn('[AwsCredentialManager] Falling back to direct credentials.');
        } else {
          return {
            accessKeyId: 'SIMULATED_KEY',
            secretAccessKey: 'SIMULATED_SECRET',
            region,
            source: 'simulated',
          };
        }
      }
    }

    // 2. Direct credentials provided
    if (key && secret) {
      return {
        accessKeyId: key,
        secretAccessKey: secret,
        sessionToken: token,
        region,
        source: 'direct',
      };
    }

    // 3. Fallback to cached or simulated credentials
    if (this.cachedCredentials && now < this.cacheExpiry) {
      return this.cachedCredentials;
    }

    const simulated: AwsCredentialConfig = {
      accessKeyId: 'MOCK_AWS_ACCESS_KEY_ID',
      secretAccessKey: 'MOCK_AWS_SECRET_ACCESS_KEY',
      region,
      source: 'simulated',
    };
    this.cachedCredentials = simulated;
    this.cacheExpiry = now + 3600 * 1000;
    return simulated;
  }

  public static async getResolvedCredentials(): Promise<AwsCredentialConfig> {
    return this.resolveCredentials();
  }
}
