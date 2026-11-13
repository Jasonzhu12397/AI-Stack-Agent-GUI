package metal3

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
)

// VersionController manages declarative Kubernetes version upgrades across Metal3 BareMetal nodes
// with a continuous Kubernetes-style background reconcile loop and policy-aware orchestration.
type VersionController struct {
	engine      *Engine
	activeJob   *models.ClusterUpgradeJob
	reconcileCh chan string
	started     bool
	tickCount   int64
}

func NewVersionController(engine *Engine) *VersionController {
	return &VersionController{
		engine:      engine,
		reconcileCh: make(chan string, 16),
	}
}

func defaultUpgradeSteps() []models.UpgradeStepStatus {
	return []models.UpgradeStepStatus{
		{ID: "step_1", Name: "Pre-flight Compatibility & Etcd Quorum", Status: "PENDING"},
		{ID: "step_2", Name: "Node Cordon & Workload Eviction (Drain)", Status: "PENDING"},
		{ID: "step_3", Name: "Talos Linux Kernel / Kubernetes Binary Pivot", Status: "PENDING"},
		{ID: "step_4", Name: "Kubelet RoCEv2 & FabricManager Healthcheck", Status: "PENDING"},
		{ID: "step_5", Name: "Node Uncordon & Traffic Restoration", Status: "PENDING"},
	}
}

// StartController starts the asynchronous Kubernetes VersionController reconcile loop.
func (e *Engine) StartController(ctx context.Context) {
	e.mu.Lock()
	if e.versionCtrl == nil {
		e.versionCtrl = NewVersionController(e)
	}
	if e.versionCtrl.started {
		e.mu.Unlock()
		return
	}
	e.versionCtrl.started = true
	e.appendControllerLogLocked("info", "VersionController & CNI Reconcile loops initialized (sync interval: 1200ms)")
	mgr := e.CNIManager
	e.mu.Unlock()

	go e.versionCtrl.reconcileLoop(ctx)
	if mgr != nil {
		mgr.StartReconcileLoop(ctx, 1500*time.Millisecond)
	}
}

func (vc *VersionController) reconcileLoop(ctx context.Context) {
	ticker := time.NewTicker(1200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			vc.engine.mu.Lock()
			vc.engine.appendControllerLogLocked("info", "VersionController reconcile loop stopped gracefully")
			vc.engine.mu.Unlock()
			return
		case clusterID := <-vc.reconcileCh:
			_, _ = vc.engine.ReconcileVersionUpgrade(clusterID)
		case <-ticker.C:
			vc.engine.mu.RLock()
			hasActive := vc.activeJob != nil && vc.activeJob.IsUpgrading
			clusterID := ""
			if hasActive {
				clusterID = vc.activeJob.ClusterID
			}
			vc.engine.mu.RUnlock()

			if hasActive {
				_, _ = vc.engine.ReconcileVersionUpgrade(clusterID)
			}
		}
	}
}

// ValidateK8sVersion validates a requested Kubernetes release against supported versions.
func (e *Engine) ValidateK8sVersion(targetVer string) (*models.SupportedK8sVersion, error) {
	targetVer = strings.TrimSpace(targetVer)
	if targetVer == "" {
		return nil, fmt.Errorf("target_k8s_version cannot be empty")
	}
	for _, v := range e.GetSupportedK8sVersions() {
		if v.Version == targetVer || v.ID == targetVer || v.MajorMinor == targetVer {
			vCopy := v
			return &vCopy, nil
		}
	}
	return nil, fmt.Errorf("unsupported Kubernetes version '%s': not in curated Metal3 Talos release matrix", targetVer)
}

// TriggerClusterUpgrade initializes a declarative Kubernetes version upgrade job and signals the controller reconcile loop.
func (e *Engine) TriggerClusterUpgrade(
	clusterID string,
	targetVersion string,
	upgradePolicy string,
	targetNodes []string,
	drainTimeout int,
	triggeredBy string,
) (*models.ClusterUpgradeJob, error) {
	if _, err := e.ValidateK8sVersion(targetVersion); err != nil {
		return nil, err
	}

	if upgradePolicy == "" {
		upgradePolicy = "rolling"
	}
	switch strings.ToLower(upgradePolicy) {
	case "rolling", "canary", "batch":
		upgradePolicy = strings.ToLower(upgradePolicy)
	default:
		return nil, fmt.Errorf("invalid upgrade policy '%s': must be rolling, canary, or batch", upgradePolicy)
	}

	if drainTimeout <= 0 {
		drainTimeout = 180
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	if e.versionCtrl == nil {
		e.versionCtrl = NewVersionController(e)
	}

	cl, exists := e.clusters[clusterID]
	if !exists {
		return nil, fmt.Errorf("cluster '%s' not found", clusterID)
	}

	// Build deterministic ordered node target list (control-plane first, then workers)
	selected := e.resolveTargetNodesLocked(clusterID, targetNodes)
	if len(selected) == 0 {
		return nil, fmt.Errorf("no eligible active BareMetalHost nodes found for cluster '%s'", clusterID)
	}

	nodeStates := make([]models.NodeUpgradeState, 0, len(selected))
	nowISO := time.Now().UTC().Format(time.RFC3339)
	for _, hostName := range selected {
		h := e.hosts[hostName]
		fromVer := cl.K8sVersion
		if h.K8sVersion != "" {
			fromVer = h.K8sVersion
		}
		h.TargetK8sVersion = targetVersion
		h.UpgradeStatus = "QUEUED_UPGRADE"
		h.UpdatedAt = time.Now()
		nodeStates = append(nodeStates, models.NodeUpgradeState{
			HostName:      hostName,
			Role:          h.AssignedRole,
			FromVersion:   fromVer,
			TargetVersion: targetVersion,
			Phase:         "QUEUED",
			UpdatedAt:     nowISO,
		})
	}

	steps := defaultUpgradeSteps()
	steps[0].Status = "RUNNING"

	cl.Status = "UPGRADING_VERSION"
	cl.ProgressPercent = 10
	cl.CurrentStage = fmt.Sprintf("Reconcile Loop Active (%s): Upgrading %d nodes %s -> %s", upgradePolicy, len(selected), cl.K8sVersion, targetVersion)

	job := &models.ClusterUpgradeJob{
		ID:                 fmt.Sprintf("upg_%s_%d", clusterID, time.Now().UnixMilli()),
		ClusterID:          clusterID,
		IsUpgrading:        true,
		CurrentVersion:     cl.K8sVersion,
		TargetVersion:      targetVersion,
		Policy:             upgradePolicy,
		DrainTimeout:       drainTimeout,
		Status:             "UPGRADING_VERSION",
		CurrentStepIndex:   0,
		TotalNodes:         len(selected),
		UpgradedNodesCount: 0,
		ReconcileCount:     0,
		TargetNodes:        selected,
		NodeStates:         nodeStates,
		Steps:              steps,
		TriggeredBy:        triggeredBy,
		StartedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}
	e.versionCtrl.activeJob = job

	// Record Dual-Agent coordinator event & controller log
	e.dualAgentStatus.CurrentPhase = "K8S_VERSION_RECONCILE"
	e.dualAgentStatus.SyncedAt = time.Now()
	e.dualAgentStatus.Events = append([]models.DualAgentEvent{
		{
			ID:        fmt.Sprintf("evt_upg_%d", time.Now().UnixNano()),
			Source:    "TARGET_AGENT",
			Phase:     "K8S_VERSION_RECONCILE",
			Level:     "INFO",
			Message:   fmt.Sprintf("VersionController started %s upgrade on %s (%d nodes) toward %s", upgradePolicy, clusterID, len(selected), targetVersion),
			MessageZh: fmt.Sprintf("VersionController 启动 %s 策略升级 (%s，共 %d 台物理节点) -> 目标版本 %s", upgradePolicy, clusterID, len(selected), targetVersion),
			Timestamp: time.Now(),
		},
	}, e.dualAgentStatus.Events...)

	e.appendControllerLogLocked("info", fmt.Sprintf("Enqueued ClusterUpgradeJob %s (%s -> %s, policy=%s, nodes=%d)", job.ID, job.CurrentVersion, targetVersion, upgradePolicy, len(selected)))

	// Kick off non-blocking immediate first reconcile pass if controller loop channel exists
	if e.versionCtrl.reconcileCh != nil {
		select {
		case e.versionCtrl.reconcileCh <- clusterID:
		default:
		}
	}

	jobCopy := *job
	return &jobCopy, nil
}

// ReconcileVersionUpgrade advances the active Kubernetes VersionController job by one reconciliation tick.
func (e *Engine) ReconcileVersionUpgrade(clusterID string) (*models.ClusterUpgradeJob, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.versionCtrl == nil || e.versionCtrl.activeJob == nil {
		return nil, fmt.Errorf("no upgrade job registered for cluster '%s'", clusterID)
	}
	job := e.versionCtrl.activeJob
	if clusterID != "" && job.ClusterID != clusterID {
		return nil, fmt.Errorf("no active upgrade job matching cluster '%s'", clusterID)
	}
	if !job.IsUpgrading {
		jobCopy := *job
		return &jobCopy, nil
	}

	job.ReconcileCount++
	e.versionCtrl.tickCount++
	now := time.Now()
	nowISO := now.UTC().Format(time.RFC3339)

	cl := e.clusters[job.ClusterID]
	meta, _ := e.findVersionMetaLocked(job.TargetVersion)
	talosVer := "v1.8.4"
	if meta != nil && meta.TalosLinux != "" {
		talosVer = meta.TalosLinux
	}

	// Step progression across ticks before/during node pivots
	switch job.ReconcileCount {
	case 1:
		// Phase 1 completes Pre-flight Quorum and moves into Cordon/Pivot
		job.Steps[0].Status = "COMPLETED"
		job.Steps[1].Status = "RUNNING"
		job.CurrentStepIndex = 1
		e.appendControllerLogLocked("info", fmt.Sprintf("[Reconcile #%d] Pre-flight Etcd Quorum & Talos image %s verified", job.ReconcileCount, talosVer))
	case 2:
		job.Steps[1].Status = "COMPLETED"
		job.Steps[2].Status = "RUNNING"
		job.CurrentStepIndex = 2
	}

	// Determine batch concurrency per reconcile tick based on Policy
	batchSize := 1
	switch job.Policy {
	case "batch":
		batchSize = 2
	case "canary":
		// Canary upgrades 1 node on first node tick, then batch of 2 once canary verified
		if job.UpgradedNodesCount == 0 {
			batchSize = 1
		} else {
			batchSize = 2
		}
	default:
		batchSize = 1
	}

	// Advance up to batchSize pending nodes to COMPLETED and mark next wave as PIVOTING
	upgradedThisTick := 0
	for i := range job.NodeStates {
		ns := &job.NodeStates[i]
		if ns.Phase == "COMPLETED" {
			continue
		}
		if upgradedThisTick < batchSize {
			if ns.Phase == "QUEUED" {
				ns.Phase = "PIVOTING_IMAGE"
				ns.UpdatedAt = nowISO
				if h, ok := e.hosts[ns.HostName]; ok {
					h.UpgradeStatus = "PIVOTING_IMAGE"
					h.SerialConsoleRecent = append([]string{
						fmt.Sprintf("[SOL %s] VersionController cordon+drain & pivoting Talos %s / K8s %s", ns.HostName, talosVer, job.TargetVersion),
					}, h.SerialConsoleRecent...)
				}
				upgradedThisTick++
			} else {
				// Complete node upgrade
				ns.Phase = "COMPLETED"
				ns.UpdatedAt = nowISO
				job.UpgradedNodesCount++
				upgradedThisTick++
				if h, ok := e.hosts[ns.HostName]; ok {
					h.K8sVersion = job.TargetVersion
					h.TargetK8sVersion = ""
					h.UpgradeStatus = "HEALTHY_VERIFIED"
					h.BootImage = fmt.Sprintf("talos-%s-k8s-%s.iso", talosVer, job.TargetVersion)
					h.UpdatedAt = now
					h.SerialConsoleRecent = append([]string{
						fmt.Sprintf("[SOL %s] Kubelet %s + RoCEv2 healthy & uncordoned (Verified by VersionController)", ns.HostName, job.TargetVersion),
					}, h.SerialConsoleRecent...)
				}
				e.appendControllerLogLocked("info", fmt.Sprintf("[Reconcile #%d] Node %s converged to Kubernetes %s (%d/%d)", job.ReconcileCount, ns.HostName, job.TargetVersion, job.UpgradedNodesCount, job.TotalNodes))
			}
		} else {
			break
		}
	}

	// Calculate progress
	if job.UpgradedNodesCount >= job.TotalNodes {
		for idx := range job.Steps {
			job.Steps[idx].Status = "COMPLETED"
		}
		job.CurrentStepIndex = len(job.Steps) - 1
		job.IsUpgrading = false
		job.Status = "READY"
		job.CurrentVersion = job.TargetVersion
		completed := now
		job.CompletedAt = &completed

		if cl != nil {
			cl.Version = job.TargetVersion
			cl.K8sVersion = job.TargetVersion
			cl.Status = "READY"
			cl.ProgressPercent = 100
			cl.CurrentStage = fmt.Sprintf("FLEET_READY (%s)", job.TargetVersion)
		}

		e.dualAgentStatus.CurrentPhase = "CLUSTER_HEALTHY"
		e.dualAgentStatus.SyncedAt = now
		e.dualAgentStatus.Events = append([]models.DualAgentEvent{
			{
				ID:        fmt.Sprintf("evt_upg_done_%d", now.UnixNano()),
				Source:    "TARGET_AGENT",
				Phase:     "CLUSTER_HEALTHY",
				Level:     "SUCCESS",
				Message:   fmt.Sprintf("VersionController converged cluster %s (%d/%d nodes) to Kubernetes %s", job.ClusterID, job.UpgradedNodesCount, job.TotalNodes, job.TargetVersion),
				MessageZh: fmt.Sprintf("VersionController 已完成集群 %s 全量节点版本收敛 (%d/%d 节点) -> Kubernetes %s", job.ClusterID, job.UpgradedNodesCount, job.TotalNodes, job.TargetVersion),
				Timestamp: now,
			},
		}, e.dualAgentStatus.Events...)
		e.appendControllerLogLocked("success", fmt.Sprintf("ClusterUpgradeJob %s converged 100%% to %s", job.ID, job.TargetVersion))
	} else {
		pct := 20 + (job.UpgradedNodesCount*70)/job.TotalNodes
		if pct > 95 {
			pct = 95
		}
		if cl != nil {
			cl.ProgressPercent = pct
			cl.CurrentStage = fmt.Sprintf("Reconciling (%s): %d/%d nodes on %s", job.Policy, job.UpgradedNodesCount, job.TotalNodes, job.TargetVersion)
		}
		if job.UpgradedNodesCount > 0 && len(job.Steps) >= 4 {
			job.Steps[2].Status = "COMPLETED"
			job.Steps[3].Status = "RUNNING"
			job.CurrentStepIndex = 3
		}
	}

	job.UpdatedAt = now
	jobCopy := *job
	return &jobCopy, nil
}

// ApplyVersionToNodes upgrades a targeted subset of BareMetalHost nodes with immediate reconciliation.
func (e *Engine) ApplyVersionToNodes(nodeNames []string, targetVersion string) ([]string, error) {
	if _, err := e.ValidateK8sVersion(targetVersion); err != nil {
		return nil, err
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	var upgraded []string
	var missing []string
	meta, _ := e.findVersionMetaLocked(targetVersion)
	talosVer := "v1.8.4"
	if meta != nil && meta.TalosLinux != "" {
		talosVer = meta.TalosLinux
	}

	now := time.Now()
	for _, name := range nodeNames {
		if h, ok := e.hosts[name]; ok {
			h.K8sVersion = targetVersion
			h.TargetK8sVersion = ""
			h.UpgradeStatus = "HEALTHY_VERIFIED"
			h.BootImage = fmt.Sprintf("talos-%s-k8s-%s.iso", talosVer, targetVersion)
			h.UpdatedAt = now
			h.SerialConsoleRecent = append([]string{
				fmt.Sprintf("[SOL %s] VersionController targeted reconcile: Upgraded kubelet/Talos -> %s", name, targetVersion),
			}, h.SerialConsoleRecent...)
			upgraded = append(upgraded, name)
		} else {
			missing = append(missing, name)
		}
	}

	if len(upgraded) == 0 {
		return nil, fmt.Errorf("none of requested hosts found: %s", strings.Join(missing, ", "))
	}

	e.appendControllerLogLocked("info", fmt.Sprintf("Targeted node reconciliation upgraded %d host(s) [%s] to %s", len(upgraded), strings.Join(upgraded, ", "), targetVersion))
	return upgraded, nil
}

// GetUpgradeStatus returns real-time VersionController upgrade progress and per-node reconciliation telemetry.
func (e *Engine) GetUpgradeStatus(clusterID string) map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if e.versionCtrl != nil && e.versionCtrl.activeJob != nil && (clusterID == "" || e.versionCtrl.activeJob.ClusterID == clusterID) {
		j := e.versionCtrl.activeJob
		activeStep := j.CurrentStepIndex + 1
		if activeStep < 1 {
			activeStep = 1
		}
		if !j.IsUpgrading && j.Status == "READY" {
			activeStep = 6
		}
		msg := fmt.Sprintf("Reconcile #%d (%s): %d/%d nodes converged toward %s", j.ReconcileCount, j.Policy, j.UpgradedNodesCount, j.TotalNodes, j.TargetVersion)
		if !j.IsUpgrading && j.Status == "READY" {
			msg = fmt.Sprintf("Cluster %s (%d/%d nodes) converged 100%% to Kubernetes %s", j.ClusterID, j.UpgradedNodesCount, j.TotalNodes, j.TargetVersion)
		}
		return map[string]interface{}{
			"job_id":               j.ID,
			"cluster_id":           j.ClusterID,
			"is_upgrading":         j.IsUpgrading,
			"current_version":      j.CurrentVersion,
			"target_version":       j.TargetVersion,
			"policy":               j.Policy,
			"status":               j.Status,
			"active_step":          activeStep,
			"message":              msg,
			"total_nodes":          j.TotalNodes,
			"upgraded_nodes_count": j.UpgradedNodesCount,
			"reconcile_count":      j.ReconcileCount,
			"target_nodes":         j.TargetNodes,
			"node_states":          j.NodeStates,
			"steps":                j.Steps,
			"triggered_by":         j.TriggeredBy,
			"started_at":           j.StartedAt.UTC().Format(time.RFC3339),
			"updated_at":           j.UpdatedAt.UTC().Format(time.RFC3339),
		}
	}

	cl := e.clusters[clusterID]
	currVer := "v1.31.2"
	status := "READY"
	if cl != nil {
		currVer = cl.K8sVersion
		status = cl.Status
	}

	totalNodes := 0
	convergedNodes := 0
	for _, h := range e.hosts {
		if h.TargetClusterID != nil && *h.TargetClusterID == clusterID {
			totalNodes++
			if h.K8sVersion == currVer {
				convergedNodes++
			}
		}
	}

	steps := defaultUpgradeSteps()
	for i := range steps {
		steps[i].Status = "COMPLETED"
	}

	return map[string]interface{}{
		"cluster_id":           clusterID,
		"is_upgrading":         false,
		"current_version":      currVer,
		"target_version":       currVer,
		"policy":               "rolling",
		"status":               status,
		"active_step":          6,
		"message":              fmt.Sprintf("Cluster %s operating on %s", clusterID, currVer),
		"total_nodes":          totalNodes,
		"upgraded_nodes_count": convergedNodes,
		"reconcile_count":      0,
		"target_nodes":         []string{},
		"node_states":          []models.NodeUpgradeState{},
		"steps":                steps,
	}
}

// resolveTargetNodesLocked returns cluster nodes ordered control-plane first, then workers.
func (e *Engine) resolveTargetNodesLocked(clusterID string, requested []string) []string {
	requestedSet := make(map[string]bool)
	for _, name := range requested {
		requestedSet[name] = true
	}

	var masters []string
	var workers []string
	for name, h := range e.hosts {
		if len(requestedSet) > 0 && !requestedSet[name] {
			continue
		}
		if len(requestedSet) == 0 {
			if h.TargetClusterID == nil || *h.TargetClusterID != clusterID {
				continue
			}
		}
		if h.AssignedRole == "control-plane" {
			masters = append(masters, name)
		} else {
			workers = append(workers, name)
		}
	}
	sort.Strings(masters)
	sort.Strings(workers)
	return append(masters, workers...)
}

func (e *Engine) findVersionMetaLocked(targetVer string) (*models.SupportedK8sVersion, bool) {
	for _, v := range e.GetSupportedK8sVersions() {
		if v.Version == targetVer || v.ID == targetVer || v.MajorMinor == targetVer {
			vCopy := v
			return &vCopy, true
		}
	}
	return nil, false
}

func (e *Engine) appendControllerLogLocked(level, message string) {
	entry := map[string]interface{}{
		"id":         fmt.Sprintf("ctrl_%d", time.Now().UnixNano()),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
		"stream":     "k8s-install",
		"source":     "version-controller",
		"level":      level,
		"message":    message,
		"raw_output": fmt.Sprintf("[VERSION-CONTROLLER:%s] %s", strings.ToUpper(level), message),
	}
	e.controllerLogs = append([]map[string]interface{}{entry}, e.controllerLogs...)
	if len(e.controllerLogs) > 50 {
		e.controllerLogs = e.controllerLogs[:50]
	}
}
