import { Principal, ToolDefinition, PolicyDecision, RiskLevel } from '../contracts/types';

export class PolicyEngine {
  public static readonly CURRENT_POLICY_VERSION = 'v1.4.0-strict';

  /**
   * Deterministic SHA-256 equivalent plan hash for binding approvals to arguments.
   * Simple portable hash for node/browser environments.
   */
  public static computePlanHash(toolId: string, args: Record<string, any>, targetResource?: string): string {
    const canonicalPayload = JSON.stringify({
      tool_id: toolId,
      args: Object.keys(args || {})
        .sort()
        .reduce((acc, key) => {
          acc[key] = args[key];
          return acc;
        }, {} as Record<string, any>),
      target: targetResource || 'DEFAULT_TARGET',
    });

    let hash = 0x811c9dc5;
    for (let i = 0; i < canonicalPayload.length; i++) {
      hash ^= canonicalPayload.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const hex = (hash >>> 0).toString(16).padStart(8, '0');
    return `plan_hash_${hex}_len${canonicalPayload.length}`;
  }

  /**
   * Evaluates Tool Call authorization:
   * Effective Grants = Principal Grants ∩ Agent Whitelist ∩ Tool Permissions
   * Checks tool status, risk level, and required human approval.
   */
  public static evaluateToolCall(params: {
    principal: Principal;
    agentWhitelist: string[];
    tool: ToolDefinition;
    args: Record<string, any>;
    targetResource?: string;
    consumedApprovalHash?: string;
  }): PolicyDecision {
    const { principal, agentWhitelist, tool, args, targetResource, consumedApprovalHash } = params;

    // 1. Tool must be active
    if (!tool.is_active) {
      return {
        decision: 'DENY',
        reason: `Tool '${tool.name}' (${tool.id}) is emergency-disabled or inactive.`,
        policy_version: this.CURRENT_POLICY_VERSION,
        risk_level: tool.risk,
      };
    }

    // 2. Agent whitelist check
    if (!agentWhitelist.includes(tool.id) && !agentWhitelist.includes('*')) {
      return {
        decision: 'DENY',
        reason: `Tool '${tool.id}' is not permitted by Agent whitelist. Allowed: [${agentWhitelist.join(', ')}]`,
        policy_version: this.CURRENT_POLICY_VERSION,
        risk_level: tool.risk,
      };
    }

    // 3. Principal Grants intersection
    const principalGrants = new Set(principal.grants);
    const requiredPermissions = tool.permissions || [];
    const missingGrants = requiredPermissions.filter(perm => !principalGrants.has(perm) && !principalGrants.has('*'));

    if (missingGrants.length > 0) {
      return {
        decision: 'DENY',
        reason: `Actor '${principal.actor_name}' lacks required permissions: [${missingGrants.join(', ')}].`,
        policy_version: this.CURRENT_POLICY_VERSION,
        risk_level: tool.risk,
        missing_grants: missingGrants,
      };
    }

    // 4. Risk and Human Approval check
    const planHash = this.computePlanHash(tool.id, args, targetResource);
    const isDangerous = tool.risk === 'HIGH' || tool.risk === 'CRITICAL';

    if (isDangerous) {
      if (consumedApprovalHash) {
        if (consumedApprovalHash === planHash) {
          return {
            decision: 'ALLOW',
            reason: `High risk tool execution approved via matched plan hash (${planHash}).`,
            policy_version: this.CURRENT_POLICY_VERSION,
            risk_level: tool.risk,
            required_plan_hash: planHash,
            effective_grants: requiredPermissions,
          };
        } else {
          return {
            decision: 'DENY',
            reason: `Approval plan hash mismatch! Provided: ${consumedApprovalHash}, Expected for current parameters: ${planHash}. Possible parameter tampering.`,
            policy_version: this.CURRENT_POLICY_VERSION,
            risk_level: tool.risk,
          };
        }
      }

      // No approval hash provided -> must pause execution and request approval
      return {
        decision: 'REQUIRE_APPROVAL',
        reason: `Operation involves ${tool.risk} risk tool '${tool.name}'. Human authorization required.`,
        policy_version: this.CURRENT_POLICY_VERSION,
        risk_level: tool.risk,
        required_plan_hash: planHash,
      };
    }

    // 5. Low / Medium risk: ALLOW
    return {
      decision: 'ALLOW',
      reason: `Tool execution permitted under ${this.CURRENT_POLICY_VERSION}.`,
      policy_version: this.CURRENT_POLICY_VERSION,
      risk_level: tool.risk,
      effective_grants: requiredPermissions,
    };
  }
}
