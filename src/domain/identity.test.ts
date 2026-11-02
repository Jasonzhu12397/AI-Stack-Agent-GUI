import test from 'node:test';
import assert from 'node:assert/strict';
import { IdentityManager, DEFAULT_ROLE_GRANTS } from './identity';
import { RoleBinding } from '../contracts/types';

test('IdentityManager blocks local development identity under production config', () => {
  // Development environment allows local dev identity
  assert.doesNotThrow(() => {
    IdentityManager.validateAuthProvider('development', 'LOCAL_DEV_IDENTITY');
  });

  // Production MUST fail if local dev identity is configured
  assert.throws(
    () => {
      IdentityManager.validateAuthProvider('production', 'LOCAL_DEV_IDENTITY');
    },
    /DEV_IDENTITY_FORBIDDEN_IN_PRODUCTION/i
  );
});

test('IdentityManager enforces strict cross-tenant isolation', () => {
  // Same tenant is allowed
  assert.doesNotThrow(() => {
    IdentityManager.verifyTenantBoundary('tenant_acme', 'tenant_acme');
  });

  // Different tenant is rejected
  assert.throws(
    () => {
      IdentityManager.verifyTenantBoundary('tenant_acme', 'tenant_rival_corp');
    },
    /CROSS_TENANT_ACCESS_DENIED/i
  );
});

test('IdentityManager enforces project boundaries', () => {
  const allowedProjects = ['proj_infra', 'proj_sec'];

  // Allowed project
  assert.doesNotThrow(() => {
    IdentityManager.verifyProjectBoundary('APP_DEVELOPER', allowedProjects, 'proj_infra');
  });

  // Disallowed project
  assert.throws(
    () => {
      IdentityManager.verifyProjectBoundary('APP_DEVELOPER', allowedProjects, 'proj_secret_payroll');
    },
    /PROJECT_ACCESS_DENIED/i
  );

  // Platform admin bypasses project list restriction within tenant
  assert.doesNotThrow(() => {
    IdentityManager.verifyProjectBoundary('PLATFORM_ADMIN', allowedProjects, 'proj_secret_payroll');
  });
});

test('IdentityManager detects and blocks revoked roles', () => {
  const activeBinding: RoleBinding = {
    id: 'rb_1',
    user_id: 'usr_dev_1',
    tenant_id: 'tenant_acme',
    role: 'APP_DEVELOPER',
    grants: DEFAULT_ROLE_GRANTS.APP_DEVELOPER,
    assigned_at: new Date().toISOString(),
    assigned_by: 'admin',
    is_active: true,
  };

  assert.doesNotThrow(() => {
    IdentityManager.verifyRoleActive(activeBinding);
  });

  const revokedBinding: RoleBinding = {
    ...activeBinding,
    is_active: false,
    revoked_at: new Date().toISOString(),
    revoked_by: 'security_auditor',
  };

  assert.throws(
    () => {
      IdentityManager.verifyRoleActive(revokedBinding);
    },
    /ROLE_REVOKED/i
  );
});

test('IdentityManager validates tenant quotas correctly', () => {
  const quota = {
    max_concurrent_runs: 5,
    monthly_budget_usd: 100.0,
    used_budget_usd: 99.5,
  };

  // Normal request within budget and concurrency
  const okResult = IdentityManager.checkTenantQuota(quota, 2, 0.1);
  assert.equal(okResult.allowed, true);

  // Exceeds max concurrent runs
  const concurrencyResult = IdentityManager.checkTenantQuota(quota, 5, 0.01);
  assert.equal(concurrencyResult.allowed, false);
  assert.equal(concurrencyResult.code, 'CONCURRENCY_QUOTA_EXCEEDED');

  // Exceeds monthly budget
  const budgetResult = IdentityManager.checkTenantQuota(quota, 1, 1.0);
  assert.equal(budgetResult.allowed, false);
  assert.equal(budgetResult.code, 'MONTHLY_BUDGET_EXCEEDED');
});
