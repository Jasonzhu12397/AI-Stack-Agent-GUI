package models

import "time"

// Principal represents the authenticated actor identity and RBAC role.
type Principal struct {
	ActorID         string   `json:"actor_id"`
	ActorName       string   `json:"actor_name"`
	Role            string   `json:"role"`
	TenantID        string   `json:"tenant_id"`
	ActiveProjectID string   `json:"active_project_id"`
	Permissions     []string `json:"permissions"`
}

// TenantInfo represents multi-tenant isolation and resource quotas.
type TenantInfo struct {
	ID                     string    `json:"id"`
	Name                   string    `json:"name"`
	Slug                   string    `json:"slug"`
	Status                 string    `json:"status"`
	QuotaMaxConcurrentRuns int       `json:"quota_max_concurrent_runs"`
	QuotaMonthlyBudgetUSD  float64   `json:"quota_monthly_budget_usd"`
	QuotaUsedBudgetUSD     float64   `json:"quota_used_budget_usd"`
	CreatedAt              time.Time `json:"created_at"`
}

// ProjectInfo represents a tenant-scoped workspace.
type ProjectInfo struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// UserMember represents an enterprise user with RBAC role binding.
type UserMember struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	Status    string    `json:"status"` // "ACTIVE" | "REVOKED"
	InvitedBy string    `json:"invited_by"`
	CreatedAt time.Time `json:"created_at"`
}

// ModelConfig represents LLM gateway configuration.
type ModelConfig struct {
	ID            string  `json:"id"`
	Provider      string  `json:"provider"`
	ModelName     string  `json:"model_name"`
	ContextWindow int     `json:"context_window"`
	InputCost1K   float64 `json:"cost_per_1k_input_tokens"`
	OutputCost1K  float64 `json:"cost_per_1k_output_tokens"`
	IsActive      bool    `json:"is_active"`
}

// ToolDefinition represents sandboxed executable tool contracts.
type ToolDefinition struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Version     string                 `json:"version"`
	Description string                 `json:"description"`
	Category    string                 `json:"category"`
	Risk        string                 `json:"risk"` // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
	Permissions []string               `json:"permissions"`
	InputSchema map[string]interface{} `json:"input_schema"`
	IsActive    bool                   `json:"is_active"`
}

// AgentDefinition represents an autonomous AI agent specification.
type AgentDefinition struct {
	ID                  string    `json:"id"`
	TenantID            string    `json:"tenant_id"`
	ProjectID           string    `json:"project_id"`
	Name                string    `json:"name"`
	Version             string    `json:"version"`
	Description         string    `json:"description"`
	SystemPrompt        string    `json:"system_prompt"`
	ModelID             string    `json:"model_id"`
	ToolIDs             []string  `json:"tool_ids"`
	RequiredPermissions []string  `json:"required_permissions"`
	Status              string    `json:"status"` // "DRAFT" | "PUBLISHED"
	Author              string    `json:"author"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// WorkflowDefinition represents DAG graph orchestrations.
type WorkflowDefinition struct {
	ID          string                 `json:"id"`
	TenantID    string                 `json:"tenant_id"`
	ProjectID   string                 `json:"project_id"`
	Name        string                 `json:"name"`
	Version     string                 `json:"version"`
	Description string                 `json:"description"`
	Nodes       []map[string]interface{} `json:"nodes"`
	Edges       []map[string]string    `json:"edges"`
	Status      string                 `json:"status"`
	Author      string                 `json:"author"`
	CreatedAt   time.Time              `json:"created_at"`
}

// StepRun represents a single node execution in a workflow or agent run.
type StepRun struct {
	ID            string                 `json:"id"`
	RunID         string                 `json:"run_id"`
	StepID        string                 `json:"step_id"`
	NodeName      string                 `json:"node_name"`
	Status        string                 `json:"status"`
	InputPayload  map[string]interface{} `json:"input_payload,omitempty"`
	OutputPayload map[string]interface{} `json:"output_payload,omitempty"`
	DurationMs    int64                  `json:"duration_ms"`
}

// ExecutionRun represents a deterministic state-machine execution flow.
type ExecutionRun struct {
	ID             string    `json:"id"`
	TenantID       string    `json:"tenant_id"`
	ProjectID      string    `json:"project_id"`
	TraceID        string    `json:"trace_id"`
	EntityType     string    `json:"entity_type"` // "AGENT" | "WORKFLOW"
	EntityID       string    `json:"entity_id"`
	Status         string    `json:"status"` // "PENDING" | "RUNNING" | "PAUSED_FOR_APPROVAL" | "COMPLETED" | "FAILED"
	InputQuery     string    `json:"input_query"`
	OutputResult   string    `json:"output_result,omitempty"`
	ErrorMessage   string    `json:"error_message,omitempty"`
	InitiatedBy    string    `json:"initiated_by"`
	TokensConsumed int       `json:"tokens_consumed"`
	CostUSD        float64   `json:"cost_usd"`
	DurationMs     int64     `json:"duration_ms"`
	Steps          []StepRun `json:"steps"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// ApprovalRecord represents human-in-the-loop governance for high-risk tools.
type ApprovalRecord struct {
	ID             string                 `json:"id"`
	RunID          string                 `json:"run_id"`
	TenantID       string                 `json:"tenant_id"`
	ProjectID      string                 `json:"project_id"`
	ToolID         string                 `json:"tool_id"`
	ToolName       string                 `json:"tool_name"`
	RiskLevel      string                 `json:"risk_level"`
	RawPayload     map[string]interface{} `json:"raw_payload"`
	PlanHash       string                 `json:"plan_hash"` // Cryptographic SHA-256 bound hash
	Status         string                 `json:"status"`    // "PENDING" | "APPROVED" | "REJECTED"
	RequestedBy    string                 `json:"requested_by"`
	DecidedBy      string                 `json:"decided_by,omitempty"`
	DecisionReason string                 `json:"decision_reason,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	DecidedAt      *time.Time             `json:"decided_at,omitempty"`
}

// AuditEvent represents immutable write-ahead security trail.
type AuditEvent struct {
	ID              string                 `json:"id"`
	TraceID         string                 `json:"trace_id"`
	TenantID        string                 `json:"tenant_id"`
	ProjectID       string                 `json:"project_id"`
	ActorID         string                 `json:"actor_id"`
	ActorName       string                 `json:"actor_name"`
	ActorRole       string                 `json:"actor_role"`
	EventType       string                 `json:"event_type"`
	TargetResource  string                 `json:"target_resource"`
	Summary         string                 `json:"summary"`
	PayloadRedacted map[string]interface{} `json:"payload_redacted"`
	Status          string                 `json:"status"`
	Timestamp       time.Time              `json:"timestamp"`
}

// BareMetalHost represents a physical server managed by Metal3 & Ironic.
type BareMetalHost struct {
	Name               string                 `json:"name"`
	RackLocation       string                 `json:"rack_location"`
	BMCAddress         string                 `json:"bmc_address"`
	BMCProtocol        string                 `json:"bmc_protocol"`
	BootMACAddress     string                 `json:"boot_mac_address"`
	PowerStatus        string                 `json:"power_status"` // "ON" | "OFF" | "REBOOTING"
	ProvisioningStatus string                 `json:"provisioning_status"` // "Available" | "Provisioning" | "ActiveInCluster" | "Degraded" | "Provisioning Failed"
	AssignedRole       string                 `json:"assigned_role"`       // "control-plane" | "worker-gpu" | "worker-compute"
	TargetClusterID    *string                `json:"target_cluster_id,omitempty"`
	Hardware           map[string]interface{} `json:"hardware"`
	Sensors            map[string]interface{} `json:"sensors"`
	IPAddresses        []string               `json:"ip_addresses"`
	UpdatedAt          time.Time              `json:"updated_at"`
}

// HostAlert represents proactive hardware/provisioning failures.
type HostAlert struct {
	ID                 string                 `json:"id"`
	HostName           string                 `json:"host_name"`
	Severity           string                 `json:"severity"` // "CRITICAL" | "WARNING"
	Status             string                 `json:"status"`   // "ACTIVE" | "RESOLVING" | "RESOLVED"
	Rule               string                 `json:"rule"`
	Title              string                 `json:"title"`
	TitleEn            string                 `json:"title_en"`
	ErrorCode          string                 `json:"error_code"`
	Diagnostics        map[string]interface{} `json:"diagnostics"`
	DispatchedChannels []string               `json:"dispatched_channels"`
	DetectedAt         time.Time              `json:"detected_at"`
	ResolvedAt         *time.Time             `json:"resolved_at,omitempty"`
}

// TargetCluster represents a target Kubernetes cluster managed by Metal3 eph-node.
type TargetCluster struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Version          string    `json:"version"`
	Status           string    `json:"status"` // "PROVISIONING" | "READY" | "UPGRADING" | "SCALING"
	ControlPlaneNodes int      `json:"control_plane_nodes"`
	WorkerNodes      int       `json:"worker_nodes"`
	CreatedAt        time.Time `json:"created_at"`
}

// Plugin represents registered external app connectors (WeChat, QQ, Meituan, etc.).
type Plugin struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	NameZh        string                 `json:"name_zh"`
	Category      string                 `json:"category"`
	Provider      string                 `json:"provider"`
	Version       string                 `json:"version"`
	Description   string                 `json:"description"`
	DescriptionZh string                 `json:"description_zh"`
	AuthType      string                 `json:"auth_type"`
	Endpoint      string                 `json:"endpoint"`
	APIKeyRef     string                 `json:"api_key_ref,omitempty"`
	IsActive      bool                   `json:"is_active"`
	TotalCalls    int64                  `json:"total_calls"`
	P95LatencyMs  int                    `json:"p95_latency_ms"`
	ToolID        string                 `json:"tool_id"`
	Risk          string                 `json:"risk"`
	Config        map[string]interface{} `json:"config"`
	CreatedAt     time.Time              `json:"created_at"`
}

// DualAgentOrchestrator models
type AgentSpec struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Role        string    `json:"role"` // "EPH_BOOTSTRAP_AGENT" | "TARGET_CLUSTER_LIFECYCLE_AGENT"
	Location    string    `json:"location"`
	Status      string    `json:"status"` // "ACTIVE" | "SYNCHRONIZING" | "IDLE" | "ERROR"
	Version     string    `json:"version"`
	PodName     string    `json:"pod_name"`
	Namespace   string    `json:"namespace"`
	Heartbeat   time.Time `json:"heartbeat"`
	ActiveTasks []string  `json:"active_tasks"`
	Metrics     map[string]interface{} `json:"metrics"`
}

type DualAgentStatus struct {
	BootstrapAgent AgentSpec             `json:"bootstrap_agent"`
	TargetAgent    AgentSpec             `json:"target_agent"`
	CurrentPhase   string                `json:"current_phase"` // EPH_BOOTSTRAP | BMH_INSPECTION | TARGET_CP_PROVISION | K8S_INITIALIZATION | PIVOT_TRANSFER | MULTI_CNI_CONVERGE | CLUSTER_HEALTHY
	PivotStatus    string                `json:"pivot_status"`  // PENDING | IN_PROGRESS | COMPLETED | SELF_HOSTED
	SyncedAt       time.Time             `json:"synced_at"`
	Events         []DualAgentEvent      `json:"events"`
}

type DualAgentEvent struct {
	ID        string    `json:"id"`
	Source    string    `json:"source"` // "EPH_AGENT" | "TARGET_AGENT" | "COORDINATOR"
	Phase     string    `json:"phase"`
	Level     string    `json:"level"`  // "INFO" | "WARN" | "SUCCESS" | "ERROR"
	Message   string    `json:"message"`
	MessageZh string    `json:"message_zh"`
	Timestamp time.Time `json:"timestamp"`
}

// DualNetworkSpec models
type NetworkInterfaceConfig struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"` // "CONTROL_NETWORK" | "DATA_NETWORK"
	CIDR        string   `json:"cidr"`
	VLAN        int      `json:"vlan"`
	Gateway     string   `json:"gateway"`
	MTU         int      `json:"mtu"`
	Interfaces  []string `json:"interfaces"`
	Purpose     string   `json:"purpose"`
	PurposeZh   string   `json:"purpose_zh"`
	Bandwidth   string   `json:"bandwidth"`
}

type DualNetworkSpec struct {
	ControlNetwork NetworkInterfaceConfig `json:"control_network"`
	DataNetwork    NetworkInterfaceConfig `json:"data_network"`
}

// MultiCNISpec models
type CNIComponent struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"` // "META_PLUGIN" | "PRIMARY_DEFAULT" | "L2_VSWITCH" | "DIRECT_SRIOV"
	Version     string   `json:"version"`
	Status      string   `json:"status"` // "ACTIVE" | "DEGRADED" | "INSTALLING"
	Interface   string   `json:"interface"`
	Features    []string `json:"features"`
	FeaturesZh  []string `json:"features_zh"`
	Latency     string   `json:"latency"`
	Throughput  string   `json:"throughput"`
	Config      map[string]interface{} `json:"config"`
}

type MultiCNISpec struct {
	Multus CNIComponent `json:"multus"`
	Calico CNIComponent `json:"calico"`
	OVS    CNIComponent `json:"ovs"`
	SRIOV  CNIComponent `json:"sriov"`
	NetworkAttachmentDefinitions []map[string]interface{} `json:"network_attachment_definitions"`
}

// Talos Omni Rapid Deployment models
type OmniDeployRequest struct {
	ClusterName       string   `json:"cluster_name"`
	K8sVersion        string   `json:"k8s_version"`
	ControlPlaneNodes int      `json:"control_plane_nodes"`
	WorkerGPUNodes    int      `json:"worker_gpu_nodes"`
	WorkerComputeNodes int     `json:"worker_compute_nodes"`
	SelectedHostNames []string `json:"selected_host_names"`
	EnableDualNetwork bool     `json:"enable_dual_network"`
	EnableMultiCNI    bool     `json:"enable_multi_cni"`
	AutoPivot         bool     `json:"auto_pivot"`
}

type OmniDeployProgress struct {
	ClusterID        string                 `json:"cluster_id"`
	ClusterName      string                 `json:"cluster_name"`
	Status           string                 `json:"status"` // "IDLE" | "RUNNING" | "READY" | "FAILED"
	CurrentStepIndex int                    `json:"current_step_index"`
	TotalSteps       int                    `json:"total_steps"`
	ProgressPercent  int                    `json:"progress_percent"`
	ElapsedTimeSec   int                    `json:"elapsed_time_sec"`
	EstimatedSec     int                    `json:"estimated_sec"`
	Steps            []OmniDeployStep       `json:"steps"`
	Manifests        map[string]string      `json:"manifests"`
	ActiveDualAgent  DualAgentStatus        `json:"active_dual_agent"`
}

type OmniDeployStep struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	NameZh      string `json:"name_zh"`
	AgentSource string `json:"agent_source"` // "EPH_AGENT" | "TARGET_AGENT" | "PIVOT"
	Status      string `json:"status"`       // "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"
	DurationMs  int64  `json:"duration_ms"`
	Detail      string `json:"detail"`
}

