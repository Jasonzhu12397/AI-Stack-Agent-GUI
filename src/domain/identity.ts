import { UserRole, Principal, TenantInfo, RoleBinding, UserMember } from '../contracts/types';

export const DEFAULT_ROLE_GRANTS: Record<UserRole, string[]> = {
  PLATFORM_ADMIN: ['*'],
  ORG_ADMIN: [
    'ORG_MANAGE',
    'USER_MANAGE',
    'PROJECT_MANAGE',
    'QUOTA_MANAGE',
    'AUDIT_READ',
    'AGENT_DRAFT',
    'WORKFLOW_DRAFT',
    'RUN_EXECUTE',
    'TOOL_READ',
  ],
  APP_DEVELOPER: [
    'TOOL_CALC',
    'TOOL_READ',
    'DB_QUERY',
    'NOTIFY_SEND',
    'AGENT_DRAFT',
    'WORKFLOW_DRAFT',
    'RUN_EXECUTE',
    'MAPS_GEOCODE',
    'MAPS_PLACES',
    'WEATHER_READ',
    'FEISHU_DISPATCH',
    'DINGTALK_DISPATCH',
    'WECOM_DISPATCH',
    'AMAP_GEOCODE',
  ],
  CONNECTOR_ADMIN: [
    'CONNECTOR_MANAGE',
    'MCP_MANAGE',
    'CREDENTIAL_REF_MANAGE',
    'TOOL_READ',
    'AUDIT_READ',
    'MAPS_GEOCODE',
    'MAPS_PLACES',
    'WEATHER_READ',
    'FEISHU_DISPATCH',
    'DINGTALK_DISPATCH',
    'WECOM_DISPATCH',
    'AMAP_GEOCODE',
  ],
  APPROVER: ['APPROVE_HIGH_RISK', 'AUDIT_READ', 'TOOL_READ', 'DASHBOARD_READ'],
  OPERATOR: ['RUN_EXECUTE', 'DASHBOARD_READ', 'TOOL_READ'],
  AUDITOR: ['AUDIT_READ', 'TRACE_READ', 'DASHBOARD_READ'],
};

export class IdentityManager {
  /**
   * CRITICAL INVARIANT: Development identity adapter MUST fail to start in production!
   */
  public static validateAuthProvider(env: string, authMethod: string): void {
    if (env === 'production' && authMethod === 'LOCAL_DEV_IDENTITY') {
      throw new Error(
        'DEV_IDENTITY_FORBIDDEN_IN_PRODUCTION: Local development identity adapter is strictly forbidden in production! Production configuration must enforce enterprise OIDC / mTLS verification.'
      );
    }
  }

  /**
   * Cross-tenant isolation verification: Server authoritative check
   */
  public static verifyTenantBoundary(principalTenantId: string, resourceTenantId: string): void {
    if (principalTenantId !== resourceTenantId) {
      throw new Error(
        `CROSS_TENANT_ACCESS_DENIED: Actor in tenant '${principalTenantId}' cannot access resources belonging to tenant '${resourceTenantId}'.`
      );
    }
  }

  /**
   * Project boundary verification: checks project assignment unless platform admin
   */
  public static verifyProjectBoundary(
    principalRole: UserRole,
    principalProjects: string[],
    targetProjectId?: string
  ): void {
    if (principalRole === 'PLATFORM_ADMIN') {
      return; // Platform admin has cross-project clearance within the authorized tenant
    }
    if (!targetProjectId) {
      return;
    }
    if (!principalProjects.includes(targetProjectId)) {
      throw new Error(
        `PROJECT_ACCESS_DENIED: Actor has access to [${principalProjects.join(', ')}] but requested project '${targetProjectId}'.`
      );
    }
  }

  /**
   * Role revocation check
   */
  public static verifyRoleActive(roleBinding?: RoleBinding | null): void {
    if (!roleBinding) return;
    if (!roleBinding.is_active || roleBinding.revoked_at) {
      throw new Error(
        `ROLE_REVOKED: Role '${roleBinding.role}' for user '${roleBinding.user_id}' was revoked at ${roleBinding.revoked_at}. Operation denied.`
      );
    }
  }

  /**
   * Tenant quota check (concurrency & budget limits)
   */
  public static checkTenantQuota(
    quota: TenantInfo['quota'],
    currentActiveRuns: number,
    estimatedCostUsd: number = 0.001
  ): { allowed: boolean; code?: string; reason?: string } {
    if (currentActiveRuns >= quota.max_concurrent_runs) {
      return {
        allowed: false,
        code: 'CONCURRENCY_QUOTA_EXCEEDED',
        reason: `Tenant reached max concurrent executions quota (${currentActiveRuns}/${quota.max_concurrent_runs}).`,
      };
    }

    if (quota.used_budget_usd + estimatedCostUsd > quota.monthly_budget_usd) {
      return {
        allowed: false,
        code: 'MONTHLY_BUDGET_EXCEEDED',
        reason: `Tenant monthly budget exhausted ($${quota.used_budget_usd.toFixed(2)} / $${quota.monthly_budget_usd.toFixed(2)}).`,
      };
    }

    return { allowed: true };
  }
}
