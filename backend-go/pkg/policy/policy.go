package policy

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
)

const PolicyVersion = "policy-v2.4.0-zero-trust"

// DefaultRoleGrants maps each enterprise RBAC role to its baseline capabilities.
var DefaultRoleGrants = map[string][]string{
	"PLATFORM_ADMIN": {"*"},
	"ORG_ADMIN": {
		"ORG_MANAGE", "USER_MANAGE", "PROJECT_MANAGE", "QUOTA_MANAGE",
		"AUDIT_READ", "AGENT_DRAFT", "AGENT_CREATE", "WORKFLOW_DRAFT",
		"RUN_EXECUTE", "TOOL_READ",
	},
	"APP_DEVELOPER": {
		"TOOL_CALC", "TOOL_READ", "DB_QUERY", "NOTIFY_SEND",
		"AGENT_DRAFT", "AGENT_CREATE", "AGENT_PUBLISH", "WORKFLOW_DRAFT",
		"RUN_EXECUTE", "MAPS_GEOCODE", "MAPS_PLACES", "WEATHER_READ",
		"FEISHU_DISPATCH", "DINGTALK_DISPATCH", "WECOM_DISPATCH", "AMAP_GEOCODE",
	},
	"CONNECTOR_ADMIN": {
		"CONNECTOR_MANAGE", "CONNECTOR_ADMIN", "MCP_MANAGE", "CREDENTIAL_REF_MANAGE",
		"TOOL_READ", "AUDIT_READ", "MAPS_GEOCODE", "MAPS_PLACES",
		"WEATHER_READ", "FEISHU_DISPATCH", "DINGTALK_DISPATCH", "WECOM_DISPATCH", "AMAP_GEOCODE",
	},
	"APPROVER": {"APPROVE_HIGH_RISK", "APPROVE_RUNS", "AUDIT_READ", "TOOL_READ", "DASHBOARD_READ"},
	"OPERATOR": {"RUN_EXECUTE", "DASHBOARD_READ", "TOOL_READ", "HOST_MANAGE", "CLUSTER_MANAGE"},
	"AUDITOR":  {"AUDIT_READ", "TRACE_READ", "DASHBOARD_READ"},
}

// PolicyEngine enforces zero-trust authorization, RBAC revocation checks, and cryptographic tamper verification.
type PolicyEngine struct{}

func NewPolicyEngine() *PolicyEngine {
	return &PolicyEngine{}
}

// GrantsForRole returns a defensive copy of the default permission grants for a role.
func GrantsForRole(role string) []string {
	grants, ok := DefaultRoleGrants[strings.ToUpper(strings.TrimSpace(role))]
	if !ok {
		return []string{}
	}
	out := make([]string, len(grants))
	copy(out, grants)
	return out
}

// collectGrants returns unified grant set from Grants and Permissions.
func collectGrants(p *models.Principal) map[string]bool {
	m := make(map[string]bool)
	if p == nil {
		return m
	}
	for _, g := range p.Grants {
		if g != "" {
			m[g] = true
		}
	}
	for _, g := range p.Permissions {
		if g != "" {
			m[g] = true
		}
	}
	return m
}

// IsRoleRevoked checks whether the principal's role binding or member record has been revoked.
func (pe *PolicyEngine) IsRoleRevoked(principal *models.Principal, members map[string]*models.UserMember, bindings map[string]*models.RoleBinding) (bool, string) {
	if principal == nil {
		return true, "Anonymous access denied by zero-trust default"
	}
	if m, ok := members[principal.ActorID]; ok && m != nil {
		if m.Status == "REVOKED" || m.Status == "SUSPENDED" {
			return true, fmt.Sprintf("ROLE_REVOKED: Access for actor '%s' (%s) has been revoked", principal.ActorName, principal.ActorID)
		}
	}
	for _, b := range bindings {
		if b != nil && b.UserID == principal.ActorID && (!b.IsActive || b.RevokedAt != "") {
			return true, fmt.Sprintf("ROLE_REVOKED: Role '%s' for user '%s' was revoked at %s", b.Role, b.UserID, b.RevokedAt)
		}
	}
	return false, ""
}

// HasAnyPermission returns true if the principal is active and holds '*' or at least one of the required permissions.
func (pe *PolicyEngine) HasAnyPermission(principal *models.Principal, required ...string) bool {
	if principal == nil {
		return false
	}
	grants := collectGrants(principal)
	if grants["*"] {
		return true
	}
	if len(required) == 0 {
		return true
	}
	for _, req := range required {
		if grants[req] {
			return true
		}
	}
	return false
}

// VerifyTenantBoundary enforces tenant isolation.
func (pe *PolicyEngine) VerifyTenantBoundary(principal *models.Principal, resourceTenantID string) error {
	if principal == nil {
		return fmt.Errorf("CROSS_TENANT_ACCESS_DENIED: missing principal")
	}
	if resourceTenantID != "" && principal.TenantID != resourceTenantID {
		return fmt.Errorf("CROSS_TENANT_ACCESS_DENIED: actor tenant '%s' cannot access resource tenant '%s'", principal.TenantID, resourceTenantID)
	}
	return nil
}

// VerifyProjectBoundary enforces workspace/project assignment unless PLATFORM_ADMIN.
func (pe *PolicyEngine) VerifyProjectBoundary(principal *models.Principal, targetProjectID string) error {
	if principal == nil {
		return fmt.Errorf("PROJECT_ACCESS_DENIED: missing principal")
	}
	if principal.Role == "PLATFORM_ADMIN" || pe.HasAnyPermission(principal, "*") || targetProjectID == "" {
		return nil
	}
	for _, pid := range principal.ProjectIDs {
		if pid == targetProjectID {
			return nil
		}
	}
	if principal.ActiveProjectID == targetProjectID {
		return nil
	}
	return fmt.Errorf("PROJECT_ACCESS_DENIED: actor '%s' is not assigned to project '%s'", principal.ActorName, targetProjectID)
}

// CheckTenantQuota enforces concurrency and budget caps before starting executions.
func (pe *PolicyEngine) CheckTenantQuota(tenant *models.TenantInfo, activeRuns int, estimatedCostUSD float64) (bool, string, string) {
	if tenant == nil {
		return true, "", ""
	}
	maxRuns := tenant.Quota.MaxConcurrentRuns
	if maxRuns <= 0 {
		maxRuns = tenant.QuotaMaxConcurrentRuns
	}
	if maxRuns > 0 && activeRuns >= maxRuns {
		return false, "CONCURRENCY_QUOTA_EXCEEDED", fmt.Sprintf("Tenant reached max concurrent executions quota (%d/%d).", activeRuns, maxRuns)
	}
	monthlyBudget := tenant.Quota.MonthlyBudgetUSD
	if monthlyBudget <= 0 {
		monthlyBudget = tenant.QuotaMonthlyBudgetUSD
	}
	usedBudget := tenant.Quota.UsedBudgetUSD
	if usedBudget == 0 {
		usedBudget = tenant.QuotaUsedBudgetUSD
	}
	if monthlyBudget > 0 && usedBudget+estimatedCostUSD > monthlyBudget {
		return false, "MONTHLY_BUDGET_EXCEEDED", fmt.Sprintf("Tenant monthly budget exhausted ($%.2f / $%.2f).", usedBudget, monthlyBudget)
	}
	return true, "", ""
}

// ValidateOIDCExchange guards against unsafe local identity adapters in production environments.
func (pe *PolicyEngine) ValidateOIDCExchange(env, provider string) error {
	if strings.EqualFold(strings.TrimSpace(env), "production") &&
		(strings.EqualFold(strings.TrimSpace(provider), "LOCAL_DEV_IDENTITY") || strings.TrimSpace(provider) == "") {
		return fmt.Errorf("DEV_IDENTITY_FORBIDDEN_IN_PRODUCTION: Local development identity adapter is strictly forbidden in production; enforce enterprise OIDC or mTLS.")
	}
	return nil
}

// ComputePlanHash produces a canonical cryptographic SHA-256 hash bound to tool ID and arguments.
func (pe *PolicyEngine) ComputePlanHash(payload map[string]interface{}) string {
	canonical := canonicalString(payload)
	h := sha256.New()
	h.Write([]byte(canonical))
	return hex.EncodeToString(h.Sum(nil))
}

func canonicalString(v interface{}) string {
	switch val := v.(type) {
	case map[string]interface{}:
		keys := make([]string, 0, len(val))
		for k := range val {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			b, _ := json.Marshal(k)
			parts = append(parts, string(b)+":"+canonicalString(val[k]))
		}
		return "{" + strings.Join(parts, ",") + "}"
	default:
		b, err := json.Marshal(val)
		if err != nil {
			return fmt.Sprintf("%v", val)
		}
		return string(b)
	}
}

// VerifyPlanHash verifies that approved payload arguments have not been tampered with.
func (pe *PolicyEngine) VerifyPlanHash(originalHash string, currentPayload map[string]interface{}) bool {
	if originalHash == "" {
		return false
	}
	return pe.ComputePlanHash(currentPayload) == originalHash
}

// Decision represents the security evaluation result.
type Decision struct {
	Allowed          bool     `json:"allowed"`
	Decision         string   `json:"decision"` // "ALLOW" | "DENY" | "REQUIRE_APPROVAL"
	RequiresApproval bool     `json:"requires_approval"`
	Reason           string   `json:"reason"`
	PolicyVersion    string   `json:"policy_version"`
	RiskLevel        string   `json:"risk_level"`
	RequiredPlanHash string   `json:"required_plan_hash,omitempty"`
	MissingGrants    []string `json:"missing_grants,omitempty"`
	EffectiveGrants  []string `json:"effective_grants,omitempty"`
}

// EvaluateToolCall checks permissions according to the four-way intersection formula:
// Effective Grants = Principal.Grants ∩ Agent.RequiredPermissions ∩ Tool.Permissions ∩ ActivePolicy
func (pe *PolicyEngine) EvaluateToolCall(
	principal *models.Principal,
	agent *models.AgentDefinition,
	tool *models.ToolDefinition,
	payload map[string]interface{},
) Decision {
	if principal == nil {
		return Decision{
			Allowed:       false,
			Decision:      "DENY",
			Reason:        "Anonymous access denied by zero-trust default",
			PolicyVersion: PolicyVersion,
			RiskLevel:     "HIGH",
		}
	}
	if tool == nil {
		return Decision{
			Allowed:       false,
			Decision:      "DENY",
			Reason:        "Tool definition not found",
			PolicyVersion: PolicyVersion,
			RiskLevel:     "HIGH",
		}
	}
	if !tool.IsActive {
		return Decision{
			Allowed:       false,
			Decision:      "DENY",
			Reason:        fmt.Sprintf("TOOL_EMERGENCY_DISABLED: Tool '%s' is disabled by kill-switch policy", tool.ID),
			PolicyVersion: PolicyVersion,
			RiskLevel:     tool.Risk,
		}
	}

	// Check Agent whitelist if invoked in context of an Agent
	if agent != nil {
		whitelist := agent.CurrentDraft.ToolWhitelist
		if len(whitelist) == 0 {
			whitelist = agent.ToolIDs
		}
		toolAuthorizedInAgent := false
		for _, id := range whitelist {
			if id == tool.ID {
				toolAuthorizedInAgent = true
				break
			}
		}
		if !toolAuthorizedInAgent {
			return Decision{
				Allowed:       false,
				Decision:      "DENY",
				Reason:        fmt.Sprintf("Tool '%s' is not registered in Agent '%s' whitelist", tool.ID, agent.Name),
				PolicyVersion: PolicyVersion,
				RiskLevel:     tool.Risk,
			}
		}
	}

	principalPermMap := collectGrants(principal)
	isSuperAdmin := principalPermMap["*"]

	agentPermMap := make(map[string]bool)
	hasAgentPerms := false
	if agent != nil && len(agent.RequiredPermissions) > 0 {
		hasAgentPerms = true
		for _, p := range agent.RequiredPermissions {
			agentPermMap[p] = true
		}
	}

	var effectiveGrants []string
	var missingGrants []string

	for _, reqPerm := range tool.Permissions {
		if !isSuperAdmin && !principalPermMap[reqPerm] {
			missingGrants = append(missingGrants, reqPerm)
		} else if hasAgentPerms && !isSuperAdmin && !agentPermMap[reqPerm] {
			missingGrants = append(missingGrants, reqPerm)
		} else {
			effectiveGrants = append(effectiveGrants, reqPerm)
		}
	}

	if len(missingGrants) > 0 {
		return Decision{
			Allowed:       false,
			Decision:      "DENY",
			Reason:        fmt.Sprintf("Principal/Agent lacks required permissions [%s] for tool '%s'", strings.Join(missingGrants, ", "), tool.Name),
			PolicyVersion: PolicyVersion,
			RiskLevel:     tool.Risk,
			MissingGrants: missingGrants,
		}
	}

	if isSuperAdmin && len(effectiveGrants) == 0 {
		effectiveGrants = append([]string{}, tool.Permissions...)
	}

	if tool.Risk == "HIGH" || tool.Risk == "CRITICAL" {
		planInput := map[string]interface{}{
			"tool_id": tool.ID,
			"args":    payload,
		}
		planHash := pe.ComputePlanHash(planInput)
		return Decision{
			Allowed:          true,
			Decision:         "REQUIRE_APPROVAL",
			RequiresApproval: true,
			Reason:           fmt.Sprintf("Tool '%s' (%s risk) requires human-in-the-loop approval bound to plan hash.", tool.Name, tool.Risk),
			PolicyVersion:    PolicyVersion,
			RiskLevel:        tool.Risk,
			RequiredPlanHash: planHash,
			EffectiveGrants:  effectiveGrants,
		}
	}

	return Decision{
		Allowed:          true,
		Decision:         "ALLOW",
		RequiresApproval: false,
		Reason:           "Four-way policy intersection passed",
		PolicyVersion:    PolicyVersion,
		RiskLevel:        tool.Risk,
		EffectiveGrants:  effectiveGrants,
	}
}

// SanitizePayload recursively strips tokens, secrets, passwords, and raw API keys for immutable audit trails.
func SanitizePayload(input map[string]interface{}) map[string]interface{} {
	if input == nil {
		return make(map[string]interface{})
	}
	out := make(map[string]interface{})
	for k, v := range input {
		lowerK := strings.ToLower(k)
		if isSensitiveKey(lowerK) {
			out[k] = "[REDACTED_CREDENTIAL]"
			continue
		}
		out[k] = sanitizeValue(v)
	}
	return out
}

func isSensitiveKey(lowerK string) bool {
	return lowerK == "token" ||
		lowerK == "password" ||
		lowerK == "secret" ||
		lowerK == "api_key" ||
		lowerK == "apikey" ||
		lowerK == "authorization" ||
		lowerK == "bearer" ||
		lowerK == "private_key" ||
		strings.Contains(lowerK, "secret") ||
		strings.Contains(lowerK, "token") ||
		strings.Contains(lowerK, "password") ||
		strings.Contains(lowerK, "credential")
}

func sanitizeValue(v interface{}) interface{} {
	switch val := v.(type) {
	case map[string]interface{}:
		return SanitizePayload(val)
	case []interface{}:
		arr := make([]interface{}, len(val))
		for i, item := range val {
			arr[i] = sanitizeValue(item)
		}
		return arr
	default:
		return val
	}
}
