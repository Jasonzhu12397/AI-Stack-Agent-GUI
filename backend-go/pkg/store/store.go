package store

import (
	"fmt"
	"sync"
	"time"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
)

// Store provides concurrency-safe transactional storage with WAL aligned auditing.
type Store struct {
	mu           sync.RWMutex
	Tenants      map[string]*models.TenantInfo
	Projects     map[string]*models.ProjectInfo
	Members      map[string]*models.UserMember
	Models       map[string]*models.ModelConfig
	Tools        map[string]*models.ToolDefinition
	Agents       map[string]*models.AgentDefinition
	Workflows    map[string]*models.WorkflowDefinition
	Runs         map[string]*models.ExecutionRun
	Approvals    map[string]*models.ApprovalRecord
	Audits       []*models.AuditEvent
	CurrentActor *models.Principal
	Principals   map[string]*models.Principal
	StartTime    time.Time
}

func NewStore() *Store {
	s := &Store{
		Tenants:    make(map[string]*models.TenantInfo),
		Projects:   make(map[string]*models.ProjectInfo),
		Members:    make(map[string]*models.UserMember),
		Models:     make(map[string]*models.ModelConfig),
		Tools:      make(map[string]*models.ToolDefinition),
		Agents:     make(map[string]*models.AgentDefinition),
		Workflows:  make(map[string]*models.WorkflowDefinition),
		Runs:       make(map[string]*models.ExecutionRun),
		Approvals:  make(map[string]*models.ApprovalRecord),
		Audits:     make([]*models.AuditEvent, 0),
		Principals: make(map[string]*models.Principal),
		StartTime:  time.Now(),
	}
	s.seed()
	return s
}

func (s *Store) seed() {
	// Principals
	admin := &models.Principal{
		ActorID:         "usr_elena_admin",
		ActorName:       "Elena Rostova",
		Role:            "PLATFORM_ADMIN",
		TenantID:        "tenant_acme_corp",
		ActiveProjectID: "proj_prod_infra",
		Permissions: []string{
			"AGENT_CREATE", "AGENT_PUBLISH", "RUN_EXECUTE",
			"APPROVE_RUNS", "USER_MANAGE", "CLUSTER_MANAGE",
			"HOST_MANAGE", "CONNECTOR_ADMIN", "AUDIT_READ",
		},
	}
	dev := &models.Principal{
		ActorID:         "usr_alex_dev",
		ActorName:       "Alex Chen",
		Role:            "APP_DEVELOPER",
		TenantID:        "tenant_acme_corp",
		ActiveProjectID: "proj_prod_infra",
		Permissions: []string{
			"AGENT_CREATE", "AGENT_PUBLISH", "RUN_EXECUTE", "AUDIT_READ",
		},
	}
	s.Principals["usr_elena_admin"] = admin
	s.Principals["usr_alex_dev"] = dev
	s.CurrentActor = admin

	// Tenants & Projects
	s.Tenants["tenant_acme_corp"] = &models.TenantInfo{
		ID:                     "tenant_acme_corp",
		Name:                   "Acme Enterprise Global",
		Slug:                   "acme-global",
		Status:                 "ACTIVE",
		QuotaMaxConcurrentRuns: 20,
		QuotaMonthlyBudgetUSD:  10000.0,
		QuotaUsedBudgetUSD:     340.50,
		CreatedAt:              time.Now().Add(-360 * 24 * time.Hour),
	}
	s.Projects["proj_prod_infra"] = &models.ProjectInfo{
		ID:          "proj_prod_infra",
		TenantID:    "tenant_acme_corp",
		Name:        "BareMetal & Cloud Native Infra",
		Description: "Production Metal3 Ironic fleet and large-scale Kubernetes clusters.",
		CreatedAt:   time.Now().Add(-180 * 24 * time.Hour),
	}

	// Members
	s.Members["usr_elena_admin"] = &models.UserMember{
		ID:        "usr_elena_admin",
		TenantID:  "tenant_acme_corp",
		Email:     "elena@acme.corp",
		Name:      "Elena Rostova",
		Role:      "PLATFORM_ADMIN",
		Status:    "ACTIVE",
		InvitedBy: "SYSTEM_ROOT",
		CreatedAt: time.Now().Add(-300 * 24 * time.Hour),
	}
	s.Members["usr_alex_dev"] = &models.UserMember{
		ID:        "usr_alex_dev",
		TenantID:  "tenant_acme_corp",
		Email:     "alex@acme.corp",
		Name:      "Alex Chen",
		Role:      "APP_DEVELOPER",
		Status:    "ACTIVE",
		InvitedBy: "Elena Rostova",
		CreatedAt: time.Now().Add(-120 * 24 * time.Hour),
	}

	// Models
	s.Models["model_gemini_2_5_pro"] = &models.ModelConfig{
		ID:            "model_gemini_2_5_pro",
		Provider:      "GEMINI",
		ModelName:     "Gemini 2.5 Pro (Thinking System)",
		ContextWindow: 1048576,
		InputCost1K:   0.00125,
		OutputCost1K:  0.00500,
		IsActive:      true,
	}

	// Tools
	s.Tools["tool_redfish_power"] = &models.ToolDefinition{
		ID:          "tool_redfish_power",
		Name:        "redfish_power_control",
		Version:     "1.0.0",
		Description: "Out-of-band server power control via Redfish API (power-on, power-off, reboot)",
		Category:    "INFRASTRUCTURE",
		Risk:        "HIGH",
		Permissions: []string{"HOST_MANAGE"},
		IsActive:    true,
	}
	s.Tools["tool_k8s_cordon_drain"] = &models.ToolDefinition{
		ID:          "tool_k8s_cordon_drain",
		Name:        "k8s_node_cordon_drain",
		Version:     "1.1.0",
		Description: "Safely evict workloads and mark K8s node as unschedulable for graceful maintenance.",
		Category:    "INFRASTRUCTURE",
		Risk:        "HIGH",
		Permissions: []string{"CLUSTER_MANAGE"},
		IsActive:    true,
	}

	// Agents
	s.Agents["agt_metal3_sre"] = &models.AgentDefinition{
		ID:                  "agt_metal3_sre",
		TenantID:            "tenant_acme_corp",
		ProjectID:           "proj_prod_infra",
		Name:                "Metal3 Ironic BareMetal SRE Agent",
		Version:             "v2.1.0",
		Description:         "Autonomous BareMetal Host provisioning, out-of-band Redfish remediation, and K8s rolling upgrades.",
		SystemPrompt:        "You are the autonomous Metal3 bare metal SRE agent. Maintain 99.999% K8s cluster availability.",
		ModelID:             "model_gemini_2_5_pro",
		ToolIDs:             []string{"tool_redfish_power", "tool_k8s_cordon_drain"},
		RequiredPermissions: []string{"HOST_MANAGE", "CLUSTER_MANAGE"},
		Status:              "PUBLISHED",
		Author:              "Elena Rostova",
		CreatedAt:           time.Now().Add(-24 * time.Hour),
		UpdatedAt:           time.Now(),
	}

	// Seed Initial Run
	s.Runs["run_baseline_101"] = &models.ExecutionRun{
		ID:             "run_baseline_101",
		TenantID:       "tenant_acme_corp",
		ProjectID:      "proj_prod_infra",
		TraceID:        "tr_seed_98a71b",
		EntityType:     "AGENT",
		EntityID:       "agt_metal3_sre",
		Status:         "COMPLETED",
		InputQuery:     "Inspect all physical BareMetal hosts and verify thermal sensors.",
		OutputResult:   "All 15 physical servers analyzed. Zero thermal violations. Ready for K8s workloads.",
		InitiatedBy:    "Elena Rostova",
		TokensConsumed: 80,
		CostUSD:        0.0002,
		DurationMs:     124,
		Steps: []models.StepRun{
			{
				ID:         "step_01",
				RunID:      "run_baseline_101",
				StepID:     "step_bmc_scan",
				NodeName:   "BMC Redfish Hardware Discovery",
				Status:     "COMPLETED",
				DurationMs: 45,
			},
			{
				ID:         "step_02",
				RunID:      "run_baseline_101",
				StepID:     "step_thermal_check",
				NodeName:   "Thermal Profile Verification",
				Status:     "COMPLETED",
				DurationMs: 79,
			},
		},
		CreatedAt: time.Now().Add(-2 * time.Hour),
		UpdatedAt: time.Now().Add(-2 * time.Hour),
	}

	// Seed Audit Event
	s.Audits = append(s.Audits, &models.AuditEvent{
		ID:             "audit_01",
		TraceID:        "tr_seed_98a71b",
		TenantID:       "tenant_acme_corp",
		ProjectID:      "proj_prod_infra",
		ActorID:        "usr_elena_admin",
		ActorName:      "Elena Rostova",
		ActorRole:      "PLATFORM_ADMIN",
		EventType:      "SYSTEM_BOOT",
		TargetResource: "ControlPlane/GoBackend",
		Summary:        "Golang 1.22+ native zero-trust control plane started successfully on port 8080.",
		PayloadRedacted: map[string]interface{}{
			"engine": "Go 1.22", "wal": "ACTIVE",
		},
		Status:    "SUCCESS",
		Timestamp: time.Now(),
	})
}

// RecordAudit appends an immutable audit entry.
func (s *Store) RecordAudit(ev *models.AuditEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ev.ID == "" {
		ev.ID = fmt.Sprintf("audit_%d", time.Now().UnixNano())
	}
	ev.Timestamp = time.Now()
	s.Audits = append(s.Audits, ev)
}
