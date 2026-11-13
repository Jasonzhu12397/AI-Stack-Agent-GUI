package store

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/policy"
)

// Store provides concurrency-safe transactional storage with WAL aligned auditing.
type Store struct {
	mu           sync.RWMutex
	Tenants      map[string]*models.TenantInfo
	Projects     map[string]*models.ProjectInfo
	Members      map[string]*models.UserMember
	RoleBindings map[string]*models.RoleBinding
	Models       map[string]*models.ModelConfig
	Tools        map[string]*models.ToolDefinition
	Agents       map[string]*models.AgentDefinition
	Workflows    map[string]*models.WorkflowDefinition
	Runs         map[string]*models.ExecutionRun
	RunOrder     []string
	Approvals    map[string]*models.ApprovalRecord
	Audits       []*models.AuditEvent
	CurrentActor *models.Principal
	Principals   map[string]*models.Principal
	StartTime    time.Time
}

func NewStore() *Store {
	s := &Store{
		Tenants:      make(map[string]*models.TenantInfo),
		Projects:     make(map[string]*models.ProjectInfo),
		Members:      make(map[string]*models.UserMember),
		RoleBindings: make(map[string]*models.RoleBinding),
		Models:       make(map[string]*models.ModelConfig),
		Tools:        make(map[string]*models.ToolDefinition),
		Agents:       make(map[string]*models.AgentDefinition),
		Workflows:    make(map[string]*models.WorkflowDefinition),
		Runs:         make(map[string]*models.ExecutionRun),
		RunOrder:     make([]string, 0),
		Approvals:    make(map[string]*models.ApprovalRecord),
		Audits:       make([]*models.AuditEvent, 0),
		Principals:   make(map[string]*models.Principal),
		StartTime:    time.Now(),
	}
	s.seed()
	return s
}

func (s *Store) Lock()   { s.mu.Lock() }
func (s *Store) Unlock() { s.mu.Unlock() }
func (s *Store) RLock()  { s.mu.RLock() }
func (s *Store) RUnlock() { s.mu.RUnlock() }

func (s *Store) seed() {
	now := time.Now()
	nowISO := now.UTC().Format(time.RFC3339)
	allProjects := []string{"proj_infra_ops", "proj_prod_infra", "proj_ai_analytics"}

	// Tenants & Projects
	s.Tenants["tenant_acme_corp"] = &models.TenantInfo{
		ID:     "tenant_acme_corp",
		Name:   "Acme Enterprise Global",
		Slug:   "acme-global",
		Plan:   "ENTERPRISE_PREMIUM",
		Status: "ACTIVE",
		Quota: models.TenantQuota{
			MaxConcurrentRuns: 20,
			MonthlyBudgetUSD:  10000.0,
			UsedBudgetUSD:     340.50,
		},
		QuotaMaxConcurrentRuns: 20,
		QuotaMonthlyBudgetUSD:  10000.0,
		QuotaUsedBudgetUSD:     340.50,
		CreatedAt:              now.Add(-360 * 24 * time.Hour),
	}

	s.Projects["proj_infra_ops"] = &models.ProjectInfo{
		ID:          "proj_infra_ops",
		TenantID:    "tenant_acme_corp",
		Name:        "Infrastructure & SRE Ops",
		Description: "Core Kubernetes fleet orchestration, zero-trust automation, and cloud deployments.",
		CreatedAt:   now.Add(-240 * 24 * time.Hour),
	}
	s.Projects["proj_prod_infra"] = &models.ProjectInfo{
		ID:          "proj_prod_infra",
		TenantID:    "tenant_acme_corp",
		Name:        "BareMetal & Cloud Native Infra",
		Description: "Production Metal3 Ironic fleet and large-scale GPU Kubernetes clusters.",
		CreatedAt:   now.Add(-180 * 24 * time.Hour),
	}
	s.Projects["proj_ai_analytics"] = &models.ProjectInfo{
		ID:          "proj_ai_analytics",
		TenantID:    "tenant_acme_corp",
		Name:        "Enterprise Data & AI Connectors",
		Description: "Workspace, Maps, Weather, and Domestic Enterprise Webhook integrations.",
		CreatedAt:   now.Add(-90 * 24 * time.Hour),
	}

	// Seed Principals & Members matching identity.ts + OrgMembersView
	seedUsers := []struct {
		id        string
		name      string
		email     string
		role      string
		projects  []string
		activePrj string
		status    string
		invitedBy string
	}{
		{"usr_elena_admin", "Elena Rostova", "elena@acme.corp", "PLATFORM_ADMIN", allProjects, "proj_infra_ops", "ACTIVE", "SYSTEM_ROOT"},
		{"usr_alex_dev", "Alex Chen", "alex@acme.corp", "APP_DEVELOPER", []string{"proj_infra_ops", "proj_ai_analytics"}, "proj_infra_ops", "ACTIVE", "Elena Rostova"},
		{"usr_marcus_approver", "Marcus Vance", "marcus@acme.corp", "APPROVER", allProjects, "proj_infra_ops", "ACTIVE", "Elena Rostova"},
		{"usr_sarah_connector", "Sarah Jenkins", "sarah@acme.corp", "CONNECTOR_ADMIN", []string{"proj_infra_ops", "proj_ai_analytics"}, "proj_ai_analytics", "ACTIVE", "Elena Rostova"},
		{"usr_devon_revoked", "Devon Lee", "devon@acme.corp", "OPERATOR", []string{"proj_infra_ops"}, "proj_infra_ops", "REVOKED", "Elena Rostova"},
	}

	for _, u := range seedUsers {
		grants := policy.GrantsForRole(u.role)
		if u.status == "REVOKED" {
			grants = []string{}
		}
		p := &models.Principal{
			ActorID:         u.id,
			ActorName:       u.name,
			ActorType:       "USER",
			TenantID:        "tenant_acme_corp",
			TenantName:      "Acme Enterprise Global",
			ProjectIDs:      u.projects,
			ActiveProjectID: u.activePrj,
			Role:            u.role,
			Grants:          grants,
			Permissions:     grants,
			AuthContext: models.AuthContext{
				AuthenticatedAt: nowISO,
				AuthMethod:      "OIDC_MOCK",
				IPAddress:       "10.240.10.25",
				SessionID:       fmt.Sprintf("sess_%s_go", u.id),
			},
		}
		s.Principals[u.id] = p

		s.Members[u.id] = &models.UserMember{
			ID:         u.id,
			TenantID:   "tenant_acme_corp",
			Email:      u.email,
			Name:       u.name,
			Role:       u.role,
			ProjectIDs: u.projects,
			Grants:     policy.GrantsForRole(u.role),
			Status:     u.status,
			InvitedBy:  u.invitedBy,
			CreatedAt:  now.Add(-120 * 24 * time.Hour),
		}

		revokedAt := ""
		revokedBy := ""
		isActive := u.status == "ACTIVE"
		if !isActive {
			revokedAt = now.Add(-48 * time.Hour).UTC().Format(time.RFC3339)
			revokedBy = "Elena Rostova"
		}
		rbID := fmt.Sprintf("rb_%s", u.id)
		s.RoleBindings[rbID] = &models.RoleBinding{
			ID:         rbID,
			UserID:     u.id,
			TenantID:   "tenant_acme_corp",
			ProjectID:  u.activePrj,
			Role:       u.role,
			Grants:     policy.GrantsForRole(u.role),
			AssignedAt: now.Add(-120 * 24 * time.Hour).UTC().Format(time.RFC3339),
			AssignedBy: u.invitedBy,
			RevokedAt:  revokedAt,
			RevokedBy:  revokedBy,
			IsActive:   isActive,
		}
	}
	s.CurrentActor = s.Principals["usr_elena_admin"]

	// Models
	s.Models["fake_fast_model"] = &models.ModelConfig{
		ID:           "fake_fast_model",
		Name:         "Deterministic Policy Sandbox Model",
		Provider:     "FAKE",
		ModelString:  "fake-deterministic-v1",
		ModelName:    "Deterministic Policy Sandbox Model",
		ContextWin:   128000,
		InputCost1K:  0.0005,
		OutputCost1K: 0.0015,
		Capabilities: models.ModelCapabilities{SupportsStructuredOutput: true, SupportsTools: true, SupportsVision: false, SupportsStreaming: true},
		IsActive:     true,
		IsFake:       true,
	}
	s.Models["model_gemini_2_5_pro"] = &models.ModelConfig{
		ID:           "model_gemini_2_5_pro",
		Name:         "Gemini 2.5 Pro (Thinking System)",
		Provider:     "GOOGLE_GEMINI",
		ModelString:  "gemini-2.5-pro",
		ModelName:    "Gemini 2.5 Pro (Thinking System)",
		ContextWin:   1048576,
		InputCost1K:  0.00125,
		OutputCost1K: 0.00500,
		Capabilities: models.ModelCapabilities{SupportsStructuredOutput: true, SupportsTools: true, SupportsVision: true, SupportsStreaming: true},
		IsActive:     true,
		IsFake:       false,
	}

	// Core Tools
	s.Tools["fake_calculator"] = &models.ToolDefinition{
		ID:              "fake_calculator",
		Name:            "Deterministic Calculator",
		Version:         "1.0.0",
		Description:     "Performs arithmetic capacity & headroom calculations inside isolated Go sandbox.",
		Category:        "CODE",
		Risk:            "LOW",
		Permissions:     []string{"TOOL_CALC"},
		InputSchema:     map[string]interface{}{"type": "object", "properties": map[string]interface{}{"a": map[string]string{"type": "number"}, "b": map[string]string{"type": "number"}, "operation": map[string]string{"type": "string"}}},
		OutputSchema:    map[string]interface{}{"type": "object", "properties": map[string]interface{}{"result": map[string]string{"type": "number"}}},
		IdempotencyMode: "IDEMPOTENT",
		TimeoutMs:       1500,
		RetryPolicy:     models.RetryPolicy{MaxRetries: 2, BackoffMs: 100},
		NetworkTargets:  []string{},
		IsActive:        true,
		IsFake:          true,
	}
	s.Tools["fake_db_query"] = &models.ToolDefinition{
		ID:              "fake_db_query",
		Name:            "Read-Only Telemetry DB Query",
		Version:         "1.2.0",
		Description:     "Queries enterprise asset inventory and diagnostic records safely.",
		Category:        "DATABASE",
		Risk:            "LOW",
		Permissions:     []string{"DB_QUERY"},
		InputSchema:     map[string]interface{}{"type": "object", "properties": map[string]interface{}{"query_type": map[string]string{"type": "string"}}},
		OutputSchema:    map[string]interface{}{"type": "object", "properties": map[string]interface{}{"rows": map[string]string{"type": "array"}}},
		IdempotencyMode: "IDEMPOTENT",
		TimeoutMs:       3000,
		RetryPolicy:     models.RetryPolicy{MaxRetries: 2, BackoffMs: 150},
		NetworkTargets:  []string{"postgres.internal:5432"},
		IsActive:        true,
		IsFake:          true,
	}
	s.Tools["fake_send_notification"] = &models.ToolDefinition{
		ID:              "fake_send_notification",
		Name:            "Ops Channel Notifier",
		Version:         "1.0.0",
		Description:     "Sends sanitized status notifications to incident Slack/Feishu ops channels.",
		Category:        "COMMUNICATION",
		Risk:            "MEDIUM",
		Permissions:     []string{"NOTIFY_SEND"},
		InputSchema:     map[string]interface{}{"type": "object", "properties": map[string]interface{}{"channel": map[string]string{"type": "string"}, "message": map[string]string{"type": "string"}}},
		OutputSchema:    map[string]interface{}{"type": "object", "properties": map[string]interface{}{"delivered": map[string]string{"type": "boolean"}}},
		IdempotencyMode: "AT_LEAST_ONCE",
		TimeoutMs:       2500,
		RetryPolicy:     models.RetryPolicy{MaxRetries: 2, BackoffMs: 200},
		NetworkTargets:  []string{"hooks.internal.acme.corp"},
		IsActive:        true,
		IsFake:          true,
	}
	s.Tools["fake_cloud_deploy"] = &models.ToolDefinition{
		ID:              "fake_cloud_deploy",
		Name:            "Production Cloud Rollout Dispatcher",
		Version:         "2.0.0",
		Description:     "Deploys workloads or scales Kubernetes worker pools in production environments. Requires human approval + SHA-256 Plan Hash.",
		Category:        "CLOUD",
		Risk:            "HIGH",
		Permissions:     []string{"CLOUD_DEPLOY"},
		InputSchema:     map[string]interface{}{"type": "object", "properties": map[string]interface{}{"cluster": map[string]string{"type": "string"}, "manifest_name": map[string]string{"type": "string"}, "replicas": map[string]string{"type": "number"}}},
		OutputSchema:    map[string]interface{}{"type": "object", "properties": map[string]interface{}{"deployment_id": map[string]string{"type": "string"}}},
		IdempotencyMode: "NON_IDEMPOTENT",
		TimeoutMs:       10000,
		RetryPolicy:     models.RetryPolicy{MaxRetries: 0, BackoffMs: 0},
		NetworkTargets:  []string{"k8s-api.prod.acme.corp:6443"},
		IsActive:        true,
		IsFake:          true,
	}
	s.Tools["tool_redfish_power"] = &models.ToolDefinition{
		ID:              "tool_redfish_power",
		Name:            "redfish_power_control",
		Version:         "1.0.0",
		Description:     "Out-of-band server power control via Redfish API (power-on, power-off, reboot).",
		Category:        "INFRASTRUCTURE",
		Risk:            "HIGH",
		Permissions:     []string{"HOST_MANAGE"},
		InputSchema:     map[string]interface{}{"type": "object", "properties": map[string]interface{}{"host_name": map[string]string{"type": "string"}, "action": map[string]string{"type": "string"}}},
		OutputSchema:    map[string]interface{}{"type": "object", "properties": map[string]interface{}{"power_status": map[string]string{"type": "string"}}},
		IdempotencyMode: "NON_IDEMPOTENT",
		TimeoutMs:       8000,
		RetryPolicy:     models.RetryPolicy{MaxRetries: 0, BackoffMs: 0},
		NetworkTargets:  []string{"10.240.10.0/24"},
		IsActive:        true,
		IsFake:          false,
	}
	s.Tools["tool_k8s_cordon_drain"] = &models.ToolDefinition{
		ID:              "tool_k8s_cordon_drain",
		Name:            "k8s_node_cordon_drain",
		Version:         "1.1.0",
		Description:     "Safely evict workloads and mark K8s node as unschedulable for rolling upgrades.",
		Category:        "INFRASTRUCTURE",
		Risk:            "HIGH",
		Permissions:     []string{"CLUSTER_MANAGE"},
		InputSchema:     map[string]interface{}{"type": "object", "properties": map[string]interface{}{"node_name": map[string]string{"type": "string"}, "timeout": map[string]string{"type": "number"}}},
		OutputSchema:    map[string]interface{}{"type": "object", "properties": map[string]interface{}{"cordoned": map[string]string{"type": "boolean"}}},
		IdempotencyMode: "IDEMPOTENT",
		TimeoutMs:       15000,
		RetryPolicy:     models.RetryPolicy{MaxRetries: 1, BackoffMs: 500},
		NetworkTargets:  []string{"10.240.10.10:6443"},
		IsActive:        true,
		IsFake:          false,
	}

	pe := policy.NewPolicyEngine()

	// Seed Agents
	snap1Hash := pe.ComputePlanHash(map[string]interface{}{"id": "agt_infra_helper", "version": "v1.0.0"})
	snap1 := models.RunSnapshot{
		DefinitionID:      "agt_infra_helper",
		DefinitionVersion: "v1.0.0",
		DefinitionName:    "Cluster Diagnostics & Ops Agent",
		ModelID:           "fake_fast_model",
		ModelVersion:      "fake-deterministic-v1",
		ToolVersions:      map[string]string{"fake_calculator": "1.0.0", "fake_db_query": "1.2.0", "fake_send_notification": "1.0.0", "fake_cloud_deploy": "2.0.0"},
		SkillVersions:     map[string]string{},
		PolicyVersion:     policy.PolicyVersion,
		CreatedAt:         now.Add(-48 * time.Hour).UTC().Format(time.RFC3339),
		SnapshotHash:      snap1Hash,
	}

	s.Agents["agt_infra_helper"] = &models.AgentDefinition{
		ID:          "agt_infra_helper",
		TenantID:    "tenant_acme_corp",
		ProjectID:   "proj_infra_ops",
		Name:        "Cluster Diagnostics & Ops Agent",
		Version:     "v1.0.0",
		Description: "Validates capacity math, queries cluster telemetry DB, and orchestrates zero-trust cloud deployments.",
		CurrentDraft: models.AgentDraft{
			SystemPrompt:   "You are the Enterprise SRE Assistant. Diagnose cluster headroom using calculator & DB query tools, and escalate any production rollout via governance approval.",
			ModelID:        "fake_fast_model",
			Temperature:    0.1,
			MaxSteps:       6,
			TimeoutSeconds: 60,
			BudgetLimitUSD: 1.5,
			ToolWhitelist:  []string{"fake_calculator", "fake_db_query", "fake_send_notification", "fake_cloud_deploy"},
			OutputSchema:   map[string]interface{}{"type": "object"},
			MemoryMode:     "BUFFER_WINDOW",
		},
		PublishedVersions: []models.PublishedAgentVersion{
			{
				Version:       "v1.0.0",
				PublishedAt:   now.Add(-48 * time.Hour).UTC().Format(time.RFC3339),
				PublishedBy:   "Elena Rostova",
				Snapshot:      snap1,
				SystemPrompt:  "You are the Enterprise SRE Assistant. Diagnose cluster headroom using calculator & DB query tools, and escalate any production rollout via governance approval.",
				ToolWhitelist: []string{"fake_calculator", "fake_db_query", "fake_send_notification", "fake_cloud_deploy"},
			},
		},
		ActiveVersion:       "v1.0.0",
		SystemPrompt:        "You are the Enterprise SRE Assistant. Diagnose cluster headroom using calculator & DB query tools, and escalate any production rollout via governance approval.",
		ModelID:             "fake_fast_model",
		ToolIDs:             []string{"fake_calculator", "fake_db_query", "fake_send_notification", "fake_cloud_deploy"},
		RequiredPermissions: []string{},
		Status:              "PUBLISHED",
		Author:              "Elena Rostova",
		CreatedAt:           now.Add(-48 * time.Hour),
		UpdatedAt:           now.Add(-24 * time.Hour),
	}

	snap2Hash := pe.ComputePlanHash(map[string]interface{}{"id": "agt_metal3_sre", "version": "v2.1.0"})
	snap2 := models.RunSnapshot{
		DefinitionID:      "agt_metal3_sre",
		DefinitionVersion: "v2.1.0",
		DefinitionName:    "Metal3 Ironic BareMetal SRE Agent",
		ModelID:           "model_gemini_2_5_pro",
		ModelVersion:      "gemini-2.5-pro",
		ToolVersions:      map[string]string{"tool_redfish_power": "1.0.0", "tool_k8s_cordon_drain": "1.1.0", "fake_db_query": "1.2.0"},
		SkillVersions:     map[string]string{},
		PolicyVersion:     policy.PolicyVersion,
		CreatedAt:         now.Add(-24 * time.Hour).UTC().Format(time.RFC3339),
		SnapshotHash:      snap2Hash,
	}

	s.Agents["agt_metal3_sre"] = &models.AgentDefinition{
		ID:          "agt_metal3_sre",
		TenantID:    "tenant_acme_corp",
		ProjectID:   "proj_prod_infra",
		Name:        "Metal3 Ironic BareMetal SRE Agent",
		Version:     "v2.1.0",
		Description: "Autonomous BareMetal Host provisioning, out-of-band Redfish remediation, and K8s rolling upgrades.",
		CurrentDraft: models.AgentDraft{
			SystemPrompt:   "You are the autonomous Metal3 bare metal SRE agent. Maintain 99.999% K8s cluster availability.",
			ModelID:        "model_gemini_2_5_pro",
			Temperature:    0.1,
			MaxSteps:       8,
			TimeoutSeconds: 120,
			BudgetLimitUSD: 2.5,
			ToolWhitelist:  []string{"tool_redfish_power", "tool_k8s_cordon_drain", "fake_db_query"},
			OutputSchema:   map[string]interface{}{"type": "object"},
			MemoryMode:     "BUFFER_WINDOW",
		},
		PublishedVersions: []models.PublishedAgentVersion{
			{
				Version:       "v2.1.0",
				PublishedAt:   now.Add(-24 * time.Hour).UTC().Format(time.RFC3339),
				PublishedBy:   "Elena Rostova",
				Snapshot:      snap2,
				SystemPrompt:  "You are the autonomous Metal3 bare metal SRE agent. Maintain 99.999% K8s cluster availability.",
				ToolWhitelist: []string{"tool_redfish_power", "tool_k8s_cordon_drain", "fake_db_query"},
			},
		},
		ActiveVersion:       "v2.1.0",
		SystemPrompt:        "You are the autonomous Metal3 bare metal SRE agent. Maintain 99.999% K8s cluster availability.",
		ModelID:             "model_gemini_2_5_pro",
		ToolIDs:             []string{"tool_redfish_power", "tool_k8s_cordon_drain", "fake_db_query"},
		RequiredPermissions: []string{"HOST_MANAGE", "CLUSTER_MANAGE"},
		Status:              "PUBLISHED",
		Author:              "Elena Rostova",
		CreatedAt:           now.Add(-24 * time.Hour),
		UpdatedAt:           now,
	}

	// Seed Workflow DAG
	wfNodes := []models.WorkflowNode{
		{ID: "node_start", Name: "Trigger Input", Type: "START", Config: map[string]interface{}{}, Position: map[string]int{"x": 0, "y": 100}},
		{ID: "node_llm_plan", Name: "LLM Rollout Planner", Type: "LLM", Config: map[string]interface{}{"model_id": "fake_fast_model"}, Position: map[string]int{"x": 220, "y": 100}},
		{ID: "node_tool_check", Name: "Inventory & Math Check", Type: "TOOL", Config: map[string]interface{}{"tool_id": "fake_calculator"}, Position: map[string]int{"x": 440, "y": 100}},
		{ID: "node_human_gate", Name: "SHA-256 Plan Approval", Type: "HUMAN_APPROVAL", Config: map[string]interface{}{"required_grant": "APPROVE_HIGH_RISK"}, Position: map[string]int{"x": 660, "y": 100}},
		{ID: "node_deploy", Name: "Cloud Deploy Execution", Type: "TOOL", Config: map[string]interface{}{"tool_id": "fake_cloud_deploy"}, Position: map[string]int{"x": 880, "y": 100}},
		{ID: "node_end", Name: "Complete & Audit", Type: "END", Config: map[string]interface{}{}, Position: map[string]int{"x": 1100, "y": 100}},
	}
	wfEdges := []models.WorkflowEdge{
		{ID: "edge_1", Source: "node_start", Target: "node_llm_plan"},
		{ID: "edge_2", Source: "node_llm_plan", Target: "node_tool_check"},
		{ID: "edge_3", Source: "node_tool_check", Target: "node_human_gate"},
		{ID: "edge_4", Source: "node_human_gate", Target: "node_deploy"},
		{ID: "edge_5", Source: "node_deploy", Target: "node_end"},
	}
	wfSnap := models.RunSnapshot{
		DefinitionID:      "wf_deploy_approval",
		DefinitionVersion: "v1.0.0",
		DefinitionName:    "Zero-Trust K8s & Cloud Change Workflow",
		ModelID:           "fake_fast_model",
		ModelVersion:      "fake-deterministic-v1",
		ToolVersions:      map[string]string{"fake_calculator": "1.0.0", "fake_cloud_deploy": "2.0.0"},
		SkillVersions:     map[string]string{},
		PolicyVersion:     policy.PolicyVersion,
		CreatedAt:         now.Add(-36 * time.Hour).UTC().Format(time.RFC3339),
		SnapshotHash:      pe.ComputePlanHash(map[string]interface{}{"wf": "wf_deploy_approval", "version": "v1.0.0"}),
	}
	s.Workflows["wf_deploy_approval"] = &models.WorkflowDefinition{
		ID:          "wf_deploy_approval",
		TenantID:    "tenant_acme_corp",
		ProjectID:   "proj_infra_ops",
		Name:        "Zero-Trust K8s & Cloud Change Workflow",
		Version:     "v1.0.0",
		Description: "Declarative multi-stage DAG combining LLM planning, headroom calculation, SHA-256 human gate, and rollout.",
		CurrentDraft: models.WorkflowDraft{
			Nodes:          wfNodes,
			Edges:          wfEdges,
			InputSchema:    map[string]interface{}{"type": "object"},
			OutputSchema:   map[string]interface{}{"type": "object"},
			TimeoutSeconds: 300,
		},
		PublishedVersions: []models.PublishedWorkflowVersion{
			{
				Version:     "v1.0.0",
				PublishedAt: now.Add(-36 * time.Hour).UTC().Format(time.RFC3339),
				PublishedBy: "Elena Rostova",
				Nodes:       wfNodes,
				Edges:       wfEdges,
				Snapshot:    wfSnap,
			},
		},
		ActiveVersion: "v1.0.0",
		Status:        "PUBLISHED",
		Author:        "Elena Rostova",
		CreatedAt:     now.Add(-36 * time.Hour),
		UpdatedAt:     now.Add(-24 * time.Hour),
	}

	// Seed Baseline Completed Run
	adminPrincipal := *s.Principals["usr_elena_admin"]
	s.Runs["run_baseline_101"] = &models.ExecutionRun{
		ID:            "run_baseline_101",
		TargetType:    "AGENT",
		TargetID:      "agt_infra_helper",
		TargetVersion: "v1.0.0",
		TargetName:    "Cluster Diagnostics & Ops Agent",
		TenantID:      "tenant_acme_corp",
		ProjectID:     "proj_infra_ops",
		TraceID:       "tr_seed_98a71b",
		State:         "SUCCEEDED",
		Status:        "COMPLETED",
		InputData:     map[string]interface{}{"input_query": "Inspect all physical BareMetal hosts and verify thermal sensors."},
		InputQuery:    "Inspect all physical BareMetal hosts and verify thermal sensors.",
		FinalOutput:   map[string]interface{}{"summary": "All 15 physical servers analyzed. Zero thermal violations. Ready for K8s workloads."},
		OutputResult:  "All 15 physical servers analyzed. Zero thermal violations. Ready for K8s workloads.",
		Initiator:     adminPrincipal,
		InitiatedBy:   "Elena Rostova",
		Snapshot:      snap1,
		TotalTokens:   245,
		TotalCostUSD:  0.0008,
		DurationMs:    124,
		StartedAt:     now.Add(-2 * time.Hour).UTC().Format(time.RFC3339),
		CompletedAt:   now.Add(-2 * time.Hour).Add(124 * time.Millisecond).UTC().Format(time.RFC3339),
		Steps: []models.StepRun{
			{
				ID:         "step_01",
				RunID:      "run_baseline_101",
				StepID:     "step_bmc_scan",
				StepName:   "BMC Redfish Hardware Discovery",
				NodeName:   "BMC Redfish Hardware Discovery",
				NodeType:   "TOOL",
				State:      "SUCCEEDED",
				Status:     "COMPLETED",
				Input:      map[string]interface{}{"query_type": "list_hosts"},
				Output:     map[string]interface{}{"hosts_online": 15, "healthy": 14, "degraded": 1},
				PolicyDecision: &models.PolicyEvaluationDecision{
					Decision:        "ALLOW",
					Reason:          "Four-way policy intersection passed",
					PolicyVersion:   policy.PolicyVersion,
					RiskLevel:       "LOW",
					EffectiveGrants: []string{"DB_QUERY"},
				},
				DurationMs: 45,
				TokenUsage: &models.TokenUsage{PromptTokens: 80, CompletionTokens: 45, TotalTokens: 125, EstimatedCostUSD: 0.0004},
			},
			{
				ID:         "step_02",
				RunID:      "run_baseline_101",
				StepID:     "step_thermal_check",
				StepName:   "Capacity & Thermal Verification",
				NodeName:   "Capacity & Thermal Verification",
				NodeType:   "LLM",
				State:      "SUCCEEDED",
				Status:     "COMPLETED",
				Input:      map[string]interface{}{"hosts_scanned": 15},
				Output:     map[string]interface{}{"summary": "Headroom verified across 1,920 CPU cores and 112x H100 GPUs"},
				DurationMs: 79,
				TokenUsage: &models.TokenUsage{PromptTokens: 70, CompletionTokens: 50, TotalTokens: 120, EstimatedCostUSD: 0.0004},
			},
		},
		CreatedAt: now.Add(-2 * time.Hour),
		UpdatedAt: now.Add(-2 * time.Hour),
	}
	s.RunOrder = append(s.RunOrder, "run_baseline_101")

	// Seed Waiting Approval Run + Pending ApprovalRecord
	seedArgs := map[string]interface{}{
		"cluster":       "prod-us-east-1",
		"manifest_name": "ingress-controller-v3",
		"replicas":      4,
	}
	seedHash := pe.ComputePlanHash(map[string]interface{}{
		"tool_id": "fake_cloud_deploy",
		"args":    seedArgs,
	})
	s.Runs["run_pending_appr_102"] = &models.ExecutionRun{
		ID:            "run_pending_appr_102",
		TargetType:    "AGENT",
		TargetID:      "agt_infra_helper",
		TargetVersion: "v1.0.0",
		TargetName:    "Cluster Diagnostics & Ops Agent",
		TenantID:      "tenant_acme_corp",
		ProjectID:     "proj_infra_ops",
		TraceID:       "tr_seed_appr02",
		State:         "WAITING_APPROVAL",
		Status:        "PAUSED_FOR_APPROVAL",
		InputData:     map[string]interface{}{"input_query": "Deploy ingress-controller-v3 with 4 replicas to prod-us-east-1"},
		InputQuery:    "Deploy ingress-controller-v3 with 4 replicas to prod-us-east-1",
		Initiator:     *s.Principals["usr_alex_dev"],
		InitiatedBy:   "Alex Chen",
		Snapshot:      snap1,
		TotalTokens:   190,
		TotalCostUSD:  0.0006,
		DurationMs:    62,
		StartedAt:     now.Add(-20 * time.Minute).UTC().Format(time.RFC3339),
		Steps: []models.StepRun{
			{
				ID:         "step_appr_gate_01",
				RunID:      "run_pending_appr_102",
				StepID:     "step_cloud_deploy_gate",
				StepName:   "Deploy ingress-controller-v3 (Human Gate)",
				NodeName:   "Deploy ingress-controller-v3 (Human Gate)",
				NodeType:   "TOOL",
				State:      "WAITING_APPROVAL",
				Status:     "WAITING_APPROVAL",
				Input:      seedArgs,
				ApprovalID: "appr_seed_01",
				PolicyDecision: &models.PolicyEvaluationDecision{
					Decision:         "REQUIRE_APPROVAL",
					Reason:           "Tool 'Production Cloud Rollout Dispatcher' (HIGH risk) requires human-in-the-loop approval bound to plan hash.",
					PolicyVersion:    policy.PolicyVersion,
					RiskLevel:        "HIGH",
					RequiredPlanHash: seedHash,
					EffectiveGrants:  []string{"*"},
				},
				DurationMs: 62,
				TokenUsage: &models.TokenUsage{PromptTokens: 120, CompletionTokens: 70, TotalTokens: 190, EstimatedCostUSD: 0.0006},
			},
		},
		CreatedAt: now.Add(-20 * time.Minute),
		UpdatedAt: now.Add(-20 * time.Minute),
	}
	s.RunOrder = append([]string{"run_pending_appr_102"}, s.RunOrder...)

	s.Approvals["appr_seed_01"] = &models.ApprovalRecord{
		ID:          "appr_seed_01",
		RunID:       "run_pending_appr_102",
		StepID:      "step_cloud_deploy_gate",
		TargetName:  "Cluster Diagnostics & Ops Agent",
		TenantID:    "tenant_acme_corp",
		ProjectID:   "proj_infra_ops",
		ToolID:      "fake_cloud_deploy",
		ToolName:    "Production Cloud Rollout Dispatcher",
		RiskLevel:   "HIGH",
		ArgsSummary: seedArgs,
		RawPayload:  map[string]interface{}{"tool_id": "fake_cloud_deploy", "args": seedArgs},
		PlanHash:    seedHash,
		Status:      "PENDING",
		RequestedAt: now.Add(-20 * time.Minute).UTC().Format(time.RFC3339),
		RequestedBy: "Alex Chen",
		ExpiresAt:   now.Add(24 * time.Hour).UTC().Format(time.RFC3339),
		CreatedAt:   now.Add(-20 * time.Minute),
	}

	// Seed Audit Events
	s.Audits = append(s.Audits,
		&models.AuditEvent{
			ID:             "audit_02",
			TraceID:        "tr_seed_appr02",
			TenantID:       "tenant_acme_corp",
			ProjectID:      "proj_infra_ops",
			ActorID:        "usr_alex_dev",
			ActorName:      "Alex Chen",
			ActorRole:      "APP_DEVELOPER",
			EventType:      "APPROVAL_REQUESTED",
			TargetResource: "Tool/fake_cloud_deploy",
			Summary:        "Execution paused for human approval (SHA-256 Plan Hash bound) for ingress-controller-v3 deployment.",
			PayloadRedacted: policy.SanitizePayload(map[string]interface{}{
				"cluster": "prod-us-east-1", "plan_hash": seedHash, "api_token": "tok_secret_value",
			}),
			Status:    "SUCCESS",
			Timestamp: now.Add(-20 * time.Minute),
		},
		&models.AuditEvent{
			ID:             "audit_01",
			TraceID:        "tr_seed_98a71b",
			TenantID:       "tenant_acme_corp",
			ProjectID:      "proj_infra_ops",
			ActorID:        "usr_elena_admin",
			ActorName:      "Elena Rostova",
			ActorRole:      "PLATFORM_ADMIN",
			EventType:      "RUN_CREATED",
			TargetResource: "ControlPlane/GoBackend",
			Summary:        "Golang 1.22+ native zero-trust control plane initialized with RBAC barriers and VersionController reconcile loop.",
			PayloadRedacted: map[string]interface{}{
				"engine": "Go 1.22", "wal": "ACTIVE",
			},
			Status:    "SUCCESS",
			Timestamp: now.Add(-2 * time.Hour),
		},
	)
}

// RecordAudit prepends a sanitized immutable audit entry.
func (s *Store) RecordAudit(ev *models.AuditEvent) {
	if ev == nil {
		return
	}
	ev.PayloadRedacted = policy.SanitizePayload(ev.PayloadRedacted)
	if ev.ID == "" {
		ev.ID = fmt.Sprintf("audit_%d", time.Now().UnixNano())
	}
	if ev.TraceID == "" {
		ev.TraceID = fmt.Sprintf("tr_%d", time.Now().UnixNano())
	}
	if ev.Timestamp.IsZero() {
		ev.Timestamp = time.Now()
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.Audits = append([]*models.AuditEvent{ev}, s.Audits...)
}

// ActiveRunCountUnsafe expects the caller to hold s.mu lock or RLock.
func (s *Store) ActiveRunCountUnsafe(tenantID string) int {
	count := 0
	for _, r := range s.Runs {
		if r.TenantID == tenantID && (r.State == "RUNNING" || r.State == "QUEUED" || r.State == "PLANNING") {
			count++
		}
	}
	return count
}

// AddRunLocked inserts a run at the front of ordering. Caller holds lock or calls AddRun.
func (s *Store) AddRunLocked(run *models.ExecutionRun) {
	s.Runs[run.ID] = run
	s.RunOrder = append([]string{run.ID}, s.RunOrder...)
	if tenant, ok := s.Tenants[run.TenantID]; ok && run.TotalCostUSD > 0 {
		tenant.Quota.UsedBudgetUSD += run.TotalCostUSD
		tenant.QuotaUsedBudgetUSD = tenant.Quota.UsedBudgetUSD
	}
}

// ListRunsOrdered returns runs sorted newest-first.
func (s *Store) ListRunsOrdered() []*models.ExecutionRun {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]*models.ExecutionRun, 0, len(s.Runs))
	seen := make(map[string]bool)
	for _, id := range s.RunOrder {
		if r, ok := s.Runs[id]; ok {
			out = append(out, r)
			seen[id] = true
		}
	}
	for id, r := range s.Runs {
		if !seen[id] {
			out = append(out, r)
		}
	}
	return out
}

// ListApprovalsOrdered returns pending/decided approvals sorted newest-first.
func (s *Store) ListApprovalsOrdered() []*models.ApprovalRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]*models.ApprovalRecord, 0, len(s.Approvals))
	for _, a := range s.Approvals {
		out = append(out, a)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out
}

// ListPrincipalsSorted returns principals cleanly ordered.
func (s *Store) ListPrincipalsSorted() []*models.Principal {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.Principal, 0, len(s.Principals))
	for _, p := range s.Principals {
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Role == "PLATFORM_ADMIN" && out[j].Role != "PLATFORM_ADMIN" {
			return true
		}
		if out[j].Role == "PLATFORM_ADMIN" && out[i].Role != "PLATFORM_ADMIN" {
			return false
		}
		return strings.Compare(out[i].ActorName, out[j].ActorName) < 0
	})
	return out
}

// ListMembersSorted returns members cleanly ordered.
func (s *Store) ListMembersSorted() []*models.UserMember {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.UserMember, 0, len(s.Members))
	for _, m := range s.Members {
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Status != out[j].Status {
			return out[i].Status == "ACTIVE"
		}
		return strings.Compare(out[i].Name, out[j].Name) < 0
	})
	return out
}
