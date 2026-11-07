export interface TenantProject {
  tenantId: string;
  projectId: string;
  projectName: string;
  awsAccountId: string;
  region: string;
  createdAt: string;
}

/**
 * Multi-Tenant and Project Isolation Manager for ArchViz Autonomous Engine
 */
export class TenantContextManager {
  private static tenants: Map<string, TenantProject> = new Map([
    [
      'tenant-default',
      {
        tenantId: 'tenant-default',
        projectId: 'project-ecommerce-prod',
        projectName: 'E-Commerce Production Fleet',
        awsAccountId: '123456789012',
        region: 'us-east-1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    [
      'tenant-fintech',
      {
        tenantId: 'tenant-fintech',
        projectId: 'project-payments-core',
        projectName: 'Core Payment Gateway Architecture',
        awsAccountId: '987654321098',
        region: 'us-east-1',
        createdAt: '2026-02-15T00:00:00.000Z',
      },
    ],
  ]);

  public static getTenant(tenantId = 'tenant-default'): TenantProject {
    return (
      this.tenants.get(tenantId) || {
        tenantId,
        projectId: 'project-default',
        projectName: 'Default Architecture Fleet',
        awsAccountId: '123456789012',
        region: 'us-east-1',
        createdAt: new Date().toISOString(),
      }
    );
  }

  public static registerTenant(project: TenantProject): void {
    this.tenants.set(project.tenantId, project);
  }

  public static listTenants(): TenantProject[] {
    return Array.from(this.tenants.values());
  }
}
