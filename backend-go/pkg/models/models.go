package models

import "time"

// AuthContext captures authentication metadata for a Principal.
type AuthContext struct {
	AuthenticatedAt string `json:"authenticated_at"`
	AuthMethod      string `json:"auth_method"` // "LOCAL_DEV_IDENTITY" | "OIDC_MOCK" | "MUTUAL_TLS"
	IPAddress       string `json:"ip_address"`
	SessionID       string `json:"session_id"`
}

// Principal represents the authenticated actor identity and RBAC role.
type Principal struct {
	ActorID         string      `json:"actor_id"`
	ActorName       string      `json:"actor_name"`
	ActorType       string      `json:"actor_type"` // "USER" | "AGENT" | "WORKFLOW" | "SYSTEM"
	TenantID        string      `json:"tenant_id"`
	TenantName      string      `json:"tenant_name"`
	ProjectIDs      []string    `json:"project_ids"`
	ActiveProjectID string      `json:"active_project_id"`
	Role            string      `json:"role"`
	Grants          []string    `json:"grants"`
	Permissions     []string    `json:"permissions"`
	AuthContext     AuthContext `json:"auth_context"`
}

// TenantQuota represents nested concurrency and budget quotas expected by the UI.
type TenantQuota struct {
	MaxConcurrentRuns int     `json:"max_concurrent_runs"`
	MonthlyBudgetUSD  float64 `json:"monthly_budget_usd"`
	UsedBudgetUSD     float64 `json:"used_budget_usd"`
}

// TenantInfo represents multi-tenant isolation and resource quotas.
type TenantInfo struct {
	ID                     string      `json:"id"`
	Name                   string      `json:"name"`
	Slug                   string      `json:"slug"`
	Plan                   string      `json:"plan"` // "ENTERPRISE_PREMIUM" | "PROFESSIONAL" | "DEVELOPER"
	Status                 string      `json:"status"`
	Quota                  TenantQuota `json:"quota"`
	QuotaMaxConcurrentRuns int         `json:"quota_max_concurrent_runs"`
	QuotaMonthlyBudgetUSD  float64     `json:"quota_monthly_budget_usd"`
	QuotaUsedBudgetUSD     float64     `json:"quota_used_budget_usd"`
	CreatedAt              time.Time   `json:"created_at"`
}

// ProjectInfo represents a tenant-scoped workspace.
type ProjectInfo struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// RoleBinding tracks authoritative role assignment and revocation state.
type RoleBinding struct {
	ID         string   `json:"id"`
	UserID     string   `json:"user_id"`
	TenantID   string   `json:"tenant_id"`
	ProjectID  string   `json:"project_id,omitempty"`
	Role       string   `json:"role"`
	Grants     []string `json:"grants"`
	AssignedAt string   `json:"assigned_at"`
	AssignedBy string   `json:"assigned_by"`
	RevokedAt  string   `json:"revoked_at,omitempty"`
	RevokedBy  string   `json:"revoked_by,omitempty"`
	IsActive   bool     `json:"is_active"`
}

// UserMember represents an enterprise user with RBAC role binding.
type UserMember struct {
	ID         string    `json:"id"`
	TenantID   string    `json:"tenant_id"`
	Email      string    `json:"email"`
	Name       string    `json:"name"`
	Role       string    `json:"role"`
	ProjectIDs []string  `json:"project_ids"`
	Grants     []string  `json:"grants"`
	Status     string    `json:"status"` // "ACTIVE" | "REVOKED" | "SUSPENDED"
	InvitedBy  string    `json:"invited_by"`
	CreatedAt  time.Time `json:"created_at"`
}

// ModelCapabilities describes supported LLM features.
type ModelCapabilities struct {
	SupportsStructuredOutput bool `json:"supports_structured_output"`
	SupportsTools            bool `json:"supports_tools"`
	SupportsVision           bool `json:"supports_vision"`
	SupportsStreaming        bool `json:"supports_streaming"`
}

// ModelConfig represents LLM gateway configuration.
type ModelConfig struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Provider     string            `json:"provider"` // "FAKE" | "OPENAI_COMPATIBLE" | "GOOGLE_GEMINI"
	ModelString  string            `json:"model_string"`
	ModelName    string            `json:"model_name"`
	ContextWin   int               `json:"context_window"`
	InputCost1K  float64           `json:"cost_per_1k_input"`
	OutputCost1K float64           `json:"cost_per_1k_output"`
	Capabilities ModelCapabilities `json:"capabilities"`
	IsActive     bool              `json:"is_active"`
	IsFake       bool              `json:"is_fake"`
}

// RetryPolicy controls retry behavior for tool execution.
type RetryPolicy struct {
	MaxRetries int `json:"max_retries"`
	BackoffMs  int `json:"backoff_ms"`
}

// ToolDefinition represents sandboxed executable tool contracts.
type ToolDefinition struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Version         string                 `json:"version"`
	Description     string                 `json:"description"`
	Category        string                 `json:"category"` // "SYSTEM" | "DATABASE" | "CLOUD" | "COMMUNICATION" | "CODE" | "INFRASTRUCTURE"
	Risk            string                 `json:"risk"`     // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
	Permissions     []string               `json:"permissions"`
	InputSchema     map[string]interface{} `json:"input_schema"`
	OutputSchema    map[string]interface{} `json:"output_schema"`
	IdempotencyMode string                 `json:"idempotency_mode"`
	TimeoutMs       int                    `json:"timeout_ms"`
	RetryPolicy     RetryPolicy            `json:"retry_policy"`
	NetworkTargets  []string               `json:"network_targets"`
	IsActive        bool                   `json:"is_active"`
	IsFake          bool                   `json:"is_fake"`
}

// RunSnapshot freezes exact immutable versions and policy hash for a run or release.
type RunSnapshot struct {
	DefinitionID      string            `json:"definition_id"`
	DefinitionVersion string            `json:"definition_version"`
	DefinitionName    string            `json:"definition_name"`
	ModelID           string            `json:"model_id"`
	ModelVersion      string            `json:"model_version"`
	ToolVersions      map[string]string `json:"tool_versions"`
	SkillVersions     map[string]string `json:"skill_versions"`
	PolicyVersion     string            `json:"policy_version"`
	CreatedAt         string            `json:"created_at"`
	SnapshotHash      string            `json:"snapshot_hash"`
}

// AgentDraft holds mutable draft configuration in Agent Studio.
type AgentDraft struct {
	SystemPrompt   string                 `json:"system_prompt"`
	ModelID        string                 `json:"model_id"`
	Temperature    float64                `json:"temperature"`
	MaxSteps       int                    `json:"max_steps"`
	TimeoutSeconds int                    `json:"timeout_seconds"`
	BudgetLimitUSD float64                `json:"budget_limit_usd"`
	ToolWhitelist  []string               `json:"tool_whitelist"`
	OutputSchema   map[string]interface{} `json:"output_schema"`
	MemoryMode     string                 `json:"memory_mode"` // "STATELESS" | "BUFFER_WINDOW" | "SUMMARY"
}

// PublishedAgentVersion represents an immutable published release of an agent.
type PublishedAgentVersion struct {
	Version       string      `json:"version"`
	PublishedAt   string      `json:"published_at"`
	PublishedBy   string      `json:"published_by"`
	Snapshot      RunSnapshot `json:"snapshot"`
	SystemPrompt  string      `json:"system_prompt"`
	ToolWhitelist []string    `json:"tool_whitelist"`
}

// AgentDefinition represents an autonomous AI agent specification.
type AgentDefinition struct {
	ID                  string                  `json:"id"`
	TenantID            string                  `json:"tenant_id"`
	ProjectID           string                  `json:"project_id"`
	Name                string                  `json:"name"`
	Version             string                  `json:"version"`
	Description         string                  `json:"description"`
	CurrentDraft        AgentDraft              `json:"current_draft"`
	PublishedVersions   []PublishedAgentVersion `json:"published_versions"`
	ActiveVersion       string                  `json:"active_version,omitempty"`
	SystemPrompt        string                  `json:"system_prompt"`
	ModelID             string                  `json:"model_id"`
	ToolIDs             []string                `json:"tool_ids"`
	RequiredPermissions []string                `json:"required_permissions"`
	Status              string                  `json:"status"` // "DRAFT" | "PUBLISHED"
	Author              string                  `json:"author"`
	CreatedAt           time.Time               `json:"created_at"`
	UpdatedAt           time.Time               `json:"updated_at"`
}

// WorkflowNode models a node inside a workflow DAG.
type WorkflowNode struct {
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Type     string                 `json:"type"` // "START" | "LLM" | "AGENT" | "TOOL" | "CONDITION" | "HUMAN_APPROVAL" | "END"
	Config   map[string]interface{} `json:"config"`
	Position map[string]int         `json:"position"`
}

// WorkflowEdge models a directed edge inside a workflow DAG.
type WorkflowEdge struct {
	ID             string `json:"id"`
	Source         string `json:"source"`
	Target         string `json:"target"`
	ConditionLabel string `json:"condition_label,omitempty"`
	ConditionExpr  string `json:"condition_expr,omitempty"`
}

// WorkflowDraft stores editable DAG specification.
type WorkflowDraft struct {
	Nodes          []WorkflowNode         `json:"nodes"`
	Edges          []WorkflowEdge         `json:"edges"`
	InputSchema    map[string]interface{} `json:"input_schema"`
	OutputSchema   map[string]interface{} `json:"output_schema"`
	TimeoutSeconds int                    `json:"timeout_seconds"`
}

// PublishedWorkflowVersion represents a frozen published workflow release.
type PublishedWorkflowVersion struct {
	Version     string         `json:"version"`
	PublishedAt string         `json:"published_at"`
	PublishedBy string         `json:"published_by"`
	Nodes       []WorkflowNode `json:"nodes"`
	Edges       []WorkflowEdge `json:"edges"`
	Snapshot    RunSnapshot    `json:"snapshot"`
}

// WorkflowDefinition represents DAG graph orchestrations.
type WorkflowDefinition struct {
	ID                string                     `json:"id"`
	TenantID          string                     `json:"tenant_id"`
	ProjectID         string                     `json:"project_id"`
	Name              string                     `json:"name"`
	Version           string                     `json:"version"`
	Description       string                     `json:"description"`
	CurrentDraft      WorkflowDraft              `json:"current_draft"`
	PublishedVersions []PublishedWorkflowVersion `json:"published_versions"`
	ActiveVersion     string                     `json:"active_version,omitempty"`
	Status            string                     `json:"status"`
	Author            string                     `json:"author"`
	CreatedAt         time.Time                  `json:"created_at"`
	UpdatedAt         time.Time                  `json:"updated_at"`
}

// TokenUsage models step-level token and cost accounting.
type TokenUsage struct {
	PromptTokens     int     `json:"prompt_tokens"`
	CompletionTokens int     `json:"completion_tokens"`
	TotalTokens      int     `json:"total_tokens"`
	EstimatedCostUSD float64 `json:"estimated_cost_usd"`
}

// PolicyEvaluationDecision captures step-level security evaluation output.
type PolicyEvaluationDecision struct {
	Decision         string   `json:"decision"` // "ALLOW" | "DENY" | "REQUIRE_APPROVAL"
	Reason           string   `json:"reason"`
	PolicyVersion    string   `json:"policy_version"`
	RiskLevel        string   `json:"risk_level"`
	RequiredPlanHash string   `json:"required_plan_hash,omitempty"`
	MissingGrants    []string `json:"missing_grants,omitempty"`
	EffectiveGrants  []string `json:"effective_grants,omitempty"`
}

// StepRun represents a single step execution in an agent or workflow run.
type StepRun struct {
	ID             string                    `json:"id"`
	RunID          string                    `json:"run_id"`
	StepID         string                    `json:"step_id"`
	StepName       string                    `json:"step_name"`
	NodeName       string                    `json:"node_name"`
	NodeType       string                    `json:"node_type"`
	State          string                    `json:"state"`
	Status         string                    `json:"status"`
	Input          interface{}               `json:"input,omitempty"`
	Output         interface{}               `json:"output,omitempty"`
	Error          string                    `json:"error,omitempty"`
	PolicyDecision *PolicyEvaluationDecision `json:"policy_decision,omitempty"`
	ApprovalID     string                    `json:"approval_id,omitempty"`
	StartedAt      string                    `json:"started_at,omitempty"`
	EndedAt        string                    `json:"ended_at,omitempty"`
	DurationMs     int64                     `json:"duration_ms"`
	TokenUsage     *TokenUsage               `json:"token_usage,omitempty"`
}

// ExecutionRun represents a deterministic state-machine execution flow aligned with Run in types.ts.
type ExecutionRun struct {
	ID            string                 `json:"id"`
	TargetType    string                 `json:"target_type"` // "AGENT" | "WORKFLOW"
	TargetID      string                 `json:"target_id"`
	TargetVersion string                 `json:"target_version"`
	TargetName    string                 `json:"target_name"`
	TenantID      string                 `json:"tenant_id"`
	ProjectID     string                 `json:"project_id"`
	TraceID       string                 `json:"trace_id"`
	State         string                 `json:"state"`  // "SUCCEEDED" | "WAITING_APPROVAL" | "FAILED" | "CANCELLED"
	Status        string                 `json:"status"` // Mirror for Go backend diagnostics
	InputData     map[string]interface{} `json:"input_data"`
	InputQuery    string                 `json:"input_query"`
	FinalOutput   map[string]interface{} `json:"final_output,omitempty"`
	OutputResult  string                 `json:"output_result,omitempty"`
	ErrorMessage  string                 `json:"error_message,omitempty"`
	Initiator     Principal              `json:"initiator"`
	InitiatedBy   string                 `json:"initiated_by"`
	Snapshot      RunSnapshot            `json:"snapshot"`
	Steps         []StepRun              `json:"steps"`
	TotalTokens   int                    `json:"total_tokens"`
	TotalCostUSD  float64                `json:"total_cost_usd"`
	DurationMs    int64                  `json:"duration_ms"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	StartedAt     string                 `json:"started_at,omitempty"`
	CompletedAt   string                 `json:"completed_at,omitempty"`
}

// ApprovalRecord represents human-in-the-loop governance for high-risk tools.
type ApprovalRecord struct {
	ID              string                 `json:"id"`
	RunID           string                 `json:"run_id"`
	StepID          string                 `json:"step_id"`
	TargetName      string                 `json:"target_name"`
	TenantID        string                 `json:"tenant_id"`
	ProjectID       string                 `json:"project_id"`
	ToolID          string                 `json:"tool_id"`
	ToolName        string                 `json:"tool_name"`
	RiskLevel       string                 `json:"risk_level"`
	ArgsSummary     map[string]interface{} `json:"args_summary"`
	RawPayload      map[string]interface{} `json:"raw_payload"`
	PlanHash        string                 `json:"plan_hash"` // Cryptographic SHA-256 bound hash
	Status          string                 `json:"status"`    // "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"
	RequestedAt     string                 `json:"requested_at"`
	RequestedBy     string                 `json:"requested_by"`
	ReviewedAt      string                 `json:"reviewed_at,omitempty"`
	ReviewedBy      string                 `json:"reviewed_by,omitempty"`
	RejectionReason string                 `json:"rejection_reason,omitempty"`
	ExpiresAt       string                 `json:"expires_at"`
	CreatedAt       time.Time              `json:"created_at"`
	DecidedAt       *time.Time             `json:"decided_at,omitempty"`
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
	Status          string                 `json:"status"` // "SUCCESS" | "FAILURE" | "BLOCKED"
	Timestamp       time.Time              `json:"timestamp"`
}

// BareMetalHost represents a physical server managed by Metal3 & Ironic.
type BareMetalHost struct {
	Name                       string                 `json:"name"`
	RackLocation               string                 `json:"rack_location"`
	BMCAddress                 string                 `json:"bmc_address"`
	BMCProtocol                string                 `json:"bmc_protocol"`
	BootMACAddress             string                 `json:"boot_mac_address"`
	PowerStatus                string                 `json:"power_status"`        // "ON" | "OFF" | "REBOOTING"
	ProvisioningStatus         string                 `json:"provisioning_status"` // "Available" | "Provisioning" | "ActiveInCluster" | "Degraded" | "Provisioning Failed"
	AssignedRole               string                 `json:"assigned_role"`       // "control-plane" | "worker-gpu" | "worker-compute"
	TargetClusterID            *string                `json:"target_cluster_id,omitempty"`
	K8sVersion                 string                 `json:"k8s_version"`
	TargetK8sVersion           string                 `json:"target_k8s_version,omitempty"`
	UpgradeStatus              string                 `json:"upgrade_status"`
	BootImage                  string                 `json:"boot_image,omitempty"`
	ProvisioningProgressPercent int                   `json:"provisioning_progress_percent"`
	Hardware                   map[string]interface{} `json:"hardware"`
	Sensors                    map[string]interface{} `json:"sensors"`
	IPAddresses                map[string]string      `json:"ip_addresses"`
	SerialConsoleRecent        []string               `json:"serial_console_recent"`
	UpdatedAt                  time.Time              `json:"updated_at"`
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
	Message            string                 `json:"message"`
	MessageEn          string                 `json:"message_en"`
	ErrorCode          string                 `json:"error_code"`
	Diagnostics        map[string]interface{} `json:"diagnostics"`
	DispatchedChannels []string               `json:"dispatched_channels"`
	DetectedAt         time.Time              `json:"detected_at"`
	ResolvedAt         *time.Time             `json:"resolved_at,omitempty"`
}

// TargetClusterScale models cluster node sizing.
type TargetClusterScale struct {
	ControlPlaneNodes int `json:"control_plane_nodes"`
	WorkerNodes       int `json:"worker_nodes"`
	GPUNodes          int `json:"gpu_nodes"`
	TotalNodes        int `json:"total_nodes"`
}

// TargetCluster represents a target Kubernetes cluster managed by Metal3 eph-node.
type TargetCluster struct {
	ID                string             `json:"id"`
	Name              string             `json:"name"`
	Version           string             `json:"version"`
	K8sVersion        string             `json:"k8s_version"`
	Status            string             `json:"status"` // "PROVISIONING" | "READY" | "UPGRADING_VERSION" | "SCALING"
	ControlPlaneNodes int                `json:"control_plane_nodes"`
	WorkerNodes       int                `json:"worker_nodes"`
	Scale             TargetClusterScale `json:"scale"`
	CNI               string             `json:"cni"`
	GPUOperator       string             `json:"gpu_operator"`
	ProgressPercent   int                `json:"progress_percent"`
	CurrentStage      string             `json:"current_stage"`
	APIEndpoint       string             `json:"api_endpoint"`
	CreatedAt         time.Time          `json:"created_at"`
}

// PluginMetrics represents runtime telemetry for external plugins.
type PluginMetrics struct {
	TotalCalls   int64  `json:"total_calls"`
	SuccessCalls int64  `json:"success_calls"`
	ErrorCalls   int64  `json:"error_calls"`
	P95LatencyMs int    `json:"p95_latency_ms"`
	LastCalledAt string `json:"last_called_at,omitempty"`
}

// Plugin represents registered external app connectors matching PluginItem in plugins.ts.
type Plugin struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	NameZh        string                 `json:"name_zh"`
	Category      string                 `json:"category"`
	Provider      string                 `json:"provider"`
	Version       string                 `json:"version"`
	Description   string                 `json:"description"`
	DescriptionZh string                 `json:"description_zh"`
	Icon          string                 `json:"icon"`
	AuthType      string                 `json:"auth_type"`
	Endpoint      string                 `json:"endpoint,omitempty"`
	APIKeyRef     string                 `json:"api_key_ref,omitempty"`
	IsActive      bool                   `json:"is_active"`
	IsConfigured  bool                   `json:"is_configured"`
	TotalCalls    int64                  `json:"total_calls"`
	P95LatencyMs  int                    `json:"p95_latency_ms"`
	ToolID        string                 `json:"tool_id,omitempty"`
	Risk          string                 `json:"risk,omitempty"`
	Config        map[string]interface{} `json:"config"`
	Metrics       PluginMetrics          `json:"metrics"`
	Tools         []ToolDefinition       `json:"tools"`
	CreatedAt     time.Time              `json:"created_at"`
}

// DualAgentOrchestrator models
type AgentSpec struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Role        string                 `json:"role"` // "EPH_BOOTSTRAP_AGENT" | "TARGET_CLUSTER_LIFECYCLE_AGENT"
	Location    string                 `json:"location"`
	Status      string                 `json:"status"` // "ACTIVE" | "SYNCHRONIZING" | "IDLE" | "ERROR"
	Version     string                 `json:"version"`
	PodName     string                 `json:"pod_name"`
	Namespace   string                 `json:"namespace"`
	Heartbeat   time.Time              `json:"heartbeat"`
	ActiveTasks []string               `json:"active_tasks"`
	Metrics     map[string]interface{} `json:"metrics"`
}

type DualAgentStatus struct {
	BootstrapAgent AgentSpec        `json:"bootstrap_agent"`
	TargetAgent    AgentSpec        `json:"target_agent"`
	CurrentPhase   string           `json:"current_phase"`
	PivotStatus    string           `json:"pivot_status"`
	SyncedAt       time.Time        `json:"synced_at"`
	Events         []DualAgentEvent `json:"events"`
}

type DualAgentEvent struct {
	ID        string    `json:"id"`
	Source    string    `json:"source"`
	Phase     string    `json:"phase"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	MessageZh string    `json:"message_zh"`
	Timestamp time.Time `json:"timestamp"`
}

// DualNetworkSpec models
type NetworkInterfaceConfig struct {
	Name       string   `json:"name"`
	Type       string   `json:"type"`
	CIDR       string   `json:"cidr"`
	VLAN       int      `json:"vlan"`
	Gateway    string   `json:"gateway"`
	MTU        int      `json:"mtu"`
	Interfaces []string `json:"interfaces"`
	Purpose    string   `json:"purpose"`
	PurposeZh  string   `json:"purpose_zh"`
	Bandwidth  string   `json:"bandwidth"`
}

type DualNetworkSpec struct {
	ControlNetwork NetworkInterfaceConfig `json:"control_network"`
	DataNetwork    NetworkInterfaceConfig `json:"data_network"`
}

// MultiCNISpec models
type CNIComponent struct {
	Name       string                 `json:"name"`
	Type       string                 `json:"type"`
	Version    string                 `json:"version"`
	Status     string                 `json:"status"`
	Interface  string                 `json:"interface"`
	Features   []string               `json:"features"`
	FeaturesZh []string               `json:"features_zh"`
	Latency    string                 `json:"latency"`
	Throughput string                 `json:"throughput"`
	Config     map[string]interface{} `json:"config"`
}

type MultiCNISpec struct {
	Multus                       CNIComponent             `json:"multus"`
	Calico                       CNIComponent             `json:"calico"`
	OVS                          CNIComponent             `json:"ovs"`
	SRIOV                        CNIComponent             `json:"sriov"`
	DPDKPlanes                   []CNIComponent           `json:"dpdk_planes,omitempty"`
	NetworkAttachmentDefinitions []map[string]interface{} `json:"network_attachment_definitions"`
}

// Talos Omni Rapid Deployment models
type OmniDeployRequest struct {
	ClusterName        string   `json:"cluster_name"`
	K8sVersion         string   `json:"k8s_version"`
	ControlPlaneNodes  int      `json:"control_plane_nodes"`
	WorkerGPUNodes     int      `json:"worker_gpu_nodes"`
	WorkerComputeNodes int      `json:"worker_compute_nodes"`
	SelectedHostNames  []string `json:"selected_host_names"`
	EnableDualNetwork  bool     `json:"enable_dual_network"`
	EnableMultiCNI     bool     `json:"enable_multi_cni"`
	AutoPivot          bool     `json:"auto_pivot"`
}

type OmniDeployProgress struct {
	ClusterID        string            `json:"cluster_id"`
	ClusterName      string            `json:"cluster_name"`
	Status           string            `json:"status"`
	CurrentStepIndex int               `json:"current_step_index"`
	TotalSteps       int               `json:"total_steps"`
	ProgressPercent  int               `json:"progress_percent"`
	ElapsedTimeSec   int               `json:"elapsed_time_sec"`
	EstimatedSec     int               `json:"estimated_sec"`
	Steps            []OmniDeployStep  `json:"steps"`
	Manifests        map[string]string `json:"manifests"`
	ActiveDualAgent  DualAgentStatus   `json:"active_dual_agent"`
}

type OmniDeployStep struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	NameZh      string `json:"name_zh"`
	AgentSource string `json:"agent_source"`
	Status      string `json:"status"`
	DurationMs  int64  `json:"duration_ms"`
	Detail      string `json:"detail"`
}

// PacketSimulation models for Multi-CNI & Dual-Network packet trace
type PacketSimulationRequest struct {
	TrafficType string `json:"traffic_type"`
	SourcePod   string `json:"source_pod"`
	DestPod     string `json:"dest_pod"`
}

type PacketHop struct {
	Order    int    `json:"order"`
	Device   string `json:"device"`
	Layer    string `json:"layer"`
	Action   string `json:"action"`
	ActionZh string `json:"action_zh"`
	Latency  string `json:"latency"`
	Headers  string `json:"headers"`
}

type PacketSimulationResult struct {
	TrafficType    string      `json:"traffic_type"`
	TrafficTypeZh  string      `json:"traffic_type_zh"`
	SelectedPath   string      `json:"selected_path"`
	TotalLatency   string      `json:"total_latency"`
	ThroughputWire string      `json:"throughput_wire"`
	JumboFrames    bool        `json:"jumbo_frames"`
	Hops           []PacketHop `json:"hops"`
	Status         string      `json:"status"`
}

// ManifestValidation models for declarative CAPI, Multus & Talos manifests
type ManifestValidationRequest struct {
	Filename string `json:"filename"`
	Content  string `json:"content"`
}

type ManifestValidationResult struct {
	Valid        bool                   `json:"valid"`
	Kind         string                 `json:"kind"`
	APIVersion   string                 `json:"api_version"`
	ResourceName string                 `json:"resource_name"`
	ChecksPassed []string               `json:"checks_passed"`
	Warnings     []string               `json:"warnings"`
	Errors       []string               `json:"errors"`
	ParsedSpec   map[string]interface{} `json:"parsed_spec"`
}

// SupportedK8sVersion models detailed Kubernetes release metadata.
type SupportedK8sVersion struct {
	ID                string   `json:"id"`
	Version           string   `json:"version"`
	MajorMinor        string   `json:"major_minor"`
	DisplayName       string   `json:"display_name"`
	DisplayNameZh     string   `json:"display_name_zh"`
	Channel           string   `json:"channel"`
	ReleaseDate       string   `json:"release_date"`
	Status            string   `json:"status"`
	StatusZh          string   `json:"status_zh"`
	BadgeColor        string   `json:"badge_color"`
	TalosLinux        string   `json:"talos_linux"`
	ContainerdVersion string   `json:"containerd_version"`
	RoceOptimized     bool     `json:"roce_optimized"`
	DRAVersion        string   `json:"dra_version"`
	DescriptionEn     string   `json:"description_en"`
	DescriptionZh     string   `json:"description_zh"`
	FeaturesZh        []string `json:"features_zh"`
	FeaturesEn        []string `json:"features_en"`
	RecommendedFor    string   `json:"recommended_for"`
}

type NodeVersionApplyRequest struct {
	NodeNames        []string `json:"node_names,omitempty"`
	NodeName         string   `json:"node_name,omitempty"`
	TargetVersion    string   `json:"target_version,omitempty"`
	TargetK8sVersion string   `json:"target_k8s_version,omitempty"`
	Policy           string   `json:"policy,omitempty"`
	DrainTimeout     int      `json:"drain_timeout,omitempty"`
}

type ClusterUpgradeRequest struct {
	TargetVersion    string   `json:"target_version,omitempty"`
	TargetK8sVersion string   `json:"target_k8s_version,omitempty"`
	Policy           string   `json:"policy,omitempty"`
	TargetNodes      []string `json:"target_nodes,omitempty"`
	DrainTimeout     int      `json:"drain_timeout,omitempty"`
}

// UpgradeStepStatus tracks a single phase of the Kubernetes version controller reconcile loop.
type UpgradeStepStatus struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"` // "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"
}

// NodeUpgradeState tracks per-node reconciliation progress for an active upgrade job.
type NodeUpgradeState struct {
	HostName      string `json:"host_name"`
	Role          string `json:"role"`
	FromVersion   string `json:"from_version"`
	TargetVersion string `json:"target_version"`
	Phase         string `json:"phase"` // "QUEUED" | "CORDONING" | "PIVOTING_IMAGE" | "KUBELET_HANDSHAKE" | "COMPLETED"
	UpdatedAt     string `json:"updated_at"`
}

// ClusterUpgradeJob tracks cluster-level Kubernetes version reconciliation state.
type ClusterUpgradeJob struct {
	ID                 string               `json:"id"`
	ClusterID          string               `json:"cluster_id"`
	IsUpgrading        bool                 `json:"is_upgrading"`
	CurrentVersion     string               `json:"current_version"`
	TargetVersion      string               `json:"target_version"`
	Policy             string               `json:"policy"` // "rolling" | "canary" | "batch"
	DrainTimeout       int                  `json:"drain_timeout"`
	Status             string               `json:"status"` // "READY" | "UPGRADING_VERSION" | "FAILED"
	CurrentStepIndex   int                  `json:"current_step_index"`
	TotalNodes         int                  `json:"total_nodes"`
	UpgradedNodesCount int                  `json:"upgraded_nodes_count"`
	ReconcileCount     int                  `json:"reconcile_count"`
	TargetNodes        []string             `json:"target_nodes"`
	NodeStates         []NodeUpgradeState   `json:"node_states"`
	Steps              []UpgradeStepStatus  `json:"steps"`
	TriggeredBy        string               `json:"triggered_by"`
	StartedAt          time.Time            `json:"started_at"`
	UpdatedAt          time.Time            `json:"updated_at"`
	CompletedAt        *time.Time           `json:"completed_at,omitempty"`
	LastError          string               `json:"last_error,omitempty"`
}
