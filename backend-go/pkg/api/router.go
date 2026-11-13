package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/cni"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/connectors"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/dag"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/metal3"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/policy"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/store"
)

// Server holds all Go microservices and HTTP routing handlers.
type Server struct {
	Store       *store.Store
	Policy      *policy.PolicyEngine
	Metal3      *metal3.Engine
	Connectors  *connectors.Registry
	RateLimiter *RateLimiter
	Mux         *http.ServeMux
}

func NewServer(s *store.Store, m3 *metal3.Engine, conn *connectors.Registry) *Server {
	srv := &Server{
		Store:       s,
		Policy:      policy.NewPolicyEngine(),
		Metal3:      m3,
		Connectors:  conn,
		RateLimiter: NewRateLimiter(DefaultRateLimitConfig()),
		Mux:         http.NewServeMux(),
	}
	srv.registerRoutes()
	return srv
}

// Handler returns the root HTTP handler wrapped with per-principal API rate limiting.
func (s *Server) Handler() http.Handler {
	return s.RateLimitMiddleware(s.Mux)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeAPIError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error": map[string]interface{}{
			"code":    code,
			"message": message,
		},
	})
}

func writeError(w http.ResponseWriter, status int, message string) {
	code := "BAD_REQUEST"
	switch status {
	case http.StatusForbidden:
		code = "FORBIDDEN"
	case http.StatusNotFound:
		code = "NOT_FOUND"
	case http.StatusConflict:
		code = "CONFLICT"
	case http.StatusTooManyRequests:
		code = "QUOTA_EXCEEDED"
	case http.StatusInternalServerError:
		code = "INTERNAL_ERROR"
	}
	writeAPIError(w, status, code, message)
}

// currentActor resolves the active Principal from X-Actor-ID header or Store.CurrentActor.
func (s *Server) currentActor(r *http.Request) *models.Principal {
	s.Store.RLock()
	defer s.Store.RUnlock()

	if r != nil {
		if actorID := strings.TrimSpace(r.Header.Get("X-Actor-ID")); actorID != "" {
			if p, ok := s.Store.Principals[actorID]; ok {
				return p
			}
			// Explicit unknown X-Actor-ID must be treated as unauthorized nil principal
			return nil
		}
	}
	return s.Store.CurrentActor
}

// authorize enforces zero-trust principal resolution, revocation barriers, and RBAC permission checks.
func (s *Server) authorize(w http.ResponseWriter, r *http.Request, targetResource string, requiredPerms ...string) (*models.Principal, bool) {
	s.Store.RLock()
	var actor *models.Principal
	if r != nil {
		if actorID := strings.TrimSpace(r.Header.Get("X-Actor-ID")); actorID != "" {
			actor = s.Store.Principals[actorID]
		} else {
			actor = s.Store.CurrentActor
		}
	} else {
		actor = s.Store.CurrentActor
	}
	revoked, revokeReason := s.Policy.IsRoleRevoked(actor, s.Store.Members, s.Store.RoleBindings)
	s.Store.RUnlock()

	if actor == nil {
		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        "tenant_acme_corp",
			ProjectID:       "proj_infra_ops",
			ActorID:         "anonymous",
			ActorName:       "Anonymous",
			ActorRole:       "NONE",
			EventType:       "POLICY_EVALUATION",
			TargetResource:  targetResource,
			Summary:         "Blocked unauthenticated request under zero-trust default deny",
			PayloadRedacted: map[string]interface{}{"path": r.URL.Path, "method": r.Method},
			Status:          "BLOCKED",
		})
		writeAPIError(w, http.StatusForbidden, "UNAUTHENTICATED", "Anonymous access denied by zero-trust default")
		return nil, false
	}

	if revoked {
		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "POLICY_EVALUATION",
			TargetResource:  targetResource,
			Summary:         revokeReason,
			PayloadRedacted: map[string]interface{}{"path": r.URL.Path, "method": r.Method},
			Status:          "BLOCKED",
		})
		writeAPIError(w, http.StatusForbidden, "ROLE_REVOKED", revokeReason)
		return nil, false
	}

	if !s.Policy.HasAnyPermission(actor, requiredPerms...) {
		msg := fmt.Sprintf("PERMISSION_DENIED: Role '%s' (%s) lacks required permission [%s] for '%s'",
			actor.Role, actor.ActorName, strings.Join(requiredPerms, " | "), targetResource)
		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "POLICY_EVALUATION",
			TargetResource:  targetResource,
			Summary:         msg,
			PayloadRedacted: map[string]interface{}{"path": r.URL.Path, "method": r.Method, "required": requiredPerms},
			Status:          "BLOCKED",
		})
		writeAPIError(w, http.StatusForbidden, "PERMISSION_DENIED", msg)
		return nil, false
	}

	return actor, true
}

// findTool searches Store.Tools first, then registered plugins in Connectors.
func (s *Server) findTool(toolID string) (*models.ToolDefinition, bool) {
	s.Store.RLock()
	t, ok := s.Store.Tools[toolID]
	s.Store.RUnlock()
	if ok {
		return t, true
	}
	return s.Connectors.GetTool(toolID)
}

func (s *Server) listAllTools() []*models.ToolDefinition {
	s.Store.RLock()
	out := make([]*models.ToolDefinition, 0, len(s.Store.Tools)+10)
	seen := make(map[string]bool)
	for _, t := range s.Store.Tools {
		tCopy := *t
		out = append(out, &tCopy)
		seen[t.ID] = true
	}
	s.Store.RUnlock()

	for _, p := range s.Connectors.ListPlugins() {
		for _, pt := range p.Tools {
			if !seen[pt.ID] {
				ptCopy := pt
				ptCopy.IsActive = p.IsActive && ptCopy.IsActive
				out = append(out, &ptCopy)
				seen[pt.ID] = true
			}
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].ID < out[j].ID
	})
	return out
}

func (s *Server) registerRoutes() {
	// -------------------------------------------------------------
	// 1. SYSTEM & TELEMETRY
	// -------------------------------------------------------------
	s.Mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":         "HEALTHY",
			"engine":         "Golang 1.22+ Native Control Plane",
			"version":        "2.1.0-go",
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"uptime_seconds": time.Since(s.Store.StartTime).Seconds(),
			"components": map[string]interface{}{
				"storage":            map[string]interface{}{"status": "UP", "type": "GO_SYNC_MUTEX_WAL"},
				"metal3_driver":      map[string]interface{}{"status": "UP", "ironic": "ONLINE"},
				"version_controller": map[string]interface{}{"status": "UP", "reconcile_loop": "ACTIVE"},
				"policy_engine":      map[string]interface{}{"status": "UP", "policy_version": policy.PolicyVersion},
			},
		})
	})

	s.Mux.HandleFunc("GET /api/v1/system/backend-overview", func(w http.ResponseWriter, r *http.Request) {
		var mem runtime.MemStats
		runtime.ReadMemStats(&mem)

		s.Store.RLock()
		tenantsLen := len(s.Store.Tenants)
		projectsLen := len(s.Store.Projects)
		membersLen := len(s.Store.Members)
		agentsLen := len(s.Store.Agents)
		workflowsLen := len(s.Store.Workflows)
		runsLen := len(s.Store.Runs)
		approvalsLen := len(s.Store.Approvals)
		auditsLen := len(s.Store.Audits)
		s.Store.RUnlock()

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"server": map[string]interface{}{
					"engine":         "Golang 1.22+ Cloud-Native Microservices",
					"go_version":     runtime.Version(),
					"platform":       runtime.GOOS,
					"arch":           runtime.GOARCH,
					"pid":            os.Getpid(),
					"port":           "9090",
					"uptime_seconds": int(time.Since(s.Store.StartTime).Seconds()),
					"goroutines":     runtime.NumGoroutine(),
					"env":            "production",
				},
				"memory": map[string]interface{}{
					"rss_mb":        mem.Sys / 1024 / 1024,
					"heap_used_mb":  mem.Alloc / 1024 / 1024,
					"heap_total_mb": mem.TotalAlloc / 1024 / 1024,
					"gc_cycles":     mem.NumGC,
				},
				"worker_pool": map[string]interface{}{
					"active_workers":  runtime.GOMAXPROCS(0),
					"scheduler":       "Golang CSP Channel Loop & VersionController Reconciler",
					"tasks_processed": runsLen,
					"status":          "HEALTHY",
				},
				"database": map[string]interface{}{
					"engine":     "Golang Concurrency-Safe Memory WAL (PostgreSQL DDL Ready)",
					"wal_status": "SYNCED",
					"tables": map[string]interface{}{
						"tenants":          tenantsLen,
						"projects":         projectsLen,
						"members":          membersLen,
						"agents":           agentsLen,
						"workflows":        workflowsLen,
						"runs":             runsLen,
						"approvals":        approvalsLen,
						"audits":           auditsLen,
						"bare_metal_hosts": len(s.Metal3.ListHosts()),
						"plugins":          len(s.Connectors.ListPlugins()),
					},
				},
				"microservices": []map[string]interface{}{
					{
						"name":     "Per-Principal API Rate Limiter",
						"status":   "ACTIVE",
						"protocol": "TokenBucket Middleware (X-RateLimit-*)",
						"details":  "Enforces role-aware per-principal API quotas, burst protection, and 429 audit logging.",
					},
					{
						"name":     "Kubernetes VersionController & Reconciler",
						"status":   "ACTIVE",
						"protocol": "Go Reconcile Loop (1200ms Tick)",
						"details":  "Drives rolling, canary, and batch K8s upgrades across Talos BareMetal nodes.",
					},
					{
						"name":     "Metal3 Ironic Conductor Connector",
						"status":   "ACTIVE",
						"protocol": "Redfish OOB + IPMI v2.0",
						"details":  "Direct BMC power lifecycle, VirtualMedia boot, and Serial-over-LAN proxy.",
					},
					{
						"name":     "Zero-Trust Policy Evaluator",
						"status":   "ACTIVE",
						"protocol": "Cryptographic In-Memory SHA-256",
						"details":  "Default-deny rule engine, role revocation barrier, four-way grant intersection, and plan_hash verification.",
					},
					{
						"name":     "High-Throughput Concurrent DAG Scheduler",
						"status":   "ACTIVE",
						"protocol": "Kahn Topological Layering",
						"details":  "Cycle detection and parallel DAG layer resolution.",
					},
					{
						"name":     "Enterprise Connector Dispatcher",
						"status":   "ACTIVE",
						"protocol": "HMAC-SHA256 Signed Webhooks",
						"details":  "Google Maps, Global Weather, Amap, Feishu, DingTalk, WeCom, WeChat, 12306, Alipay.",
					},
					{
						"name":     "Immutable WAL Audit Store",
						"status":   "ACTIVE",
						"protocol": "Sanitized Append-Only Log",
						"details":  "Full forensic trace accountability with automatic credential redaction.",
					},
				},
				"rate_limiter": s.RateLimiter.Metrics(),
			},
		})
	})

	s.Mux.HandleFunc("GET /api/v1/system/ratelimit", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    s.RateLimiter.Metrics(),
		})
	})

	s.Mux.HandleFunc("GET /api/v1/system/routes", func(w http.ResponseWriter, r *http.Request) {
		routes := []map[string]string{
			{"category": "SYSTEM", "method": "GET", "path": "/api/v1/health", "auth": "Public", "description": "Backend health check & Go runtime stats"},
			{"category": "SYSTEM", "method": "GET", "path": "/api/v1/metrics", "auth": "Session", "description": "Control plane operational & cost metrics"},
			{"category": "SYSTEM", "method": "GET", "path": "/api/v1/system/backend-overview", "auth": "Session", "description": "Live Goroutines, memory, microservices topology & rate limit metrics"},
			{"category": "SYSTEM", "method": "GET", "path": "/api/v1/system/ratelimit", "auth": "Session", "description": "Per-principal token-bucket rate limiter live metrics & buckets"},
			{"category": "SYSTEM", "method": "GET", "path": "/api/v1/system/routes", "auth": "Session", "description": "Complete registry of all Golang endpoints"},
			{"category": "SYSTEM", "method": "GET", "path": "/api/v1/system/sql-schema", "auth": "Session", "description": "PostgreSQL relational schema DDL definitions"},
			{"category": "IDENTITY", "method": "GET", "path": "/api/v1/principals/me", "auth": "Session", "description": "Current active actor principal"},
			{"category": "IDENTITY", "method": "GET", "path": "/api/v1/principals", "auth": "Session", "description": "List available actors in system"},
			{"category": "IDENTITY", "method": "POST", "path": "/api/v1/principals/switch", "auth": "Public", "description": "Switch actor identity context"},
			{"category": "IDENTITY", "method": "POST", "path": "/api/v1/auth/oidc/verify", "auth": "Public", "description": "Enforce OIDC/mTLS guard against dev identities in prod"},
			{"category": "IDENTITY", "method": "GET", "path": "/api/v1/tenants", "auth": "Session", "description": "List tenant organizations & nested quotas"},
			{"category": "IDENTITY", "method": "PUT", "path": "/api/v1/tenants/{id}/quota", "auth": "QUOTA_MANAGE", "description": "Update tenant concurrency and budget quotas"},
			{"category": "IDENTITY", "method": "GET", "path": "/api/v1/projects", "auth": "Session", "description": "List projects scoped to tenant"},
			{"category": "IDENTITY", "method": "GET", "path": "/api/v1/members", "auth": "Session", "description": "List organization members"},
			{"category": "IDENTITY", "method": "POST", "path": "/api/v1/members", "auth": "USER_MANAGE", "description": "Invite member and issue role binding"},
			{"category": "IDENTITY", "method": "POST", "path": "/api/v1/members/{id}/revoke", "auth": "USER_MANAGE", "description": "Immediately revoke member role binding"},
			{"category": "AGENT", "method": "GET", "path": "/api/v1/agents", "auth": "Session", "description": "List AI agents"},
			{"category": "AGENT", "method": "POST", "path": "/api/v1/agents", "auth": "AGENT_CREATE", "description": "Create draft agent"},
			{"category": "AGENT", "method": "PUT", "path": "/api/v1/agents/{id}", "auth": "AGENT_DRAFT", "description": "Update agent draft settings"},
			{"category": "AGENT", "method": "POST", "path": "/api/v1/agents/{id}/publish", "auth": "AGENT_PUBLISH", "description": "Freeze immutable agent release snapshot"},
			{"category": "AGENT", "method": "POST", "path": "/api/v1/agents/{id}/run", "auth": "RUN_EXECUTE", "description": "Trigger zero-trust agent execution run"},
			{"category": "WORKFLOW", "method": "GET", "path": "/api/v1/workflows", "auth": "Session", "description": "List workflow DAGs"},
			{"category": "WORKFLOW", "method": "POST", "path": "/api/v1/workflows/{id}/validate", "auth": "Session", "description": "Validate DAG acyclicity via layered Kahn algorithm"},
			{"category": "WORKFLOW", "method": "POST", "path": "/api/v1/workflows/{id}/publish", "auth": "WORKFLOW_DRAFT", "description": "Publish frozen workflow release"},
			{"category": "RUNS", "method": "GET", "path": "/api/v1/runs", "auth": "Session", "description": "List execution history"},
			{"category": "APPROVALS", "method": "GET", "path": "/api/v1/approvals", "auth": "Session", "description": "List governance approval requests"},
			{"category": "APPROVALS", "method": "POST", "path": "/api/v1/approvals/{id}/decide", "auth": "APPROVE_HIGH_RISK", "description": "Approve/reject with SHA-256 plan_hash verification"},
			{"category": "METAL3", "method": "GET", "path": "/api/v1/metal3/k8s-versions", "auth": "Session", "description": "List curated Kubernetes version catalog"},
			{"category": "METAL3", "method": "POST", "path": "/api/v1/metal3/clusters/{id}/upgrade", "auth": "CLUSTER_MANAGE", "description": "Trigger VersionController reconcile upgrade job"},
			{"category": "METAL3", "method": "POST", "path": "/api/v1/metal3/clusters/{id}/reconcile", "auth": "CLUSTER_MANAGE", "description": "Step VersionController reconcile loop immediately"},
			{"category": "METAL3", "method": "GET", "path": "/api/v1/metal3/clusters/{id}/upgrade-status", "auth": "Session", "description": "Inspect live VersionController job & node progress"},
			{"category": "METAL3", "method": "POST", "path": "/api/v1/metal3/nodes/version-apply", "auth": "CLUSTER_MANAGE", "description": "Apply targeted K8s version to selected nodes"},
			{"category": "METAL3", "method": "GET", "path": "/api/v1/metal3/cni/fleet", "auth": "Session", "description": "Inspect Calico/Multus/SR-IOV fleet CNI state machine & artifacts"},
			{"category": "METAL3", "method": "POST", "path": "/api/v1/metal3/cni/reconcile", "auth": "CLUSTER_MANAGE", "description": "Step or converge CNI provisioning state machine across fleet"},
			{"category": "METAL3", "method": "POST", "path": "/api/v1/metal3/cni/config", "auth": "CLUSTER_MANAGE", "description": "Apply declarative Calico/Multus/SR-IOV fleet interface configuration"},
			{"category": "METAL3", "method": "POST", "path": "/api/v1/metal3/cni/drift", "auth": "HOST_MANAGE", "description": "Simulate interface drift/degradation to test CNI self-healing"},
			{"category": "METAL3", "method": "POST", "path": "/api/v1/metal3/bmh/{name}/power", "auth": "HOST_MANAGE", "description": "Redfish BMC out-of-band power control"},
			{"category": "METAL3", "method": "POST", "path": "/api/v1/metal3/alerts/{id}/remediate", "auth": "HOST_MANAGE", "description": "Trigger autonomous AI self-healing"},
			{"category": "PLUGINS", "method": "GET", "path": "/api/v1/plugins", "auth": "Session", "description": "List registered ecosystem connectors"},
			{"category": "PLUGINS", "method": "POST", "path": "/api/v1/domestic/dispatch", "auth": "NOTIFY_SEND", "description": "Dispatch HMAC-SHA256 signed domestic webhook"},
			{"category": "PLUGINS", "method": "POST", "path": "/api/v1/weather/query", "auth": "WEATHER_READ", "description": "Query global meteorological & AQI telemetry"},
			{"category": "AUDIT", "method": "GET", "path": "/api/v1/audits", "auth": "Session", "description": "Immutable redacted security audit trail"},
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "count": len(routes), "data": routes})
	})

	s.Mux.HandleFunc("GET /api/v1/system/sql-schema", func(w http.ResponseWriter, r *http.Request) {
		cwd, _ := os.Getwd()
		path := filepath.Join(cwd, "src/server/schema.sql")
		bytes, err := os.ReadFile(path)
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "sql": string(bytes), "tables_count": 15})
	})

	s.Mux.HandleFunc("GET /api/v1/openapi.json", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"openapi": "3.1.0",
			"info": map[string]interface{}{
				"title":       "AI Agent Studio Go Native Control Plane API",
				"version":     "2.1.0-go",
				"description": "Enterprise AI Agent & Metal3 Fleet Zero-Trust Golang 1.22+ Native Control Plane.",
			},
			"paths": map[string]interface{}{
				"/api/v1/health":                              map[string]interface{}{"get": map[string]string{"summary": "System health check"}},
				"/api/v1/metrics":                             map[string]interface{}{"get": map[string]string{"summary": "Operational telemetry"}},
				"/api/v1/principals/me":                       map[string]interface{}{"get": map[string]string{"summary": "Current principal"}},
				"/api/v1/agents/{id}/run":                     map[string]interface{}{"post": map[string]string{"summary": "Zero-trust agent execution"}},
				"/api/v1/approvals/{id}/decide":               map[string]interface{}{"post": map[string]string{"summary": "Approve/reject with SHA-256 plan_hash"}},
				"/api/v1/metal3/clusters/{id}/upgrade":        map[string]interface{}{"post": map[string]string{"summary": "Trigger Kubernetes VersionController reconcile"}},
				"/api/v1/metal3/clusters/{id}/reconcile":      map[string]interface{}{"post": map[string]string{"summary": "Step VersionController reconcile tick"}},
				"/api/v1/metal3/clusters/{id}/upgrade-status": map[string]interface{}{"get": map[string]string{"summary": "Live cluster upgrade progress"}},
			},
		})
	})

	s.Mux.HandleFunc("GET /api/v1/system/backend-code", func(w http.ResponseWriter, r *http.Request) {
		lang := r.URL.Query().Get("lang")
		if lang == "" {
			lang = "go"
		}
		cwd, _ := os.Getwd()
		var relPath, fileName string
		switch lang {
		case "go", "go-main":
			relPath = "backend-go/cmd/server/main.go"
			fileName = "main.go (Go Server Entrypoint)"
		case "go-metal3":
			relPath = "backend-go/pkg/metal3/metal3.go"
			fileName = "metal3.go (Metal3 Dual-Agent Controller)"
		case "go-version-controller":
			relPath = "backend-go/pkg/metal3/version_controller.go"
			fileName = "version_controller.go (K8s VersionController Reconcile Loop)"
		case "go-models":
			relPath = "backend-go/pkg/models/models.go"
			fileName = "models.go (Domain Contracts & Entities)"
		case "go-router":
			relPath = "backend-go/pkg/api/router.go"
			fileName = "router.go (Go Zero-Trust REST HTTP Mux)"
		case "go-ratelimit":
			relPath = "backend-go/pkg/api/ratelimit.go"
			fileName = "ratelimit.go (Per-Principal API Rate Limiting Middleware)"
		case "go-cni", "go-cni-statemachine":
			relPath = "backend-go/pkg/cni/statemachine.go"
			fileName = "statemachine.go (Calico/Multus/SR-IOV Fleet Reconciled State Machine)"
		case "go-cni-config":
			relPath = "backend-go/pkg/cni/config.go"
			fileName = "config.go (Calico/Multus/SR-IOV Config Validator & Renderer)"
		case "go-cni-types":
			relPath = "backend-go/pkg/cni/types.go"
			fileName = "types.go (Calico/Multus/SR-IOV Domain Contracts)"
		case "go-policy":
			relPath = "backend-go/pkg/policy/policy.go"
			fileName = "policy.go (Zero-Trust Security & PlanHash Engine)"
		case "go-connectors":
			relPath = "backend-go/pkg/connectors/connectors.go"
			fileName = "connectors.go (Ecosystem & Domestic Connectors)"
		case "go-dag":
			relPath = "backend-go/pkg/dag/dag.go"
			fileName = "dag.go (Layered Topological DAG Scheduler)"
		case "go-store":
			relPath = "backend-go/pkg/store/store.go"
			fileName = "store.go (Concurrency-Safe WAL Store)"
		case "go-docker":
			relPath = "backend-go/Dockerfile"
			fileName = "Dockerfile (Scratch Minimal Static Binary)"
		case "go-root":
			relPath = "backend-go/main.go"
			fileName = "main.go (Stand-alone Single Binary)"
		case "python":
			relPath = "backend-python/main.py"
			fileName = "main.py"
		case "python-docker":
			relPath = "backend-python/Dockerfile"
			fileName = "Dockerfile"
		default:
			relPath = "backend-go/cmd/server/main.go"
			fileName = "main.go"
		}

		targetPath := filepath.Join(cwd, relPath)
		bytes, err := os.ReadFile(targetPath)
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":  true,
			"lang":     lang,
			"filename": fileName,
			"code":     string(bytes),
		})
	})

	// -------------------------------------------------------------
	// 2. IDENTITY, RBAC & ZERO-TRUST AUTH
	// -------------------------------------------------------------
	s.Mux.HandleFunc("GET /api/v1/principals/me", func(w http.ResponseWriter, r *http.Request) {
		actor := s.currentActor(r)
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": actor})
	})

	s.Mux.HandleFunc("GET /api/v1/principals", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Store.ListPrincipalsSorted()})
	})

	s.Mux.HandleFunc("POST /api/v1/principals/switch", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ActorID string `json:"actor_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		s.Store.Lock()
		p, ok := s.Store.Principals[req.ActorID]
		if !ok {
			s.Store.Unlock()
			writeAPIError(w, http.StatusNotFound, "PRINCIPAL_NOT_FOUND", fmt.Sprintf("Principal '%s' not found", req.ActorID))
			return
		}
		s.Store.CurrentActor = p
		s.Store.Unlock()

		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        p.TenantID,
			ProjectID:       p.ActiveProjectID,
			ActorID:         p.ActorID,
			ActorName:       p.ActorName,
			ActorRole:       p.Role,
			EventType:       "CONFIG_UPDATED",
			TargetResource:  "Identity/ActivePrincipal",
			Summary:         fmt.Sprintf("Switched active security context to %s (%s)", p.ActorName, p.Role),
			PayloadRedacted: map[string]interface{}{"actor_id": p.ActorID, "role": p.Role},
			Status:          "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": p})
	})

	s.Mux.HandleFunc("POST /api/v1/auth/oidc/verify", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			IDToken  string `json:"id_token"`
			Env      string `json:"env"`
			Provider string `json:"provider"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)

		if err := s.Policy.ValidateOIDCExchange(req.Env, req.Provider); err != nil {
			actor := s.currentActor(r)
			actorID, actorName, actorRole, tenantID, projID := "system", "Security Guard", "SYSTEM", "tenant_acme_corp", "proj_infra_ops"
			if actor != nil {
				actorID, actorName, actorRole, tenantID, projID = actor.ActorID, actor.ActorName, actor.Role, actor.TenantID, actor.ActiveProjectID
			}
			s.Store.RecordAudit(&models.AuditEvent{
				TenantID:        tenantID,
				ProjectID:       projID,
				ActorID:         actorID,
				ActorName:       actorName,
				ActorRole:       actorRole,
				EventType:       "POLICY_EVALUATION",
				TargetResource:  "Auth/OIDCVerifier",
				Summary:         err.Error(),
				PayloadRedacted: map[string]interface{}{"env": req.Env, "provider": req.Provider},
				Status:          "BLOCKED",
			})
			writeAPIError(w, http.StatusForbidden, "OIDC_CONFIG_INVALID", err.Error())
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"valid":   true,
			"claims": map[string]interface{}{
				"sub":   "usr_elena_admin",
				"email": "elena@acme.corp",
				"name":  "Elena Rostova",
				"role":  "PLATFORM_ADMIN",
				"iss":   "https://idp.enterprise.internal",
				"aud":   "ai-agent-studio",
				"exp":   time.Now().Add(12 * time.Hour).Unix(),
			},
		})
	})

	s.Mux.HandleFunc("GET /api/v1/tenants", func(w http.ResponseWriter, r *http.Request) {
		s.Store.RLock()
		list := make([]*models.TenantInfo, 0, len(s.Store.Tenants))
		for _, t := range s.Store.Tenants {
			list = append(list, t)
		}
		s.Store.RUnlock()
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": list})
	})

	s.Mux.HandleFunc("PUT /api/v1/tenants/{id}/quota", func(w http.ResponseWriter, r *http.Request) {
		actor, ok := s.authorize(w, r, "Tenant/"+r.PathValue("id"), "QUOTA_MANAGE", "USER_MANAGE")
		if !ok {
			return
		}
		id := r.PathValue("id")
		var req struct {
			MaxConcurrentRuns      int     `json:"max_concurrent_runs"`
			MonthlyBudgetUSD       float64 `json:"monthly_budget_usd"`
			QuotaMaxConcurrentRuns int     `json:"quota_max_concurrent_runs"`
			QuotaMonthlyBudgetUSD  float64 `json:"quota_monthly_budget_usd"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		s.Store.Lock()
		tenant, exists := s.Store.Tenants[id]
		if !exists {
			s.Store.Unlock()
			writeError(w, http.StatusNotFound, "Tenant not found")
			return
		}
		maxRuns := req.MaxConcurrentRuns
		if maxRuns <= 0 {
			maxRuns = req.QuotaMaxConcurrentRuns
		}
		monthly := req.MonthlyBudgetUSD
		if monthly <= 0 {
			monthly = req.QuotaMonthlyBudgetUSD
		}
		if maxRuns > 0 {
			tenant.Quota.MaxConcurrentRuns = maxRuns
			tenant.QuotaMaxConcurrentRuns = maxRuns
		}
		if monthly > 0 {
			tenant.Quota.MonthlyBudgetUSD = monthly
			tenant.QuotaMonthlyBudgetUSD = monthly
		}
		s.Store.Unlock()

		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:       actor.TenantID,
			ProjectID:      actor.ActiveProjectID,
			ActorID:        actor.ActorID,
			ActorName:      actor.ActorName,
			ActorRole:      actor.Role,
			EventType:      "CONFIG_UPDATED",
			TargetResource: "Tenant/" + id,
			Summary:        fmt.Sprintf("Updated tenant quotas (max_runs=%d, budget=$%.2f)", tenant.Quota.MaxConcurrentRuns, tenant.Quota.MonthlyBudgetUSD),
			Status:         "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": tenant})
	})

	s.Mux.HandleFunc("GET /api/v1/projects", func(w http.ResponseWriter, r *http.Request) {
		s.Store.RLock()
		list := make([]*models.ProjectInfo, 0, len(s.Store.Projects))
		for _, p := range s.Store.Projects {
			list = append(list, p)
		}
		s.Store.RUnlock()
		sort.Slice(list, func(i, j int) bool { return list[i].ID < list[j].ID })
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": list})
	})

	s.Mux.HandleFunc("POST /api/v1/projects", func(w http.ResponseWriter, r *http.Request) {
		actor, ok := s.authorize(w, r, "Project/Create", "PROJECT_MANAGE")
		if !ok {
			return
		}
		var p models.ProjectInfo
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}
		p.ID = fmt.Sprintf("proj_%d", time.Now().UnixMilli())
		p.TenantID = actor.TenantID
		p.CreatedAt = time.Now()
		s.Store.Lock()
		s.Store.Projects[p.ID] = &p
		s.Store.Unlock()
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": p})
	})

	s.Mux.HandleFunc("GET /api/v1/members", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Store.ListMembersSorted()})
	})

	inviteHandler := func(w http.ResponseWriter, r *http.Request) {
		actor, ok := s.authorize(w, r, "Member/Invite", "USER_MANAGE")
		if !ok {
			return
		}
		var req struct {
			Name       string   `json:"name"`
			Email      string   `json:"email"`
			Role       string   `json:"role"`
			ProjectIDs []string `json:"project_ids"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}
		if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Email) == "" {
			writeError(w, http.StatusBadRequest, "name and email are required")
			return
		}
		if req.Role == "" {
			req.Role = "APP_DEVELOPER"
		}
		grants := policy.GrantsForRole(req.Role)
		if len(grants) == 0 {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Unsupported role '%s'", req.Role))
			return
		}
		if len(req.ProjectIDs) == 0 {
			req.ProjectIDs = []string{actor.ActiveProjectID}
		}

		now := time.Now()
		id := fmt.Sprintf("usr_%d", now.UnixMilli())
		member := &models.UserMember{
			ID:         id,
			TenantID:   actor.TenantID,
			Email:      req.Email,
			Name:       req.Name,
			Role:       req.Role,
			ProjectIDs: req.ProjectIDs,
			Grants:     grants,
			Status:     "ACTIVE",
			InvitedBy:  actor.ActorName,
			CreatedAt:  now,
		}
		principal := &models.Principal{
			ActorID:         id,
			ActorName:       req.Name,
			ActorType:       "USER",
			TenantID:        actor.TenantID,
			TenantName:      actor.TenantName,
			ProjectIDs:      req.ProjectIDs,
			ActiveProjectID: req.ProjectIDs[0],
			Role:            req.Role,
			Grants:          grants,
			Permissions:     grants,
			AuthContext: models.AuthContext{
				AuthenticatedAt: now.UTC().Format(time.RFC3339),
				AuthMethod:      "OIDC_MOCK",
				IPAddress:       "10.240.10.25",
				SessionID:       "sess_" + id,
			},
		}
		rb := &models.RoleBinding{
			ID:         "rb_" + id,
			UserID:     id,
			TenantID:   actor.TenantID,
			ProjectID:  req.ProjectIDs[0],
			Role:       req.Role,
			Grants:     grants,
			AssignedAt: now.UTC().Format(time.RFC3339),
			AssignedBy: actor.ActorName,
			IsActive:   true,
		}

		s.Store.Lock()
		s.Store.Members[id] = member
		s.Store.Principals[id] = principal
		s.Store.RoleBindings[rb.ID] = rb
		s.Store.Unlock()

		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "CONFIG_UPDATED",
			TargetResource:  "Member/" + id,
			Summary:         fmt.Sprintf("Invited member %s (%s) with role %s", req.Name, req.Email, req.Role),
			PayloadRedacted: map[string]interface{}{"member_id": id, "role": req.Role, "project_ids": req.ProjectIDs},
			Status:          "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": member})
	}

	s.Mux.HandleFunc("POST /api/v1/members/invite", inviteHandler)
	s.Mux.HandleFunc("POST /api/v1/members", inviteHandler)

	s.Mux.HandleFunc("POST /api/v1/members/{id}/revoke", func(w http.ResponseWriter, r *http.Request) {
		actor, ok := s.authorize(w, r, "Member/"+r.PathValue("id"), "USER_MANAGE")
		if !ok {
			return
		}
		id := r.PathValue("id")
		if id == actor.ActorID {
			writeAPIError(w, http.StatusBadRequest, "SELF_REVOKE_DENIED", "Administrator cannot revoke their own active session role")
			return
		}

		nowISO := time.Now().UTC().Format(time.RFC3339)
		s.Store.Lock()
		member, exists := s.Store.Members[id]
		if !exists {
			s.Store.Unlock()
			writeError(w, http.StatusNotFound, "Member not found")
			return
		}
		member.Status = "REVOKED"
		if p, ok := s.Store.Principals[id]; ok {
			p.Grants = []string{}
			p.Permissions = []string{}
		}
		for _, rb := range s.Store.RoleBindings {
			if rb.UserID == id {
				rb.IsActive = false
				rb.RevokedAt = nowISO
				rb.RevokedBy = actor.ActorName
			}
		}
		s.Store.Unlock()

		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "CONFIG_UPDATED",
			TargetResource:  "Member/" + id,
			Summary:         fmt.Sprintf("Revoked role binding for %s (%s)", member.Name, member.Role),
			PayloadRedacted: map[string]interface{}{"revoked_user": id, "revoked_at": nowISO},
			Status:          "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": member})
	})

	// -------------------------------------------------------------
	// 3. TOOLS, MCP & METRICS
	// -------------------------------------------------------------
	s.Mux.HandleFunc("GET /api/v1/tools", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.listAllTools()})
	})

	s.Mux.HandleFunc("POST /api/v1/tools/{id}/toggle", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Tool/"+id, "TOOL_KILL_SWITCH", "CONNECTOR_ADMIN", "CONNECTOR_MANAGE")
		if !ok {
			return
		}

		s.Store.Lock()
		t, exists := s.Store.Tools[id]
		if exists {
			t.IsActive = !t.IsActive
			tCopy := *t
			s.Store.Unlock()

			s.Store.RecordAudit(&models.AuditEvent{
				TenantID:        actor.TenantID,
				ProjectID:       actor.ActiveProjectID,
				ActorID:         actor.ActorID,
				ActorName:       actor.ActorName,
				ActorRole:       actor.Role,
				EventType:       "EMERGENCY_TOOL_DISABLE",
				TargetResource:  "Tool/" + id,
				Summary:         fmt.Sprintf("Toggled tool '%s' kill-switch -> active=%v", id, tCopy.IsActive),
				PayloadRedacted: map[string]interface{}{"tool_id": id, "is_active": tCopy.IsActive},
				Status:          "SUCCESS",
			})
			writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": tCopy})
			return
		}
		s.Store.Unlock()
		writeError(w, http.StatusNotFound, "Tool not found")
	})

	s.Mux.HandleFunc("POST /api/v1/tools/{id}/test", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Tool/"+id, "RUN_EXECUTE", "TOOL_READ", "TOOL_CALC")
		if !ok {
			return
		}

		tool, found := s.findTool(id)
		if !found {
			writeError(w, http.StatusNotFound, "Tool not found")
			return
		}

		var req struct {
			Args map[string]interface{} `json:"args"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Args == nil {
			req.Args = map[string]interface{}{}
		}

		dec := s.Policy.EvaluateToolCall(actor, nil, tool, req.Args)
		if !dec.Allowed {
			s.Store.RecordAudit(&models.AuditEvent{
				TenantID:        actor.TenantID,
				ProjectID:       actor.ActiveProjectID,
				ActorID:         actor.ActorID,
				ActorName:       actor.ActorName,
				ActorRole:       actor.Role,
				EventType:       "POLICY_EVALUATION",
				TargetResource:  "Tool/" + id,
				Summary:         dec.Reason,
				PayloadRedacted: req.Args,
				Status:          "BLOCKED",
			})
			writeAPIError(w, http.StatusForbidden, "POLICY_DENIED", dec.Reason)
			return
		}

		start := time.Now()
		var out interface{}
		switch id {
		case "fake_calculator":
			aVal, _ := req.Args["a"].(float64)
			bVal, _ := req.Args["b"].(float64)
			op, _ := req.Args["operation"].(string)
			resNum := aVal + bVal
			switch op {
			case "subtract":
				resNum = aVal - bVal
			case "multiply":
				resNum = aVal * bVal
			case "divide":
				if bVal != 0 {
					resNum = aVal / bVal
				}
			}
			out = map[string]interface{}{"operation": op, "a": aVal, "b": bVal, "result": resNum}
		case "weather_current":
			city, _ := req.Args["city"].(string)
			units, _ := req.Args["units"].(string)
			out = connectors.QueryWeather(city, units)
		case "fake_db_query":
			out = map[string]interface{}{
				"rows": []map[string]interface{}{
					{"host": "bmh-master-k8s-01", "role": "control-plane", "status": "ActiveInCluster"},
					{"host": "bmh-worker-k8s-01", "role": "worker-gpu", "status": "ActiveInCluster"},
				},
				"count": 2,
			}
		default:
			out = map[string]interface{}{
				"tool_id":          id,
				"policy_decision":  dec.Decision,
				"required_approval": dec.RequiresApproval,
				"plan_hash":        dec.RequiredPlanHash,
				"sanitized_args":   policy.SanitizePayload(req.Args),
				"executed_in_go":   true,
			}
		}

		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "TOOL_INVOKED",
			TargetResource:  "Tool/" + id,
			Summary:         fmt.Sprintf("Executed sandbox tool test for %s (%s)", tool.Name, dec.Decision),
			PayloadRedacted: req.Args,
			Status:          "SUCCESS",
		})

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":         true,
			"tool_id":         id,
			"policy_decision": dec,
			"output":          out,
			"status":          "COMPLETED",
			"duration":        time.Since(start).Milliseconds() + 4,
		})
	})

	s.Mux.HandleFunc("GET /api/v1/mcp/servers", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"data": []map[string]interface{}{
				{"id": "mcp_ironic_redfish", "name": "Ironic Redfish Out-of-Band BMC MCP", "status": "CONNECTED", "tools_count": 8, "protocol": "json-rpc-2.0", "transport": "stdio"},
				{"id": "mcp_k8s_cluster_api", "name": "Cluster API Provider Metal3 (CAPM3) MCP", "status": "CONNECTED", "tools_count": 12, "protocol": "json-rpc-2.0", "transport": "stdio"},
			},
		})
	})

	s.Mux.HandleFunc("GET /api/v1/metrics", func(w http.ResponseWriter, r *http.Request) {
		s.Store.RLock()
		totalRuns := len(s.Store.Runs)
		succeeded := 0
		totalTokens := 0
		totalCost := 0.0
		for _, run := range s.Store.Runs {
			if run.State == "SUCCEEDED" {
				succeeded++
			}
			totalTokens += run.TotalTokens
			totalCost += run.TotalCostUSD
		}
		pendingApprovals := 0
		for _, a := range s.Store.Approvals {
			if a.Status == "PENDING" {
				pendingApprovals++
			}
		}
		s.Store.RUnlock()

		successRate := 100
		if totalRuns > 0 {
			successRate = int((float64(succeeded) / float64(totalRuns)) * 100)
		}

		payload := map[string]interface{}{
			"total_runs":              totalRuns,
			"success_rate_percent":    successRate,
			"active_approval_backlog": pendingApprovals,
			"total_tokens_consumed":   totalTokens,
			"total_cost_usd":          totalCost,
			"p95_latency_ms":          48,
			"active_hosts":            len(s.Metal3.ListHosts()),
			"active_clusters":         len(s.Metal3.ListClusters()),
			"registered_plugins":      len(s.Connectors.ListPlugins()),
			"pending_approvals":       pendingApprovals,
			"uptime_seconds":          time.Since(s.Store.StartTime).Seconds(),
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    payload,
			"metrics": payload,
		})
	})

	// -------------------------------------------------------------
	// 4. MODELS & AGENTS
	// -------------------------------------------------------------
	s.Mux.HandleFunc("GET /api/v1/models", func(w http.ResponseWriter, r *http.Request) {
		s.Store.RLock()
		list := make([]*models.ModelConfig, 0, len(s.Store.Models))
		for _, m := range s.Store.Models {
			list = append(list, m)
		}
		s.Store.RUnlock()
		sort.Slice(list, func(i, j int) bool { return list[i].ID < list[j].ID })
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": list})
	})

	s.Mux.HandleFunc("GET /api/v1/agents", func(w http.ResponseWriter, r *http.Request) {
		s.Store.RLock()
		list := make([]*models.AgentDefinition, 0, len(s.Store.Agents))
		for _, a := range s.Store.Agents {
			list = append(list, a)
		}
		s.Store.RUnlock()
		sort.Slice(list, func(i, j int) bool { return list[i].CreatedAt.Before(list[j].CreatedAt) })
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": list})
	})

	s.Mux.HandleFunc("POST /api/v1/agents", func(w http.ResponseWriter, r *http.Request) {
		actor, ok := s.authorize(w, r, "Agent/Create", "AGENT_CREATE", "AGENT_DRAFT")
		if !ok {
			return
		}
		var req struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			Description string `json:"description"`
			ModelID     string `json:"model_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}
		now := time.Now()
		id := req.ID
		if id == "" {
			id = fmt.Sprintf("agt_%d", now.UnixMilli())
		}
		modelID := req.ModelID
		if modelID == "" {
			modelID = "fake_fast_model"
		}
		draft := models.AgentDraft{
			SystemPrompt:   "You are an autonomous zero-trust enterprise agent.",
			ModelID:        modelID,
			Temperature:    0.1,
			MaxSteps:       5,
			TimeoutSeconds: 60,
			BudgetLimitUSD: 1.0,
			ToolWhitelist:  []string{"fake_calculator", "fake_db_query"},
			OutputSchema:   map[string]interface{}{"type": "object"},
			MemoryMode:     "BUFFER_WINDOW",
		}
		agent := &models.AgentDefinition{
			ID:                id,
			TenantID:          actor.TenantID,
			ProjectID:         actor.ActiveProjectID,
			Name:              req.Name,
			Version:           "v0.1.0-draft",
			Description:       req.Description,
			CurrentDraft:      draft,
			PublishedVersions: []models.PublishedAgentVersion{},
			SystemPrompt:      draft.SystemPrompt,
			ModelID:           modelID,
			ToolIDs:           draft.ToolWhitelist,
			Status:            "DRAFT",
			Author:            actor.ActorName,
			CreatedAt:         now,
			UpdatedAt:         now,
		}
		s.Store.Lock()
		s.Store.Agents[id] = agent
		s.Store.Unlock()
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": agent})
	})

	s.Mux.HandleFunc("PUT /api/v1/agents/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Agent/"+id, "AGENT_DRAFT", "AGENT_CREATE")
		if !ok {
			return
		}
		var req struct {
			Name         string             `json:"name"`
			Description  string             `json:"description"`
			CurrentDraft *models.AgentDraft `json:"current_draft"`
			SystemPrompt string             `json:"system_prompt"`
			ModelID      string             `json:"model_id"`
			ToolIDs      []string           `json:"tool_ids"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		s.Store.Lock()
		agent, exists := s.Store.Agents[id]
		if !exists {
			s.Store.Unlock()
			writeError(w, http.StatusNotFound, "Agent not found")
			return
		}
		if err := s.Policy.VerifyTenantBoundary(actor, agent.TenantID); err != nil {
			s.Store.Unlock()
			writeAPIError(w, http.StatusForbidden, "CROSS_TENANT_ACCESS_DENIED", err.Error())
			return
		}
		if req.Name != "" {
			agent.Name = req.Name
		}
		if req.Description != "" {
			agent.Description = req.Description
		}
		if req.CurrentDraft != nil {
			if req.CurrentDraft.SystemPrompt != "" {
				agent.CurrentDraft.SystemPrompt = req.CurrentDraft.SystemPrompt
				agent.SystemPrompt = req.CurrentDraft.SystemPrompt
			}
			if req.CurrentDraft.ModelID != "" {
				agent.CurrentDraft.ModelID = req.CurrentDraft.ModelID
				agent.ModelID = req.CurrentDraft.ModelID
			}
			if req.CurrentDraft.MaxSteps > 0 {
				agent.CurrentDraft.MaxSteps = req.CurrentDraft.MaxSteps
			}
			if req.CurrentDraft.BudgetLimitUSD > 0 {
				agent.CurrentDraft.BudgetLimitUSD = req.CurrentDraft.BudgetLimitUSD
			}
			if req.CurrentDraft.ToolWhitelist != nil {
				agent.CurrentDraft.ToolWhitelist = req.CurrentDraft.ToolWhitelist
				agent.ToolIDs = req.CurrentDraft.ToolWhitelist
			}
		} else {
			if req.SystemPrompt != "" {
				agent.CurrentDraft.SystemPrompt = req.SystemPrompt
				agent.SystemPrompt = req.SystemPrompt
			}
			if req.ModelID != "" {
				agent.CurrentDraft.ModelID = req.ModelID
				agent.ModelID = req.ModelID
			}
			if req.ToolIDs != nil {
				agent.CurrentDraft.ToolWhitelist = req.ToolIDs
				agent.ToolIDs = req.ToolIDs
			}
		}
		agent.UpdatedAt = time.Now()
		s.Store.Unlock()

		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": agent})
	})

	s.Mux.HandleFunc("POST /api/v1/agents/{id}/publish", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Agent/"+id, "AGENT_PUBLISH", "AGENT_DRAFT", "AGENT_CREATE")
		if !ok {
			return
		}

		s.Store.Lock()
		agent, exists := s.Store.Agents[id]
		if !exists {
			s.Store.Unlock()
			writeError(w, http.StatusNotFound, "Agent not found")
			return
		}
		nextVer := fmt.Sprintf("v1.%d.0", len(agent.PublishedVersions))
		if len(agent.PublishedVersions) == 0 {
			nextVer = "v1.0.0"
		}
		toolVers := make(map[string]string)
		for _, tid := range agent.CurrentDraft.ToolWhitelist {
			toolVers[tid] = "1.0.0"
		}
		now := time.Now()
		snapHash := s.Policy.ComputePlanHash(map[string]interface{}{
			"agent_id":       agent.ID,
			"version":        nextVer,
			"system_prompt":  agent.CurrentDraft.SystemPrompt,
			"tool_whitelist": agent.CurrentDraft.ToolWhitelist,
		})
		snap := models.RunSnapshot{
			DefinitionID:      agent.ID,
			DefinitionVersion: nextVer,
			DefinitionName:    agent.Name,
			ModelID:           agent.CurrentDraft.ModelID,
			ModelVersion:      agent.CurrentDraft.ModelID,
			ToolVersions:      toolVers,
			SkillVersions:     map[string]string{},
			PolicyVersion:     policy.PolicyVersion,
			CreatedAt:         now.UTC().Format(time.RFC3339),
			SnapshotHash:      snapHash,
		}
		pub := models.PublishedAgentVersion{
			Version:       nextVer,
			PublishedAt:   now.UTC().Format(time.RFC3339),
			PublishedBy:   actor.ActorName,
			Snapshot:      snap,
			SystemPrompt:  agent.CurrentDraft.SystemPrompt,
			ToolWhitelist: append([]string{}, agent.CurrentDraft.ToolWhitelist...),
		}
		agent.PublishedVersions = append([]models.PublishedAgentVersion{pub}, agent.PublishedVersions...)
		agent.ActiveVersion = nextVer
		agent.Version = nextVer
		agent.Status = "PUBLISHED"
		agent.UpdatedAt = now
		s.Store.Unlock()

		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "AGENT_PUBLISHED",
			TargetResource:  "Agent/" + id,
			Summary:         fmt.Sprintf("Published immutable Agent release %s (hash=%s)", nextVer, snapHash[:16]),
			PayloadRedacted: map[string]interface{}{"version": nextVer, "snapshot_hash": snapHash},
			Status:          "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": agent})
	})

	s.Mux.HandleFunc("POST /api/v1/agents/{id}/run", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Agent/"+id, "RUN_EXECUTE")
		if !ok {
			return
		}

		var req struct {
			InputQuery string `json:"input_query"`
			Prompt     string `json:"prompt"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		query := strings.TrimSpace(req.InputQuery)
		if query == "" {
			query = strings.TrimSpace(req.Prompt)
		}
		if query == "" {
			query = "Check cluster health and headroom"
		}

		s.Store.RLock()
		agent, exists := s.Store.Agents[id]
		tenant := s.Store.Tenants[actor.TenantID]
		activeCount := s.Store.ActiveRunCountUnsafe(actor.TenantID)
		s.Store.RUnlock()

		if !exists {
			writeError(w, http.StatusNotFound, "Agent not found")
			return
		}
		if err := s.Policy.VerifyTenantBoundary(actor, agent.TenantID); err != nil {
			writeAPIError(w, http.StatusForbidden, "CROSS_TENANT_ACCESS_DENIED", err.Error())
			return
		}
		if err := s.Policy.VerifyProjectBoundary(actor, agent.ProjectID); err != nil {
			writeAPIError(w, http.StatusForbidden, "PROJECT_ACCESS_DENIED", err.Error())
			return
		}
		if len(agent.PublishedVersions) == 0 {
			writeAPIError(w, http.StatusBadRequest, "UNPUBLISHED_AGENT", "Agent must be published before execution")
			return
		}

		if allowed, code, reason := s.Policy.CheckTenantQuota(tenant, activeCount, 0.002); !allowed {
			writeAPIError(w, http.StatusTooManyRequests, code, reason)
			return
		}

		now := time.Now()
		runID := fmt.Sprintf("run_%d", now.UnixMilli())
		traceID := fmt.Sprintf("tr_%d", now.UnixNano())
		pub := agent.PublishedVersions[0]
		whitelist := pub.ToolWhitelist
		if len(whitelist) == 0 {
			whitelist = agent.CurrentDraft.ToolWhitelist
		}

		lowerQ := strings.ToLower(query)
		triggerHighRisk := strings.Contains(lowerQ, "deploy") ||
			strings.Contains(lowerQ, "rollout") ||
			strings.Contains(lowerQ, "prod") ||
			strings.Contains(lowerQ, "power") ||
			strings.Contains(lowerQ, "reboot") ||
			strings.Contains(lowerQ, "cordon") ||
			strings.Contains(lowerQ, "drain")

		// Pick tools matching intent
		selectedToolIDs := make([]string, 0)
		for _, tid := range whitelist {
			toolObj, ok := s.findTool(tid)
			if !ok {
				continue
			}
			isHigh := toolObj.Risk == "HIGH" || toolObj.Risk == "CRITICAL"
			if triggerHighRisk && isHigh {
				selectedToolIDs = append(selectedToolIDs, tid)
			} else if !triggerHighRisk && !isHigh {
				selectedToolIDs = append(selectedToolIDs, tid)
			}
		}
		if len(selectedToolIDs) == 0 && len(whitelist) > 0 {
			selectedToolIDs = append(selectedToolIDs, whitelist[0])
		}

		steps := []models.StepRun{
			{
				ID:         "step_llm_plan",
				RunID:      runID,
				StepID:     "step_llm_plan",
				StepName:   "LLM Intent & Policy Planning",
				NodeName:   "LLM Intent & Policy Planning",
				NodeType:   "LLM",
				State:      "SUCCEEDED",
				Status:     "COMPLETED",
				Input:      map[string]interface{}{"query": query},
				Output:     map[string]interface{}{"planned_tools": selectedToolIDs, "model": pub.Snapshot.ModelID},
				DurationMs: 18,
				TokenUsage: &models.TokenUsage{PromptTokens: 96, CompletionTokens: 48, TotalTokens: 144, EstimatedCostUSD: 0.0004},
			},
		}

		totalTokens := 144
		totalCost := 0.0004
		runState := "SUCCEEDED"
		runStatus := "COMPLETED"
		finalSummary := fmt.Sprintf("[Go Zero-Trust Runtime] Agent '%s' (%s) executed cleanly via %d verified steps.", agent.Name, pub.Version, len(selectedToolIDs)+1)
		errMsg := ""
		var pendingApproval *models.ApprovalRecord

		for idx, tid := range selectedToolIDs {
			toolObj, ok := s.findTool(tid)
			if !ok {
				continue
			}
			args := map[string]interface{}{
				"query":         query,
				"cluster":       "prod-us-east-1",
				"manifest_name": "workload-release-v3",
				"replicas":      3,
			}
			dec := s.Policy.EvaluateToolCall(actor, agent, toolObj, args)
			stepID := fmt.Sprintf("step_tool_%d", idx+1)
			polDec := &models.PolicyEvaluationDecision{
				Decision:         dec.Decision,
				Reason:           dec.Reason,
				PolicyVersion:    dec.PolicyVersion,
				RiskLevel:        dec.RiskLevel,
				RequiredPlanHash: dec.RequiredPlanHash,
				MissingGrants:    dec.MissingGrants,
				EffectiveGrants:  dec.EffectiveGrants,
			}

			if !dec.Allowed {
				steps = append(steps, models.StepRun{
					ID:             stepID,
					RunID:          runID,
					StepID:         stepID,
					StepName:       fmt.Sprintf("Tool: %s", toolObj.Name),
					NodeName:       toolObj.Name,
					NodeType:       "TOOL",
					State:          "FAILED",
					Status:         "FAILED",
					Input:          args,
					Error:          dec.Reason,
					PolicyDecision: polDec,
					DurationMs:     4,
				})
				runState = "FAILED"
				runStatus = "FAILED"
				errMsg = dec.Reason
				finalSummary = "Execution blocked by zero-trust four-way permission intersection: " + dec.Reason
				break
			}

			if dec.RequiresApproval {
				apprID := fmt.Sprintf("appr_%d", now.UnixMilli())
				pendingApproval = &models.ApprovalRecord{
					ID:          apprID,
					RunID:       runID,
					StepID:      stepID,
					TargetName:  agent.Name,
					TenantID:    agent.TenantID,
					ProjectID:   agent.ProjectID,
					ToolID:      toolObj.ID,
					ToolName:    toolObj.Name,
					RiskLevel:   toolObj.Risk,
					ArgsSummary: args,
					RawPayload:  map[string]interface{}{"tool_id": toolObj.ID, "args": args},
					PlanHash:    dec.RequiredPlanHash,
					Status:      "PENDING",
					RequestedAt: now.UTC().Format(time.RFC3339),
					RequestedBy: actor.ActorName,
					ExpiresAt:   now.Add(24 * time.Hour).UTC().Format(time.RFC3339),
					CreatedAt:   now,
				}
				steps = append(steps, models.StepRun{
					ID:             stepID,
					RunID:          runID,
					StepID:         stepID,
					StepName:       fmt.Sprintf("%s (Human Approval Gate)", toolObj.Name),
					NodeName:       toolObj.Name,
					NodeType:       "TOOL",
					State:          "WAITING_APPROVAL",
					Status:         "WAITING_APPROVAL",
					Input:          args,
					Output:         map[string]interface{}{"approval_id": apprID, "plan_hash": dec.RequiredPlanHash},
					PolicyDecision: polDec,
					ApprovalID:     apprID,
					DurationMs:     12,
					TokenUsage:     &models.TokenUsage{PromptTokens: 40, CompletionTokens: 20, TotalTokens: 60, EstimatedCostUSD: 0.0002},
				})
				totalTokens += 60
				totalCost += 0.0002
				runState = "WAITING_APPROVAL"
				runStatus = "PAUSED_FOR_APPROVAL"
				finalSummary = fmt.Sprintf("Execution paused at step '%s': awaiting human governance approval (%s, plan_hash=%s...).", toolObj.Name, apprID, dec.RequiredPlanHash[:12])
				break
			}

			steps = append(steps, models.StepRun{
				ID:             stepID,
				RunID:          runID,
				StepID:         stepID,
				StepName:       fmt.Sprintf("Tool: %s", toolObj.Name),
				NodeName:       toolObj.Name,
				NodeType:       "TOOL",
				State:          "SUCCEEDED",
				Status:         "COMPLETED",
				Input:          args,
				Output:         map[string]interface{}{"result": "VERIFIED_NOMINAL", "tool": toolObj.ID, "nodes_healthy": 15},
				PolicyDecision: polDec,
				DurationMs:     22,
				TokenUsage:     &models.TokenUsage{PromptTokens: 45, CompletionTokens: 35, TotalTokens: 80, EstimatedCostUSD: 0.0002},
			})
			totalTokens += 80
			totalCost += 0.0002
		}

		run := &models.ExecutionRun{
			ID:            runID,
			TargetType:    "AGENT",
			TargetID:      agent.ID,
			TargetVersion: pub.Version,
			TargetName:    agent.Name,
			TenantID:      agent.TenantID,
			ProjectID:     agent.ProjectID,
			TraceID:       traceID,
			State:         runState,
			Status:        runStatus,
			InputData:     map[string]interface{}{"input_query": query},
			InputQuery:    query,
			FinalOutput:   map[string]interface{}{"summary": finalSummary},
			OutputResult:  finalSummary,
			ErrorMessage:  errMsg,
			Initiator:     *actor,
			InitiatedBy:   actor.ActorName,
			Snapshot:      pub.Snapshot,
			Steps:         steps,
			TotalTokens:   totalTokens,
			TotalCostUSD:  totalCost,
			DurationMs:    44,
			StartedAt:     now.UTC().Format(time.RFC3339),
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if runState == "SUCCEEDED" {
			run.CompletedAt = time.Now().UTC().Format(time.RFC3339)
		}

		s.Store.Lock()
		s.Store.AddRunLocked(run)
		if pendingApproval != nil {
			s.Store.Approvals[pendingApproval.ID] = pendingApproval
		}
		s.Store.Unlock()

		evType := "RUN_CREATED"
		auditStatus := "SUCCESS"
		if pendingApproval != nil {
			evType = "APPROVAL_REQUESTED"
		} else if runState == "FAILED" {
			evType = "POLICY_EVALUATION"
			auditStatus = "BLOCKED"
		}
		s.Store.RecordAudit(&models.AuditEvent{
			TraceID:         traceID,
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       evType,
			TargetResource:  "Agent/" + agent.ID,
			Summary:         finalSummary,
			PayloadRedacted: map[string]interface{}{"run_id": runID, "state": runState, "input_query": query},
			Status:          auditStatus,
		})

		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": run})
	})

	// -------------------------------------------------------------
	// 5. WORKFLOWS & DAG
	// -------------------------------------------------------------
	s.Mux.HandleFunc("GET /api/v1/workflows", func(w http.ResponseWriter, r *http.Request) {
		s.Store.RLock()
		list := make([]*models.WorkflowDefinition, 0, len(s.Store.Workflows))
		for _, wf := range s.Store.Workflows {
			list = append(list, wf)
		}
		s.Store.RUnlock()
		sort.Slice(list, func(i, j int) bool { return list[i].CreatedAt.Before(list[j].CreatedAt) })
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": list})
	})

	s.Mux.HandleFunc("POST /api/v1/workflows", func(w http.ResponseWriter, r *http.Request) {
		actor, ok := s.authorize(w, r, "Workflow/Create", "WORKFLOW_DRAFT", "AGENT_CREATE")
		if !ok {
			return
		}
		var wf models.WorkflowDefinition
		if err := json.NewDecoder(r.Body).Decode(&wf); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}
		now := time.Now()
		if wf.ID == "" {
			wf.ID = fmt.Sprintf("wf_%d", now.UnixMilli())
		}
		wf.TenantID = actor.TenantID
		if wf.ProjectID == "" {
			wf.ProjectID = actor.ActiveProjectID
		}
		wf.Status = "DRAFT"
		wf.Author = actor.ActorName
		wf.CreatedAt = now
		wf.UpdatedAt = now
		s.Store.Lock()
		s.Store.Workflows[wf.ID] = &wf
		s.Store.Unlock()
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": wf})
	})

	s.Mux.HandleFunc("POST /api/v1/workflows/validate", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Nodes []map[string]interface{} `json:"nodes"`
			Edges []map[string]string      `json:"edges"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}
		res := dag.ValidateDAG(req.Nodes, req.Edges)
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":          true,
			"data":             res,
			"is_valid":         res.IsValid,
			"valid":            res.Valid,
			"acyclic":          res.Acyclic,
			"execution_layers": res.ExecutionLayers,
			"execution_order":  res.Order,
			"errors":           res.Errors,
		})
	})

	s.Mux.HandleFunc("POST /api/v1/workflows/{id}/validate", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		s.Store.RLock()
		wf, ok := s.Store.Workflows[id]
		s.Store.RUnlock()
		if !ok {
			writeError(w, http.StatusNotFound, "Workflow not found")
			return
		}
		res := dag.ValidateWorkflowDAG(wf.CurrentDraft.Nodes, wf.CurrentDraft.Edges)
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    res,
		})
	})

	s.Mux.HandleFunc("POST /api/v1/workflows/{id}/publish", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Workflow/"+id, "WORKFLOW_DRAFT", "AGENT_PUBLISH", "AGENT_CREATE")
		if !ok {
			return
		}

		s.Store.Lock()
		wf, exists := s.Store.Workflows[id]
		if !exists {
			s.Store.Unlock()
			writeError(w, http.StatusNotFound, "Workflow not found")
			return
		}
		valRes := dag.ValidateWorkflowDAG(wf.CurrentDraft.Nodes, wf.CurrentDraft.Edges)
		if !valRes.IsValid {
			s.Store.Unlock()
			writeAPIError(w, http.StatusBadRequest, "DAG_VALIDATION_FAILED", strings.Join(valRes.Errors, "; "))
			return
		}
		nextVer := fmt.Sprintf("v1.%d.0", len(wf.PublishedVersions))
		if len(wf.PublishedVersions) == 0 {
			nextVer = "v1.0.0"
		}
		now := time.Now()
		snap := models.RunSnapshot{
			DefinitionID:      wf.ID,
			DefinitionVersion: nextVer,
			DefinitionName:    wf.Name,
			ModelID:           "fake_fast_model",
			ModelVersion:      "fake-deterministic-v1",
			ToolVersions:      map[string]string{"fake_calculator": "1.0.0"},
			SkillVersions:     map[string]string{},
			PolicyVersion:     policy.PolicyVersion,
			CreatedAt:         now.UTC().Format(time.RFC3339),
			SnapshotHash:      s.Policy.ComputePlanHash(map[string]interface{}{"wf": wf.ID, "version": nextVer}),
		}
		pub := models.PublishedWorkflowVersion{
			Version:     nextVer,
			PublishedAt: now.UTC().Format(time.RFC3339),
			PublishedBy: actor.ActorName,
			Nodes:       wf.CurrentDraft.Nodes,
			Edges:       wf.CurrentDraft.Edges,
			Snapshot:    snap,
		}
		wf.PublishedVersions = append([]models.PublishedWorkflowVersion{pub}, wf.PublishedVersions...)
		wf.ActiveVersion = nextVer
		wf.Version = nextVer
		wf.Status = "PUBLISHED"
		wf.UpdatedAt = now
		s.Store.Unlock()

		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:       actor.TenantID,
			ProjectID:      actor.ActiveProjectID,
			ActorID:        actor.ActorID,
			ActorName:      actor.ActorName,
			ActorRole:      actor.Role,
			EventType:      "WORKFLOW_PUBLISHED",
			TargetResource: "Workflow/" + id,
			Summary:        fmt.Sprintf("Published DAG workflow %s (%s)", wf.Name, nextVer),
			Status:         "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": wf})
	})

	s.Mux.HandleFunc("POST /api/v1/workflows/{id}/run", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Workflow/"+id, "RUN_EXECUTE")
		if !ok {
			return
		}
		s.Store.RLock()
		wf, exists := s.Store.Workflows[id]
		tenant := s.Store.Tenants[actor.TenantID]
		activeCount := s.Store.ActiveRunCountUnsafe(actor.TenantID)
		s.Store.RUnlock()
		if !exists {
			writeError(w, http.StatusNotFound, "Workflow not found")
			return
		}
		if allowed, code, reason := s.Policy.CheckTenantQuota(tenant, activeCount, 0.002); !allowed {
			writeAPIError(w, http.StatusTooManyRequests, code, reason)
			return
		}
		var req struct {
			InputParams map[string]interface{} `json:"input_params"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)

		now := time.Now()
		runID := fmt.Sprintf("run_%d", now.UnixMilli())
		traceID := fmt.Sprintf("tr_%d", now.UnixNano())
		run := &models.ExecutionRun{
			ID:            runID,
			TargetType:    "WORKFLOW",
			TargetID:      wf.ID,
			TargetVersion: wf.Version,
			TargetName:    wf.Name,
			TenantID:      wf.TenantID,
			ProjectID:     wf.ProjectID,
			TraceID:       traceID,
			State:         "SUCCEEDED",
			Status:        "COMPLETED",
			InputData:     req.InputParams,
			InputQuery:    fmt.Sprintf("Executed workflow DAG '%s'", wf.Name),
			FinalOutput:   map[string]interface{}{"summary": fmt.Sprintf("[Go DAG Engine] Workflow '%s' executed %d nodes across verified layers", wf.Name, len(wf.CurrentDraft.Nodes))},
			OutputResult:  fmt.Sprintf("[Go DAG Engine] Workflow '%s' completed %d nodes", wf.Name, len(wf.CurrentDraft.Nodes)),
			Initiator:     *actor,
			InitiatedBy:   actor.ActorName,
			TotalTokens:   256,
			TotalCostUSD:  0.0006,
			DurationMs:    68,
			StartedAt:     now.UTC().Format(time.RFC3339),
			CompletedAt:   now.Add(68 * time.Millisecond).UTC().Format(time.RFC3339),
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		s.Store.Lock()
		s.Store.AddRunLocked(run)
		s.Store.Unlock()
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": run})
	})

	// -------------------------------------------------------------
	// 5. RUNS & HUMAN-IN-THE-LOOP APPROVALS
	// -------------------------------------------------------------
	s.Mux.HandleFunc("GET /api/v1/runs", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Store.ListRunsOrdered()})
	})

	s.Mux.HandleFunc("GET /api/v1/runs/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		s.Store.RLock()
		run, ok := s.Store.Runs[id]
		s.Store.RUnlock()
		if ok {
			writeJSON(w, http.StatusOK, map[string]interface{}{"data": run})
			return
		}
		writeError(w, http.StatusNotFound, "Run not found")
	})

	s.Mux.HandleFunc("POST /api/v1/runs/{id}/cancel", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if _, ok := s.authorize(w, r, "Run/"+id, "RUN_EXECUTE"); !ok {
			return
		}
		s.Store.Lock()
		run, ok := s.Store.Runs[id]
		if ok {
			run.State = "CANCELLED"
			run.Status = "CANCELLED"
			run.UpdatedAt = time.Now()
		}
		s.Store.Unlock()
		if ok {
			writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": run})
			return
		}
		writeError(w, http.StatusNotFound, "Run not found")
	})

	s.Mux.HandleFunc("GET /api/v1/approvals", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Store.ListApprovalsOrdered()})
	})

	s.Mux.HandleFunc("POST /api/v1/approvals/{id}/decide", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Approval/"+id, "APPROVE_HIGH_RISK", "APPROVE_RUNS")
		if !ok {
			return
		}

		var req struct {
			Decision         string                 `json:"decision"` // "APPROVE" | "REJECT"
			Reason           string                 `json:"reason"`
			ExpectedPlanHash string                 `json:"expected_plan_hash"`
			OverrideArgs     map[string]interface{} `json:"args"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		decUpper := strings.ToUpper(strings.TrimSpace(req.Decision))
		if decUpper != "APPROVE" && decUpper != "REJECT" && decUpper != "APPROVED" && decUpper != "REJECTED" {
			writeError(w, http.StatusBadRequest, "decision must be APPROVE or REJECT")
			return
		}

		now := time.Now()
		nowISO := now.UTC().Format(time.RFC3339)

		s.Store.Lock()
		appr, exists := s.Store.Approvals[id]
		if !exists {
			s.Store.Unlock()
			writeError(w, http.StatusNotFound, "Approval record not found")
			return
		}
		if appr.Status != "PENDING" {
			s.Store.Unlock()
			writeAPIError(w, http.StatusBadRequest, "ALREADY_DECIDED", fmt.Sprintf("Approval %s already decided (%s)", id, appr.Status))
			return
		}

		// Cryptographic SHA-256 Plan-Hash anti-tamper check
		verifyPayload := appr.RawPayload
		if req.OverrideArgs != nil {
			verifyPayload = map[string]interface{}{"tool_id": appr.ToolID, "args": req.OverrideArgs}
		}
		if !s.Policy.VerifyPlanHash(appr.PlanHash, verifyPayload) ||
			(req.ExpectedPlanHash != "" && req.ExpectedPlanHash != appr.PlanHash) {
			appr.Status = "REJECTED"
			appr.ReviewedBy = actor.ActorName
			appr.ReviewedAt = nowISO
			appr.DecidedAt = &now
			appr.RejectionReason = "PLAN_HASH_MISMATCH: Payload tampered between proposal and approval execution time"
			if run, ok := s.Store.Runs[appr.RunID]; ok {
				run.State = "FAILED"
				run.Status = "FAILED"
				run.ErrorMessage = appr.RejectionReason
				run.UpdatedAt = now
			}
			s.Store.Unlock()

			s.Store.RecordAudit(&models.AuditEvent{
				TenantID:        actor.TenantID,
				ProjectID:       actor.ActiveProjectID,
				ActorID:         actor.ActorID,
				ActorName:       actor.ActorName,
				ActorRole:       actor.Role,
				EventType:       "APPROVAL_DECIDED",
				TargetResource:  "Approval/" + id,
				Summary:         appr.RejectionReason,
				PayloadRedacted: map[string]interface{}{"plan_hash": appr.PlanHash},
				Status:          "BLOCKED",
			})
			writeAPIError(w, http.StatusConflict, "PLAN_HASH_TAMPERED", appr.RejectionReason)
			return
		}

		if decUpper == "APPROVE" || decUpper == "APPROVED" {
			appr.Status = "APPROVED"
		} else {
			appr.Status = "REJECTED"
		}
		appr.ReviewedBy = actor.ActorName
		appr.ReviewedAt = nowISO
		appr.DecidedAt = &now
		appr.RejectionReason = req.Reason

		// Resume or cancel linked ExecutionRun
		if run, ok := s.Store.Runs[appr.RunID]; ok {
			if appr.Status == "APPROVED" {
				for idx := range run.Steps {
					if run.Steps[idx].ApprovalID == id || run.Steps[idx].State == "WAITING_APPROVAL" {
						run.Steps[idx].State = "SUCCEEDED"
						run.Steps[idx].Status = "COMPLETED"
						run.Steps[idx].Output = map[string]interface{}{
							"approved_by": actor.ActorName,
							"plan_hash":   appr.PlanHash,
							"status":      "PLAN_HASH_VERIFIED_AND_EXECUTED",
						}
					}
				}
				run.State = "SUCCEEDED"
				run.Status = "COMPLETED"
				run.CompletedAt = nowISO
				run.UpdatedAt = now
				run.FinalOutput = map[string]interface{}{
					"summary": fmt.Sprintf("Approved by %s (plan_hash verified: %s...). High-risk tool '%s' completed.", actor.ActorName, appr.PlanHash[:12], appr.ToolName),
				}
				run.OutputResult = run.FinalOutput["summary"].(string)
			} else {
				for idx := range run.Steps {
					if run.Steps[idx].ApprovalID == id || run.Steps[idx].State == "WAITING_APPROVAL" {
						run.Steps[idx].State = "CANCELLED"
						run.Steps[idx].Status = "REJECTED"
						run.Steps[idx].Error = req.Reason
					}
				}
				run.State = "CANCELLED"
				run.Status = "REJECTED"
				run.ErrorMessage = req.Reason
				run.UpdatedAt = now
			}
		}
		s.Store.Unlock()

		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "APPROVAL_DECIDED",
			TargetResource:  "Approval/" + id,
			Summary:         fmt.Sprintf("%s approval %s for tool '%s' (plan_hash verified)", appr.Status, id, appr.ToolID),
			PayloadRedacted: map[string]interface{}{"decision": appr.Status, "plan_hash": appr.PlanHash, "run_id": appr.RunID},
			Status:          "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": appr})
	})

	// -------------------------------------------------------------
	// 6. METAL3, IRONIC FLEET & K8S VERSION CONTROLLER
	// -------------------------------------------------------------
	s.Mux.HandleFunc("GET /api/v1/metal3/status", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, s.Metal3.GetStatus())
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/eph-node", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Metal3.GetStatus()["eph_node"]})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/bmh", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Metal3.ListHosts()})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/bmh/{name}", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		h, err := s.Metal3.GetHost(name)
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": h})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/bmh/{name}/inspect", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		if _, ok := s.authorize(w, r, "BareMetalHost/"+name, "HOST_MANAGE"); !ok {
			return
		}
		h, err := s.Metal3.InspectHost(name)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": h})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/bmh/{name}/power", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		actor, ok := s.authorize(w, r, "BareMetalHost/"+name+"/Power", "HOST_MANAGE")
		if !ok {
			return
		}
		var req struct {
			Action string `json:"action"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)

		host, err := s.Metal3.PowerAction(name, req.Action)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "TOOL_CALL_EXECUTED",
			TargetResource:  "BareMetalHost/" + name,
			Summary:         fmt.Sprintf("Redfish power action '%s' executed on %s", req.Action, name),
			PayloadRedacted: map[string]interface{}{"host": name, "action": req.Action},
			Status:          "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": host})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/bmh/{name}/sol", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		solText := s.Metal3.GetSOLStream(name)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "host": name, "sol": solText})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/bmh/{name}/telemetry", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		telem, err := s.Metal3.GetHostTelemetry(name)
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "telemetry": telem})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/bmh/{name}/reprovision", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		if _, ok := s.authorize(w, r, "BareMetalHost/"+name+"/Reprovision", "HOST_MANAGE"); !ok {
			return
		}
		host, err := s.Metal3.ReprovisionHost(name)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "host": host})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/clusters", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Metal3.ListClusters()})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/clusters", func(w http.ResponseWriter, r *http.Request) {
		actor, ok := s.authorize(w, r, "Cluster/Create", "CLUSTER_MANAGE")
		if !ok {
			return
		}
		var req struct {
			Name               string `json:"name"`
			KubernetesVersion  string `json:"kubernetes_version"`
			CNIPlugin          string `json:"cni_plugin"`
			CNI                string `json:"cni"`
			GPUOperatorEnabled bool   `json:"gpu_operator_enabled"`
			ControlPlaneMaster int    `json:"control_plane_masters"`
			WorkerNodes        int    `json:"worker_nodes"`
			GPUNodes           int    `json:"gpu_nodes"`
			Scale              *struct {
				ControlPlaneNodes int `json:"control_plane_nodes"`
				WorkerNodes       int `json:"worker_nodes"`
				GPUNodes          int `json:"gpu_nodes"`
			} `json:"scale"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		masters, workers, gpus := req.ControlPlaneMaster, req.WorkerNodes, req.GPUNodes
		if req.Scale != nil {
			if req.Scale.ControlPlaneNodes > 0 {
				masters = req.Scale.ControlPlaneNodes
			}
			if req.Scale.WorkerNodes > 0 {
				workers = req.Scale.WorkerNodes
			}
			if req.Scale.GPUNodes > 0 {
				gpus = req.Scale.GPUNodes
			}
		}
		cni := req.CNIPlugin
		if cni == "" {
			cni = req.CNI
		}
		gpuOp := "NVIDIA GPU Operator v24.6.0"
		if !req.GPUOperatorEnabled && gpus == 0 {
			gpuOp = "Disabled"
		}
		cl := s.Metal3.CreateCluster(req.Name, req.KubernetesVersion, cni, gpuOp, masters, workers, gpus)
		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:       actor.TenantID,
			ProjectID:      actor.ActiveProjectID,
			ActorID:        actor.ActorID,
			ActorName:      actor.ActorName,
			ActorRole:      actor.Role,
			EventType:      "CONFIG_UPDATED",
			TargetResource: "Cluster/" + cl.ID,
			Summary:        fmt.Sprintf("Created BareMetal Kubernetes cluster %s (%s)", cl.Name, cl.K8sVersion),
			Status:         "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": cl})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/clusters/{id}/pivot", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if _, ok := s.authorize(w, r, "Cluster/"+id+"/Pivot", "CLUSTER_MANAGE"); !ok {
			return
		}
		res := s.Metal3.TriggerPivot(id)
		writeJSON(w, http.StatusOK, res)
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/clusters/{id}/scale", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Cluster/"+id+"/Scale", "CLUSTER_MANAGE")
		if !ok {
			return
		}
		var req struct {
			TargetWorkerCount int `json:"target_worker_count"`
			WorkerNodes       int `json:"worker_nodes"`
			GPUNodes          int `json:"gpu_nodes"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		workers := req.TargetWorkerCount
		if workers <= 0 {
			workers = req.WorkerNodes + req.GPUNodes
		}
		if workers <= 0 {
			workers = req.WorkerNodes
		}

		c, err := s.Metal3.ScaleCluster(id, workers)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:       actor.TenantID,
			ProjectID:      actor.ActiveProjectID,
			ActorID:        actor.ActorID,
			ActorName:      actor.ActorName,
			ActorRole:      actor.Role,
			EventType:      "CONFIG_UPDATED",
			TargetResource: "Cluster/" + id,
			Summary:        fmt.Sprintf("Scaled cluster %s to %d worker nodes", id, workers),
			Status:         "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": c})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/clusters/{id}/scale-down-node", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if _, ok := s.authorize(w, r, "Cluster/"+id+"/ScaleDown", "CLUSTER_MANAGE", "HOST_MANAGE"); !ok {
			return
		}
		var req struct {
			HostName string `json:"host_name"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if err := s.Metal3.ScaleDownNode(id, req.HostName); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "cluster_id": id, "scaled_down_host": req.HostName})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/k8s-versions", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":               true,
			"data":                  s.Metal3.GetSupportedK8sVersions(),
			"default_version":       "v1.35.0",
			"current_fleet_version": "v1.31.2",
		})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/clusters/{id}/upgrade", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Cluster/"+id+"/VersionUpgrade", "CLUSTER_MANAGE")
		if !ok {
			return
		}
		var req models.ClusterUpgradeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}
		target := strings.TrimSpace(req.TargetVersion)
		if target == "" {
			target = strings.TrimSpace(req.TargetK8sVersion)
		}
		if target == "" {
			target = "v1.35.0"
		}

		job, err := s.Metal3.TriggerClusterUpgrade(id, target, req.Policy, req.TargetNodes, req.DrainTimeout, actor.ActorName)
		if err != nil {
			writeAPIError(w, http.StatusBadRequest, "INVALID_UPGRADE_SPEC", err.Error())
			return
		}

		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "CONFIG_UPDATED",
			TargetResource:  "Cluster/" + id + "/K8sVersion",
			Summary:         fmt.Sprintf("VersionController started %s K8s upgrade on %s -> %s (%d nodes)", job.Policy, id, target, job.TotalNodes),
			PayloadRedacted: map[string]interface{}{"cluster_id": id, "target_k8s_version": target, "policy": job.Policy, "job_id": job.ID},
			Status:          "SUCCESS",
		})

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":            true,
			"data":               s.Metal3.GetUpgradeStatus(id),
			"policy":             job.Policy,
			"target_k8s_version": target,
			"message":            fmt.Sprintf("VersionController (%s policy) upgrade to %s queued across %d nodes.", job.Policy, target, job.TotalNodes),
		})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/clusters/{id}/reconcile", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if _, ok := s.authorize(w, r, "Cluster/"+id+"/Reconcile", "CLUSTER_MANAGE"); !ok {
			return
		}
		if _, err := s.Metal3.ReconcileVersionUpgrade(id); err != nil {
			writeAPIError(w, http.StatusNotFound, "RECONCILE_NO_JOB", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    s.Metal3.GetUpgradeStatus(id),
		})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/nodes/version-apply", func(w http.ResponseWriter, r *http.Request) {
		actor, ok := s.authorize(w, r, "Metal3/Nodes/VersionApply", "CLUSTER_MANAGE")
		if !ok {
			return
		}
		var req models.NodeVersionApplyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		targetVer := strings.TrimSpace(req.TargetVersion)
		if targetVer == "" {
			targetVer = strings.TrimSpace(req.TargetK8sVersion)
		}
		if targetVer == "" {
			writeAPIError(w, http.StatusBadRequest, "MISSING_TARGET_VERSION", "target_version or target_k8s_version is required")
			return
		}

		names := req.NodeNames
		if req.NodeName != "" {
			found := false
			for _, n := range names {
				if n == req.NodeName {
					found = true
					break
				}
			}
			if !found {
				names = append(names, req.NodeName)
			}
		}
		if len(names) == 0 {
			writeAPIError(w, http.StatusBadRequest, "EMPTY_NODE_LIST", "node_name or node_names cannot be empty")
			return
		}

		upgraded, err := s.Metal3.ApplyVersionToNodes(names, targetVer)
		if err != nil {
			writeAPIError(w, http.StatusBadRequest, "VERSION_APPLY_FAILED", err.Error())
			return
		}

		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "CONFIG_UPDATED",
			TargetResource:  "BareMetalNodes/VersionApply",
			Summary:         fmt.Sprintf("Targeted VersionController reconciled %d node(s) to Kubernetes %s", len(upgraded), targetVer),
			PayloadRedacted: map[string]interface{}{"nodes": upgraded, "target_version": targetVer},
			Status:          "SUCCESS",
		})

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"upgraded_nodes": upgraded,
				"target_version": targetVer,
			},
			"message": fmt.Sprintf("Successfully upgraded %d node(s) to Kubernetes %s", len(upgraded), targetVer),
		})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/clusters/{id}/upgrade-status", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    s.Metal3.GetUpgradeStatus(id),
		})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/alerts", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Metal3.ListAlerts()})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/alerts/simulate", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/Alerts/Simulate", "HOST_MANAGE"); !ok {
			return
		}
		var req struct {
			HostName string `json:"host_name"`
			Rule     string `json:"rule"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		alert := s.Metal3.SimulateAlert(req.HostName, req.Rule)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": alert})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/alerts/{id}/remediate", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if _, ok := s.authorize(w, r, "Alert/"+id+"/Remediate", "HOST_MANAGE"); !ok {
			return
		}
		alert, err := s.Metal3.RemediateAlert(id)
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": alert})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/alerts/{id}/dispatch", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if _, ok := s.authorize(w, r, "Alert/"+id+"/Dispatch", "HOST_MANAGE"); !ok {
			return
		}
		var req struct {
			Channel string `json:"channel"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Channel == "" {
			req.Channel = "feishu"
		}
		res := connectors.DispatchEnterpriseNotification(req.Channel, "secret_sign_key", "Proactive Alert", fmt.Sprintf("Alert %s dispatched", id), "", "card", nil, false)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": res})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/alerts/{id}/dismiss", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if _, ok := s.authorize(w, r, "Alert/"+id+"/Dismiss", "HOST_MANAGE"); !ok {
			return
		}
		if err := s.Metal3.DismissAlert(id); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "dismissed_id": id})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/logs", func(w http.ResponseWriter, r *http.Request) {
		stream := r.URL.Query().Get("stream")
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Metal3.GetLogs(stream)})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/agent/status", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Metal3.GetAgentStatus()})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/agent/command", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/Agent/Command", "CLUSTER_MANAGE", "HOST_MANAGE"); !ok {
			return
		}
		var req struct {
			Command string `json:"command"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		res := s.Metal3.ExecuteAgentCommand(req.Command)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": res})
	})

	// Dual-Agent Orchestration Endpoints
	s.Mux.HandleFunc("GET /api/v1/metal3/dual-agent/status", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.GetDualAgentStatus()})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/dual-agent/trigger", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/DualAgent/Trigger", "CLUSTER_MANAGE"); !ok {
			return
		}
		var req struct {
			Phase string `json:"phase"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.TriggerDualAgentRun(req.Phase)})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/dual-agent/sync", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/DualAgent/Sync", "CLUSTER_MANAGE"); !ok {
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.SyncDualAgent()})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/dual-agent/pivot", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/DualAgent/Pivot", "CLUSTER_MANAGE"); !ok {
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.SimulatePivotHandover()})
	})

	// Pure Go Pod-Resident Dual-Agent Daemons
	s.Mux.HandleFunc("GET /api/v1/metal3/agents/pod-daemons", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.GetPodDaemonsTelemetry()})
	})

	s.Mux.HandleFunc("POST /api/v1/metal3/agents/pod-daemons/command", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/PodDaemon/Command", "CLUSTER_MANAGE", "HOST_MANAGE"); !ok {
			return
		}
		var req struct {
			TargetAgent string `json:"target_agent"`
			Command     string `json:"command"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}
		if req.Command == "" {
			writeError(w, http.StatusBadRequest, "Command cannot be empty")
			return
		}
		res, err := s.Metal3.DispatchPodAgentCommand(req.TargetAgent, req.Command)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": res})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/agents/pod-code", func(w http.ResponseWriter, r *http.Request) {
		readFileOrFallback := func(paths []string, fallback string) string {
			for _, p := range paths {
				if b, err := os.ReadFile(p); err == nil && len(b) > 0 {
					return string(b)
				}
			}
			return fallback
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"files": map[string]interface{}{
				"eph_main_go":       map[string]string{"path": "backend-go/cmd/eph-agent/main.go", "title": "Agent 1 Pod 入口 (cmd/eph-agent/main.go)", "language": "go", "role": "Eph-Node Bootstrap Agent Daemon", "content": readFileOrFallback([]string{"backend-go/cmd/eph-agent/main.go", "cmd/eph-agent/main.go"}, "package main")},
				"eph_pkg_go":        map[string]string{"path": "backend-go/pkg/agent/ephnode/agent.go", "title": "Agent 1 核心守护逻辑 (pkg/agent/ephnode/agent.go)", "language": "go", "role": "Ironic Watchdog & Hardware Discovery Reconciler", "content": readFileOrFallback([]string{"backend-go/pkg/agent/ephnode/agent.go"}, "package ephnode")},
				"eph_dhcp_go":       map[string]string{"path": "backend-go/pkg/agent/ephnode/dhcp_monitor.go", "title": "Agent 1 DHCP/PXE 租约监控器 (pkg/agent/ephnode/dhcp_monitor.go)", "language": "go", "role": "Dnsmasq TFTP/PXE Lease Watchdog", "content": readFileOrFallback([]string{"backend-go/pkg/agent/ephnode/dhcp_monitor.go"}, "package ephnode")},
				"eph_probe_go":      map[string]string{"path": "backend-go/pkg/agent/ephnode/probe_server.go", "title": "Agent 1 Pod 探针与指标服务 (pkg/agent/ephnode/probe_server.go)", "language": "go", "role": "K8s Healthz / Readyz / Prometheus Metrics (:8081)", "content": readFileOrFallback([]string{"backend-go/pkg/agent/ephnode/probe_server.go"}, "package ephnode")},
				"target_main_go":    map[string]string{"path": "backend-go/cmd/target-agent/main.go", "title": "Agent 2 Pod 入口 (cmd/target-agent/main.go)", "language": "go", "role": "Target Cluster Lifecycle Daemon", "content": readFileOrFallback([]string{"backend-go/cmd/target-agent/main.go"}, "package main")},
				"target_pkg_go":     map[string]string{"path": "backend-go/pkg/agent/target/agent.go", "title": "Agent 2 核心生命周期逻辑 (pkg/agent/target/agent.go)", "language": "go", "role": "CAPI MachinePool Reconciler & Multi-CNI Mesh Custodian", "content": readFileOrFallback([]string{"backend-go/pkg/agent/target/agent.go"}, "package target")},
				"target_cni_go":     map[string]string{"path": "backend-go/pkg/agent/target/cni_mesh.go", "title": "Agent 2 Multi-CNI 网状拓扑编排 (pkg/agent/target/cni_mesh.go)", "language": "go", "role": "Multus + Calico + OVS + SR-IOV 200Gbps RoCEv2 Mesh", "content": readFileOrFallback([]string{"backend-go/pkg/agent/target/cni_mesh.go"}, "package target")},
				"target_etcd_go":    map[string]string{"path": "backend-go/pkg/agent/target/etcd_verifier.go", "title": "Agent 2 Etcd Raft 法定人数校验器 (pkg/agent/target/etcd_verifier.go)", "language": "go", "role": "In-Pod Etcd Consensus & Leader Election Auditor", "content": readFileOrFallback([]string{"backend-go/pkg/agent/target/etcd_verifier.go"}, "package target")},
				"target_probe_go":   map[string]string{"path": "backend-go/pkg/agent/target/probe_server.go", "title": "Agent 2 Pod 探针与指标服务 (pkg/agent/target/probe_server.go)", "language": "go", "role": "K8s Healthz / Readyz / Prometheus Metrics (:8082)", "content": readFileOrFallback([]string{"backend-go/pkg/agent/target/probe_server.go"}, "package target")},
				"proto_handshake_go": map[string]string{"path": "backend-go/pkg/agent/protocol/handshake.go", "title": "双 Agent 安全握手与 CRD 验签协议 (pkg/agent/protocol/handshake.go)", "language": "go", "role": "Cryptographic SHA-256 Dual-Agent Handover Protocol", "content": readFileOrFallback([]string{"backend-go/pkg/agent/protocol/handshake.go"}, "package protocol")},
				"eph_pod_yaml":      map[string]string{"path": "backend-go/deploy/eph-agent-pod.yaml", "title": "Agent 1 Kubernetes Pod 资源编排 (Pod YAML)", "language": "yaml", "role": "Ephemeral Node Pod Manifest", "content": readFileOrFallback([]string{"backend-go/deploy/eph-agent-pod.yaml"}, "apiVersion: v1")},
				"target_ds_yaml":    map[string]string{"path": "backend-go/deploy/target-agent-daemonset.yaml", "title": "Agent 2 Kubernetes DaemonSet 资源编排 (DaemonSet YAML)", "language": "yaml", "role": "Target Cluster CAPI DaemonSet Manifest", "content": readFileOrFallback([]string{"backend-go/deploy/target-agent-daemonset.yaml"}, "apiVersion: apps/v1")},
			},
		})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/network/spec", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.GetDualNetworkSpec()})
	})
	s.Mux.HandleFunc("GET /api/v1/metal3/cni/spec", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.GetMultiCNISpec()})
	})
	s.Mux.HandleFunc("POST /api/v1/metal3/cni/test", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, s.Metal3.TestCNIConnectivity())
	})
	s.Mux.HandleFunc("POST /api/v1/metal3/cni/simulate-packet", func(w http.ResponseWriter, r *http.Request) {
		var req models.PacketSimulationRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.SimulatePacketFlow(req)})
	})

	// CNI Provisioning State Machine & Interface Configuration Routes (pkg/cni)
	s.Mux.HandleFunc("GET /api/v1/metal3/cni/fleet", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.GetCNIFleetSummary()})
	})
	s.Mux.HandleFunc("POST /api/v1/metal3/cni/reconcile", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/CNI/Reconcile", "CLUSTER_MANAGE"); !ok {
			return
		}
		var req struct {
			HostNames   []string `json:"host_names"`
			ConvergeAll bool     `json:"converge_all"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.ReconcileCNIFleet(req.HostNames, req.ConvergeAll)})
	})
	s.Mux.HandleFunc("POST /api/v1/metal3/cni/config", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/CNI/Config", "CLUSTER_MANAGE"); !ok {
			return
		}
		var req cni.FleetConfig
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid CNI FleetConfig JSON payload")
			return
		}
		summary, err := s.Metal3.ApplyCNIConfig(req)
		if err != nil {
			writeAPIError(w, http.StatusBadRequest, "INVALID_CNI_CONFIG", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": summary})
	})
	s.Mux.HandleFunc("POST /api/v1/metal3/cni/drift", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/CNI/Drift", "HOST_MANAGE", "CLUSTER_MANAGE"); !ok {
			return
		}
		var req struct {
			HostName string         `json:"host_name"`
			Plugin   cni.PluginKind `json:"plugin"`
			Degraded bool           `json:"degraded"`
			Reason   string         `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.HostName == "" {
			writeError(w, http.StatusBadRequest, "host_name is required to inject CNI drift")
			return
		}
		st, err := s.Metal3.InjectCNIDrift(req.HostName, req.Plugin, req.Degraded, req.Reason)
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": st})
	})

	s.Mux.HandleFunc("GET /api/v1/metal3/omni/status", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.GetOmniDeployProgress()})
	})
	s.Mux.HandleFunc("POST /api/v1/metal3/omni/deploy", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/Omni/Deploy", "CLUSTER_MANAGE"); !ok {
			return
		}
		var req models.OmniDeployRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.TriggerOmniDeploy(&req)})
	})
	s.Mux.HandleFunc("POST /api/v1/metal3/omni/start", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/Omni/Start", "CLUSTER_MANAGE"); !ok {
			return
		}
		var req models.OmniDeployRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.StartOmniDeploy(&req)})
	})
	s.Mux.HandleFunc("POST /api/v1/metal3/omni/step", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/Omni/Step", "CLUSTER_MANAGE"); !ok {
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.NextOmniStep()})
	})
	s.Mux.HandleFunc("POST /api/v1/metal3/omni/reset", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.authorize(w, r, "Metal3/Omni/Reset", "CLUSTER_MANAGE"); !ok {
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.ResetOmniDeploy()})
	})
	s.Mux.HandleFunc("POST /api/v1/metal3/omni/validate-yaml", func(w http.ResponseWriter, r *http.Request) {
		var req models.ManifestValidationRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": s.Metal3.ValidateManifest(req)})
	})
	s.Mux.HandleFunc("GET /api/v1/metal3/omni/manifests", func(w http.ResponseWriter, r *http.Request) {
		manifests := s.Metal3.GetDeclarativeManifests(r.URL.Query().Get("cluster_name"), r.URL.Query().Get("k8s_version"))
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "manifests": manifests})
	})

	// -------------------------------------------------------------
	// 7. PLUGINS, WEATHER & DOMESTIC CONNECTORS
	// -------------------------------------------------------------
	s.Mux.HandleFunc("GET /api/v1/plugins/presets", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Connectors.GetPresets()})
	})
	s.Mux.HandleFunc("GET /api/v1/plugins", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": s.Connectors.ListPlugins()})
	})
	s.Mux.HandleFunc("POST /api/v1/plugins/create", func(w http.ResponseWriter, r *http.Request) {
		actor, ok := s.authorize(w, r, "Plugin/Create", "CONNECTOR_ADMIN", "CONNECTOR_MANAGE")
		if !ok {
			return
		}
		var req struct {
			Name            string                 `json:"name"`
			NameZh          string                 `json:"name_zh"`
			Category        string                 `json:"category"`
			Provider        string                 `json:"provider"`
			Description     string                 `json:"description"`
			DescriptionZh   string                 `json:"description_zh"`
			AuthType        string                 `json:"auth_type"`
			Endpoint        string                 `json:"endpoint"`
			APIKey          string                 `json:"api_key"`
			ToolID          string                 `json:"tool_id"`
			ToolName        string                 `json:"tool_name"`
			ToolDescription string                 `json:"tool_description"`
			Risk            string                 `json:"risk"`
			SampleArgs      map[string]interface{} `json:"sample_args"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}
		created := s.Connectors.CreatePlugin(req)
		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "CONNECTOR_CONFIG_UPDATE",
			TargetResource:  "Plugin/" + created.ID,
			Summary:         fmt.Sprintf("Registered enterprise connector '%s' (tool=%s)", created.Name, created.ToolID),
			PayloadRedacted: map[string]interface{}{"plugin_id": created.ID, "api_key": req.APIKey},
			Status:          "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": created})
	})
	s.Mux.HandleFunc("POST /api/v1/plugins/{id}/configure", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Plugin/"+id+"/Configure", "CONNECTOR_ADMIN", "CONNECTOR_MANAGE")
		if !ok {
			return
		}
		var req struct {
			Config map[string]interface{} `json:"config"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		s.Connectors.UpdateConfig(id, req.Config)
		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "CONNECTOR_CONFIG_UPDATE",
			TargetResource:  "Plugin/" + id,
			Summary:         fmt.Sprintf("Updated connector configuration for %s (secrets sanitized)", id),
			PayloadRedacted: req.Config,
			Status:          "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "id": id})
	})
	s.Mux.HandleFunc("POST /api/v1/plugins/{id}/toggle", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		actor, ok := s.authorize(w, r, "Plugin/"+id+"/Toggle", "CONNECTOR_ADMIN", "CONNECTOR_MANAGE")
		if !ok {
			return
		}
		p, err := s.Connectors.TogglePlugin(id)
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:       actor.TenantID,
			ProjectID:      actor.ActiveProjectID,
			ActorID:        actor.ActorID,
			ActorName:      actor.ActorName,
			ActorRole:      actor.Role,
			EventType:      "CONNECTOR_STATUS_CHANGE",
			TargetResource: "Plugin/" + id,
			Summary:        fmt.Sprintf("Toggled connector %s -> active=%v", id, p.IsActive),
			Status:         "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": p})
	})
	s.Mux.HandleFunc("DELETE /api/v1/plugins/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if _, ok := s.authorize(w, r, "Plugin/"+id+"/Delete", "CONNECTOR_ADMIN", "CONNECTOR_MANAGE"); !ok {
			return
		}
		if err := s.Connectors.DeletePlugin(id); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "deleted_id": id})
	})

	s.Mux.HandleFunc("POST /api/v1/weather/query", func(w http.ResponseWriter, r *http.Request) {
		actor, ok := s.authorize(w, r, "Plugin/Weather/Query", "WEATHER_READ", "RUN_EXECUTE", "TOOL_READ")
		if !ok {
			return
		}
		var req struct {
			City  string `json:"city"`
			Units string `json:"units"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		res := connectors.QueryWeather(req.City, req.Units)
		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:       actor.TenantID,
			ProjectID:      actor.ActiveProjectID,
			ActorID:        actor.ActorID,
			ActorName:      actor.ActorName,
			ActorRole:      actor.Role,
			EventType:      "TOOL_INVOKED",
			TargetResource: "Weather/Query",
			Summary:        fmt.Sprintf("Queried meteorological data for %s", req.City),
			Status:         "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": res})
	})

	s.Mux.HandleFunc("POST /api/v1/domestic/dispatch", func(w http.ResponseWriter, r *http.Request) {
		actor, ok := s.authorize(w, r, "Domestic/Webhook/Dispatch", "FEISHU_DISPATCH", "DINGTALK_DISPATCH", "WECOM_DISPATCH", "NOTIFY_SEND", "CONNECTOR_MANAGE", "CONNECTOR_ADMIN")
		if !ok {
			return
		}
		var req struct {
			Platform    string   `json:"platform"`
			Channel     string   `json:"channel"`
			TargetURL   string   `json:"target_url"`
			Secret      string   `json:"secret"`
			MessageType string   `json:"message_type"`
			Title       string   `json:"title"`
			Content     string   `json:"content"`
			AtUsers     []string `json:"at_users"`
			IsAtAll     bool     `json:"is_at_all"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		platform := strings.TrimSpace(req.Platform)
		if platform == "" {
			platform = strings.TrimSpace(req.Channel)
		}
		if platform == "" {
			platform = "feishu"
		}
		res := connectors.DispatchEnterpriseNotification(platform, req.Secret, req.Title, req.Content, req.TargetURL, req.MessageType, req.AtUsers, req.IsAtAll)

		s.Store.RecordAudit(&models.AuditEvent{
			TenantID:        actor.TenantID,
			ProjectID:       actor.ActiveProjectID,
			ActorID:         actor.ActorID,
			ActorName:       actor.ActorName,
			ActorRole:       actor.Role,
			EventType:       "EXTERNAL_WEBHOOK_DISPATCH",
			TargetResource:  "Domestic/" + platform,
			Summary:         fmt.Sprintf("Dispatched HMAC-SHA256 signed notification via %s (%s)", platform, req.Title),
			PayloadRedacted: map[string]interface{}{"platform": platform, "secret": req.Secret, "title": req.Title},
			Status:          "SUCCESS",
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": res})
	})

	// -------------------------------------------------------------
	// 8. AUDIT EVENTS
	// -------------------------------------------------------------
	s.Mux.HandleFunc("GET /api/v1/audits", func(w http.ResponseWriter, r *http.Request) {
		s.Store.RLock()
		out := make([]*models.AuditEvent, len(s.Store.Audits))
		copy(out, s.Store.Audits)
		s.Store.RUnlock()
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": out})
	})
}
