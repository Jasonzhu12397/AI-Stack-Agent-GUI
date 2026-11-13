package policy

import (
	"strings"
	"testing"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
)

func TestIsRoleRevokedAndHasAnyPermission(t *testing.T) {
	pe := NewPolicyEngine()

	members := map[string]*models.UserMember{
		"usr_active":  {ID: "usr_active", Name: "Elena", Status: "ACTIVE"},
		"usr_revoked": {ID: "usr_revoked", Name: "Devon", Status: "REVOKED"},
	}
	bindings := map[string]*models.RoleBinding{
		"rb_active":  {ID: "rb_active", UserID: "usr_active", Role: "PLATFORM_ADMIN", IsActive: true},
		"rb_revoked": {ID: "rb_revoked", UserID: "usr_revoked", Role: "OPERATOR", IsActive: false, RevokedAt: "2026-01-01T00:00:00Z"},
	}

	if revoked, _ := pe.IsRoleRevoked(nil, members, bindings); !revoked {
		t.Fatalf("expected nil principal to be denied/revoked under zero-trust")
	}

	revokedPrincipal := &models.Principal{ActorID: "usr_revoked", ActorName: "Devon", Role: "OPERATOR", Grants: []string{"*"}}
	if revoked, reason := pe.IsRoleRevoked(revokedPrincipal, members, bindings); !revoked || !strings.Contains(reason, "ROLE_REVOKED") {
		t.Fatalf("expected usr_revoked to be flagged ROLE_REVOKED, got revoked=%v reason=%q", revoked, reason)
	}

	adminPrincipal := &models.Principal{ActorID: "usr_active", ActorName: "Elena", Role: "PLATFORM_ADMIN", Grants: []string{"*"}}
	if revoked, _ := pe.IsRoleRevoked(adminPrincipal, members, bindings); revoked {
		t.Fatalf("expected active PLATFORM_ADMIN not to be revoked")
	}
	if !pe.HasAnyPermission(adminPrincipal, "CLUSTER_MANAGE", "USER_MANAGE") {
		t.Fatalf("expected wildcard '*' grant to authorize all permissions")
	}

	devPrincipal := &models.Principal{ActorID: "usr_dev", ActorName: "Alex", Role: "APP_DEVELOPER", Grants: GrantsForRole("APP_DEVELOPER")}
	if !pe.HasAnyPermission(devPrincipal, "RUN_EXECUTE") {
		t.Fatalf("expected APP_DEVELOPER to have RUN_EXECUTE")
	}
	if pe.HasAnyPermission(devPrincipal, "CLUSTER_MANAGE") {
		t.Fatalf("expected APP_DEVELOPER NOT to have CLUSTER_MANAGE")
	}
}

func TestValidateOIDCExchange(t *testing.T) {
	pe := NewPolicyEngine()

	if err := pe.ValidateOIDCExchange("production", "LOCAL_DEV_IDENTITY"); err == nil {
		t.Fatalf("expected production + LOCAL_DEV_IDENTITY to be strictly blocked")
	}
	if err := pe.ValidateOIDCExchange("production", ""); err == nil {
		t.Fatalf("expected production with empty provider to be blocked")
	}
	if err := pe.ValidateOIDCExchange("development", "LOCAL_DEV_IDENTITY"); err != nil {
		t.Fatalf("expected development + LOCAL_DEV_IDENTITY to succeed, got %v", err)
	}
	if err := pe.ValidateOIDCExchange("production", "OIDC_OKTA_ENTERPRISE"); err != nil {
		t.Fatalf("expected production + OIDC_OKTA_ENTERPRISE to succeed, got %v", err)
	}
}

func TestCheckTenantQuota(t *testing.T) {
	pe := NewPolicyEngine()
	tenant := &models.TenantInfo{
		ID: "tenant_acme_corp",
		Quota: models.TenantQuota{
			MaxConcurrentRuns: 5,
			MonthlyBudgetUSD:  100.0,
			UsedBudgetUSD:     95.0,
		},
	}

	if ok, _, _ := pe.CheckTenantQuota(tenant, 2, 1.0); !ok {
		t.Fatalf("expected request within concurrency and budget quota to succeed")
	}
	if ok, code, _ := pe.CheckTenantQuota(tenant, 5, 1.0); ok || code != "CONCURRENCY_QUOTA_EXCEEDED" {
		t.Fatalf("expected concurrency exceeded, got ok=%v code=%s", ok, code)
	}
	if ok, code, _ := pe.CheckTenantQuota(tenant, 2, 10.0); ok || code != "MONTHLY_BUDGET_EXCEEDED" {
		t.Fatalf("expected budget exceeded, got ok=%v code=%s", ok, code)
	}
}

func TestPlanHashCanonicalAndTamperDetection(t *testing.T) {
	pe := NewPolicyEngine()

	p1 := map[string]interface{}{
		"tool_id": "fake_cloud_deploy",
		"args": map[string]interface{}{
			"replicas": 3,
			"cluster":  "prod-us-east-1",
		},
	}
	p2 := map[string]interface{}{
		"args": map[string]interface{}{
			"cluster":  "prod-us-east-1",
			"replicas": 3,
		},
		"tool_id": "fake_cloud_deploy",
	}

	h1 := pe.ComputePlanHash(p1)
	h2 := pe.ComputePlanHash(p2)
	if h1 != h2 || len(h1) != 64 {
		t.Fatalf("expected deterministic 64-char SHA-256 hash independent of map key order, got h1=%s h2=%s", h1, h2)
	}
	if !pe.VerifyPlanHash(h1, p2) {
		t.Fatalf("expected VerifyPlanHash to accept canonical equivalent payload")
	}

	tampered := map[string]interface{}{
		"tool_id": "fake_cloud_deploy",
		"args": map[string]interface{}{
			"cluster":  "prod-us-east-1",
			"replicas": 99,
		},
	}
	if pe.VerifyPlanHash(h1, tampered) {
		t.Fatalf("expected VerifyPlanHash to reject tampered payload")
	}
}

func TestEvaluateToolCallFourWayIntersection(t *testing.T) {
	pe := NewPolicyEngine()

	admin := &models.Principal{ActorID: "usr_elena_admin", ActorName: "Elena", Role: "PLATFORM_ADMIN", Grants: []string{"*"}}
	dev := &models.Principal{ActorID: "usr_alex_dev", ActorName: "Alex", Role: "APP_DEVELOPER", Grants: GrantsForRole("APP_DEVELOPER")}

	agent := &models.AgentDefinition{
		ID:                  "agt_infra_helper",
		Name:                "Ops Agent",
		RequiredPermissions: []string{"TOOL_CALC", "CLOUD_DEPLOY"},
		CurrentDraft: models.AgentDraft{
			ToolWhitelist: []string{"fake_calculator", "fake_cloud_deploy"},
		},
	}

	calcTool := &models.ToolDefinition{ID: "fake_calculator", Name: "Calc", Risk: "LOW", Permissions: []string{"TOOL_CALC"}, IsActive: true}
	deployTool := &models.ToolDefinition{ID: "fake_cloud_deploy", Name: "Deploy", Risk: "HIGH", Permissions: []string{"CLOUD_DEPLOY"}, IsActive: true}
	unlistedTool := &models.ToolDefinition{ID: "tool_redfish_power", Name: "Power", Risk: "HIGH", Permissions: []string{"HOST_MANAGE"}, IsActive: true}
	disabledTool := &models.ToolDefinition{ID: "fake_calculator", Name: "Calc", Risk: "LOW", Permissions: []string{"TOOL_CALC"}, IsActive: false}

	if d := pe.EvaluateToolCall(dev, agent, calcTool, map[string]interface{}{"a": 1}); d.Decision != "ALLOW" || !d.Allowed {
		t.Fatalf("expected ALLOW for dev calling whitelisted LOW tool, got %+v", d)
	}
	if d := pe.EvaluateToolCall(dev, agent, deployTool, map[string]interface{}{"cluster": "prod"}); d.Allowed || d.Decision != "DENY" {
		t.Fatalf("expected DENY for dev lacking CLOUD_DEPLOY grant, got %+v", d)
	}
	if d := pe.EvaluateToolCall(admin, agent, deployTool, map[string]interface{}{"cluster": "prod"}); !d.Allowed || !d.RequiresApproval || d.Decision != "REQUIRE_APPROVAL" || d.RequiredPlanHash == "" {
		t.Fatalf("expected REQUIRE_APPROVAL + PlanHash for HIGH risk tool with admin, got %+v", d)
	}
	if d := pe.EvaluateToolCall(admin, agent, unlistedTool, nil); d.Allowed || !strings.Contains(d.Reason, "whitelist") {
		t.Fatalf("expected DENY when tool not in agent whitelist, got %+v", d)
	}
	if d := pe.EvaluateToolCall(admin, agent, disabledTool, nil); d.Allowed || !strings.Contains(d.Reason, "TOOL_EMERGENCY_DISABLED") {
		t.Fatalf("expected DENY when tool kill-switch is inactive, got %+v", d)
	}
}

func TestSanitizePayloadRecursive(t *testing.T) {
	raw := map[string]interface{}{
		"cluster": "prod-us-east-1",
		"api_key": "sk-secret-12345",
		"nested": map[string]interface{}{
			"signing_secret": "hmac-999",
			"bearer_token":   "eyJhbGci...",
			"safe_field":     "ok",
		},
	}
	sanitized := SanitizePayload(raw)
	if sanitized["api_key"] != "[REDACTED_CREDENTIAL]" {
		t.Fatalf("expected api_key redacted, got %v", sanitized["api_key"])
	}
	if sanitized["cluster"] != "prod-us-east-1" {
		t.Fatalf("expected non-sensitive field preserved, got %v", sanitized["cluster"])
	}
	nested := sanitized["nested"].(map[string]interface{})
	if nested["signing_secret"] != "[REDACTED_CREDENTIAL]" || nested["bearer_token"] != "[REDACTED_CREDENTIAL]" {
		t.Fatalf("expected nested secrets redacted, got %+v", nested)
	}
	if nested["safe_field"] != "ok" {
		t.Fatalf("expected nested safe_field preserved, got %v", nested["safe_field"])
	}
}
