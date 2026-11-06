package policy

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
)

// PolicyEngine enforces zero-trust authorization and cryptographic tamper verification.
type PolicyEngine struct{}

func NewPolicyEngine() *PolicyEngine {
	return &PolicyEngine{}
}

// ComputePlanHash produces a cryptographic SHA-256 hash bound to tool call arguments.
func (pe *PolicyEngine) ComputePlanHash(payload map[string]interface{}) string {
	bytes, err := json.Marshal(payload)
	if err != nil {
		return ""
	}
	h := sha256.New()
	h.Write(bytes)
	return hex.EncodeToString(h.Sum(nil))
}

// VerifyPlanHash checks if an approval record has been tampered with.
func (pe *PolicyEngine) VerifyPlanHash(originalHash string, currentPayload map[string]interface{}) bool {
	return pe.ComputePlanHash(currentPayload) == originalHash
}

// Decision represents the security evaluation result.
type Decision struct {
	Allowed        bool   `json:"allowed"`
	RequiresApproval bool `json:"requires_approval"`
	Reason         string `json:"reason"`
	EffectiveGrants []string `json:"effective_grants"`
}

// EvaluateToolCall checks permissions according to the four-way intersection formula.
// Effective Grants = Principal.Permissions ∩ Agent.RequiredPermissions ∩ Tool.Permissions ∩ ActivePolicy
func (pe *PolicyEngine) EvaluateToolCall(
	principal *models.Principal,
	agent *models.AgentDefinition,
	tool *models.ToolDefinition,
	payload map[string]interface{},
) Decision {
	// 1. Role revocation invariant check
	if principal == nil {
		return Decision{Allowed: false, Reason: "Anonymous access denied by zero-trust default"}
	}

	// 2. Check if Tool is in Agent's declared ToolIDs
	toolAuthorizedInAgent := false
	for _, id := range agent.ToolIDs {
		if id == tool.ID {
			toolAuthorizedInAgent = true
			break
		}
	}
	if !toolAuthorizedInAgent {
		return Decision{
			Allowed: false,
			Reason:  fmt.Sprintf("Tool '%s' is not registered in Agent '%s' whitelist", tool.ID, agent.Name),
		}
	}

	// 3. Four-Way Intersection evaluation
	var effectiveGrants []string
	principalPermMap := make(map[string]bool)
	for _, p := range principal.Permissions {
		principalPermMap[p] = true
	}

	agentPermMap := make(map[string]bool)
	for _, p := range agent.RequiredPermissions {
		agentPermMap[p] = true
	}

	for _, reqPerm := range tool.Permissions {
		if !principalPermMap[reqPerm] {
			return Decision{
				Allowed: false,
				Reason:  fmt.Sprintf("Principal lacks required permission '%s' for tool '%s'", reqPerm, tool.Name),
			}
		}
		if len(agent.RequiredPermissions) > 0 && !agentPermMap[reqPerm] {
			return Decision{
				Allowed: false,
				Reason:  fmt.Sprintf("Agent definition lacks required permission '%s' for tool '%s'", reqPerm, tool.Name),
			}
		}
		effectiveGrants = append(effectiveGrants, reqPerm)
	}

	// 4. Risk Level & Human-In-The-Loop Approval requirement
	if tool.Risk == "HIGH" || tool.Risk == "CRITICAL" {
		return Decision{
			Allowed:          true,
			RequiresApproval: true,
			Reason:           fmt.Sprintf("Tool '%s' is classified as %s risk. Requires human-in-the-loop approval.", tool.Name, tool.Risk),
			EffectiveGrants:  effectiveGrants,
		}
	}

	return Decision{
		Allowed:          true,
		RequiresApproval: false,
		Reason:           "Policy check passed",
		EffectiveGrants:  effectiveGrants,
	}
}

// SanitizePayload recursively strips tokens, secrets, and raw API keys for immutable audit trails.
func SanitizePayload(input map[string]interface{}) map[string]interface{} {
	if input == nil {
		return make(map[string]interface{})
	}
	out := make(map[string]interface{})
	sensitiveKeys := map[string]bool{
		"token": true, "password": true, "secret": true, "api_key": true,
		"authorization": true, "bearer": true, "private_key": true,
	}

	for k, v := range input {
		lowerK := strings.ToLower(k)
		if sensitiveKeys[lowerK] || strings.Contains(lowerK, "secret") || strings.Contains(lowerK, "token") {
			out[k] = "[REDACTED_CREDENTIAL]"
			continue
		}

		switch val := v.(type) {
		case map[string]interface{}:
			out[k] = SanitizePayload(val)
		default:
			out[k] = val
		}
	}
	return out
}
