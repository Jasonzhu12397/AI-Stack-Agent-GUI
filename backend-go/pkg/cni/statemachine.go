package cni

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
)

// allowedTransitions defines the strict directed graph of valid CNI state machine transitions.
var allowedTransitions = map[ReconcilePhase]map[ReconcilePhase]bool{
	PhasePending: {
		PhasePreflightCheck: true,
		PhaseDegraded:       true,
	},
	PhasePreflightCheck: {
		PhaseInstallingDaemonSet: true,
		PhaseBindingInterfaces:   true,
		PhaseDegraded:            true,
	},
	PhaseInstallingDaemonSet: {
		PhaseBindingInterfaces: true,
		PhaseDegraded:          true,
	},
	PhaseBindingInterfaces: {
		PhaseVerifyingMesh: true,
		PhaseDegraded:      true,
	},
	PhaseVerifyingMesh: {
		PhaseReady:    true,
		PhaseDrifted:  true,
		PhaseDegraded: true,
	},
	PhaseReady: {
		PhaseDrifted:  true,
		PhaseDegraded: true,
	},
	PhaseDrifted: {
		PhasePreflightCheck:    true,
		PhaseBindingInterfaces: true,
		PhaseDegraded:          true,
	},
	PhaseDegraded: {
		PhasePreflightCheck: true,
	},
}

// CanTransition validates whether moving from `from` -> `to` is legal under the CNI state machine.
func CanTransition(from, to ReconcilePhase) bool {
	if from == to {
		return true
	}
	targets, ok := allowedTransitions[from]
	if !ok {
		return false
	}
	return targets[to]
}

// NextPhase returns the deterministic next happy-path state toward PhaseReady.
func NextPhase(current ReconcilePhase) ReconcilePhase {
	switch current {
	case PhasePending:
		return PhasePreflightCheck
	case PhasePreflightCheck:
		return PhaseInstallingDaemonSet
	case PhaseInstallingDaemonSet:
		return PhaseBindingInterfaces
	case PhaseBindingInterfaces:
		return PhaseVerifyingMesh
	case PhaseVerifyingMesh:
		return PhaseReady
	case PhaseDrifted:
		return PhaseBindingInterfaces
	case PhaseDegraded:
		return PhasePreflightCheck
	default:
		return PhaseReady
	}
}

// Manager runs the Metal3 fleet CNI configuration store and reconciled state machine.
type Manager struct {
	mu              sync.RWMutex
	cfg             FleetConfig
	hosts           map[string]*HostCNIState
	events          []TransitionEvent
	reconcileCycles int64
	loopRunning     bool
	triggerCh       chan struct{}
}

// NewManager initializes a CNI Manager with production Calico/Multus/OVS-DPDK/SR-IOV configuration.
func NewManager(clusterID string) *Manager {
	return &Manager{
		cfg:       DefaultFleetConfig(clusterID),
		hosts:     make(map[string]*HostCNIState),
		events:    make([]TransitionEvent, 0, 128),
		triggerCh: make(chan struct{}, 8),
	}
}

func (m *Manager) pluginsForHostRole(role string) []PluginKind {
	if role == "worker-gpu" {
		return []PluginKind{PluginMultus, PluginCalico, PluginOVSDPDK, PluginSRIOVDPDK, PluginSRIOVRoCEv2}
	}
	return []PluginKind{PluginMultus, PluginCalico, PluginOVSDPDK, PluginSRIOVDPDK}
}

func (m *Manager) specForPluginLocked(kind PluginKind) (iface, driver string, mtu int, latencyUS float64) {
	switch kind {
	case PluginMultus:
		return "multus-shim", "multus-cni", m.cfg.Calico.MTU, 0.08
	case PluginCalico:
		return m.cfg.Calico.InterfaceName, "calico-felix-bgp", m.cfg.Calico.MTU, 12.0
	case PluginOVSDPDK:
		return m.cfg.OVSDPDK.InterfaceName, m.cfg.OVSDPDK.VhostMode, m.cfg.OVSDPDK.MTU, 3.2
	case PluginSRIOVDPDK:
		for _, s := range m.cfg.SRIOVInterfaces {
			if s.PluginKind == PluginSRIOVDPDK {
				return s.InterfaceName, s.Driver, s.MTU, 1.8
			}
		}
		return "net2", "vfio-pci", 9000, 1.8
	case PluginSRIOVRoCEv2:
		for _, s := range m.cfg.SRIOVInterfaces {
			if s.PluginKind == PluginSRIOVRoCEv2 {
				return s.InterfaceName, s.Driver, s.MTU, 1.15
			}
		}
		return "net3", "mlx5_core", 9000, 1.15
	default:
		return "eth0", "unknown", 1500, 0
	}
}

// SyncHosts ensures all active Metal3 BareMetalHosts are tracked in the CNI state machine.
// If preConverge is true (initial seed for operational nodes), active cluster nodes start converged at READY.
func (m *Manager) SyncHosts(descriptors []HostDescriptor, preConverge bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	for _, h := range descriptors {
		// Only provision CNI on cluster-bound hosts; spare pool hosts remain PENDING until joined
		inCluster := h.ClusterID != "" && h.ProvisioningStatus == "ActiveInCluster"
		existing, exists := m.hosts[h.Name]
		if !exists {
			st := &HostCNIState{
				HostName:      h.Name,
				Role:          h.Role,
				ClusterID:     h.ClusterID,
				Plugins:       make(map[PluginKind]*HostPluginStatus),
				LastReconcile: now,
			}
			for _, pk := range m.pluginsForHostRole(h.Role) {
				iface, driver, mtu, lat := m.specForPluginLocked(pk)
				phase := PhasePending
				obsRev := int64(0)
				healthy := false
				msg := "Awaiting cluster join before CNI binding"
				if inCluster && preConverge {
					phase = PhaseReady
					obsRev = m.cfg.Generation
					healthy = true
					msg = fmt.Sprintf("CNI plugin %s (%s) converged at gen %d", pk, iface, m.cfg.Generation)
				}
				st.Plugins[pk] = &HostPluginStatus{
					Plugin:           pk,
					Interface:        iface,
					Driver:           driver,
					Phase:            phase,
					DesiredRevision:  m.cfg.Generation,
					ObservedRevision: obsRev,
					Drifted:          false,
					Healthy:          healthy,
					MTU:              mtu,
					LatencyUS:        lat,
					Message:          msg,
					LastTransition:   now,
				}
			}
			m.refreshHostAggregateLocked(st)
			m.hosts[h.Name] = st
			continue
		}

		// Update metadata if host joined or left cluster
		existing.Role = h.Role
		existing.ClusterID = h.ClusterID
		if !inCluster && existing.OverallPhase == PhaseReady {
			for _, ps := range existing.Plugins {
				ps.Phase = PhasePending
				ps.Healthy = false
				ps.ObservedRevision = 0
				ps.Message = "Host returned to pool; CNI attachments released"
				ps.LastTransition = now
			}
		}
		m.refreshHostAggregateLocked(existing)
	}
}

func (m *Manager) refreshHostAggregateLocked(st *HostCNIState) {
	ifaces := make([]string, 0, len(st.Plugins))
	allReady := len(st.Plugins) > 0
	anyDegraded := false
	anyDrifted := false
	anyPending := true

	for _, ps := range st.Plugins {
		if ps.Interface != "multus-shim" {
			ifaces = append(ifaces, fmt.Sprintf("%s (%s)", ps.Interface, ps.Plugin))
		}
		if ps.Phase != PhaseReady {
			allReady = false
		}
		if ps.Phase != PhasePending {
			anyPending = false
		}
		if ps.Phase == PhaseDegraded {
			anyDegraded = true
		}
		if ps.Phase == PhaseDrifted || ps.Drifted {
			anyDrifted = true
		}
	}
	sort.Strings(ifaces)
	st.Interfaces = ifaces
	st.Converged = allReady

	switch {
	case anyDegraded:
		st.OverallPhase = PhaseDegraded
	case anyDrifted:
		st.OverallPhase = PhaseDrifted
	case allReady:
		st.OverallPhase = PhaseReady
	case anyPending:
		st.OverallPhase = PhasePending
	default:
		// Pick earliest active reconcile stage
		order := []ReconcilePhase{PhasePreflightCheck, PhaseInstallingDaemonSet, PhaseBindingInterfaces, PhaseVerifyingMesh}
		chosen := PhaseBindingInterfaces
		for _, candidate := range order {
			matched := false
			for _, ps := range st.Plugins {
				if ps.Phase == candidate {
					matched = true
					break
				}
			}
			if matched {
				chosen = candidate
				break
			}
		}
		st.OverallPhase = chosen
	}
}

func (m *Manager) transitionPluginLocked(st *HostCNIState, ps *HostPluginStatus, target ReconcilePhase, reason string) error {
	if !CanTransition(ps.Phase, target) {
		return fmt.Errorf("invalid CNI state transition for %s/%s: %s -> %s", st.HostName, ps.Plugin, ps.Phase, target)
	}
	if ps.Phase == target {
		return nil
	}
	now := time.Now().UTC()
	evt := TransitionEvent{
		ID:        fmt.Sprintf("cni_evt_%d", now.UnixNano()),
		HostName:  st.HostName,
		Plugin:    ps.Plugin,
		FromPhase: ps.Phase,
		ToPhase:   target,
		Reason:    reason,
		Timestamp: now,
	}
	m.events = append([]TransitionEvent{evt}, m.events...)
	if len(m.events) > 80 {
		m.events = m.events[:80]
	}

	ps.Phase = target
	ps.LastTransition = now
	if target == PhaseReady {
		iface, driver, mtu, _ := m.specForPluginLocked(ps.Plugin)
		ps.Interface = iface
		ps.Driver = driver
		ps.MTU = mtu
		ps.ObservedRevision = m.cfg.Generation
		ps.DesiredRevision = m.cfg.Generation
		ps.Drifted = false
		ps.Healthy = true
		ps.Message = reason
	} else {
		ps.Healthy = false
		ps.Message = reason
	}
	return nil
}

// UpdateConfig validates and applies a new desired CNI FleetConfig, bumping DesiredGeneration and marking drifted plugins.
func (m *Manager) UpdateConfig(nextCfg FleetConfig) (FleetSummary, error) {
	if err := ValidateConfig(nextCfg); err != nil {
		return FleetSummary{}, err
	}

	m.mu.Lock()
	nextCfg.Generation = m.cfg.Generation + 1
	nextCfg.UpdatedAt = time.Now().UTC()
	m.cfg = nextCfg

	for _, st := range m.hosts {
		if st.ClusterID == "" {
			continue
		}
		for _, ps := range st.Plugins {
			ps.DesiredRevision = nextCfg.Generation
			if ps.Phase == PhaseReady || ps.Phase == PhasePending {
				ps.Drifted = true
				_ = m.transitionPluginLocked(st, ps, PhaseDrifted, fmt.Sprintf("Config generation %d drifted from observed gen %d", nextCfg.Generation, ps.ObservedRevision))
			}
		}
		m.refreshHostAggregateLocked(st)
	}
	m.mu.Unlock()

	select {
	case m.triggerCh <- struct{}{}:
	default:
	}
	return m.GetFleetSummary(), nil
}

// InjectDrift intentionally puts a host plugin into DRIFTED or DEGRADED state so tests/operators can verify state machine recovery.
func (m *Manager) InjectDrift(hostName string, plugin PluginKind, degraded bool, reason string) (HostCNIState, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	st, ok := m.hosts[hostName]
	if !ok {
		return HostCNIState{}, fmt.Errorf("host %q not found in CNI fleet", hostName)
	}
	if plugin == "" {
		plugin = PluginSRIOVDPDK
	}
	ps, ok := st.Plugins[plugin]
	if !ok {
		return HostCNIState{}, fmt.Errorf("plugin %q not bound on host %q", plugin, hostName)
	}
	target := PhaseDrifted
	if degraded {
		target = PhaseDegraded
	} else {
		ps.Drifted = true
		ps.MTU = 1500 // simulate unexpected MTU drift
	}
	if reason == "" {
		reason = fmt.Sprintf("Detected %s interface drift on %s (%s)", plugin, hostName, ps.Interface)
	}
	if err := m.transitionPluginLocked(st, ps, target, reason); err != nil {
		return HostCNIState{}, err
	}
	m.refreshHostAggregateLocked(st)

	select {
	case m.triggerCh <- struct{}{}:
	default:
	}
	return *st, nil
}

// ReconcileOnce advances every non-converged cluster-bound host by 1 state machine phase.
// Pass hostNames to scope reconciliation to specific nodes (nil/empty reconciles all active hosts).
func (m *Manager) ReconcileOnce(hostNames []string) FleetSummary {
	m.mu.Lock()
	m.reconcileCycles++
	now := time.Now().UTC()

	scope := make(map[string]bool)
	for _, n := range hostNames {
		if n != "" {
			scope[n] = true
		}
	}

	for hostName, st := range m.hosts {
		if len(scope) > 0 && !scope[hostName] {
			continue
		}
		if st.ClusterID == "" {
			continue
		}

		// Detect silent config drift
		for _, ps := range st.Plugins {
			if ps.Phase == PhaseReady && ps.ObservedRevision < m.cfg.Generation {
				ps.Drifted = true
				ps.DesiredRevision = m.cfg.Generation
				_ = m.transitionPluginLocked(st, ps, PhaseDrifted, fmt.Sprintf("Desired generation %d supersedes observed %d", m.cfg.Generation, ps.ObservedRevision))
			}
		}

		// Advance each non-Ready plugin one deterministic step
		for _, ps := range st.Plugins {
			if ps.Phase == PhaseReady {
				continue
			}
			ps.Attempts++
			next := NextPhase(ps.Phase)
			reason := fmt.Sprintf("Reconciler advanced %s (%s) -> %s (gen %d)", ps.Plugin, ps.Interface, next, m.cfg.Generation)
			if next == PhaseReady {
				reason = fmt.Sprintf("Converged %s (%s driver=%s mtu=%d) at generation %d", ps.Plugin, ps.Interface, ps.Driver, ps.MTU, m.cfg.Generation)
			}
			_ = m.transitionPluginLocked(st, ps, next, reason)
		}
		st.LastReconcile = now
		m.refreshHostAggregateLocked(st)
	}
	m.mu.Unlock()

	return m.GetFleetSummary()
}

// ReconcileUntilConverged runs reconcile ticks until all cluster hosts converge or maxSteps is reached.
func (m *Manager) ReconcileUntilConverged(hostNames []string, maxSteps int) FleetSummary {
	if maxSteps <= 0 {
		maxSteps = 8
	}
	var summary FleetSummary
	for i := 0; i < maxSteps; i++ {
		summary = m.ReconcileOnce(hostNames)
		if summary.ReconcilingHosts == 0 && summary.DegradedHosts == 0 {
			break
		}
	}
	return summary
}

// StartReconcileLoop launches a background Kubernetes controller loop that continuously watches for drift.
func (m *Manager) StartReconcileLoop(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 1500 * time.Millisecond
	}
	m.mu.Lock()
	if m.loopRunning {
		m.mu.Unlock()
		return
	}
	m.loopRunning = true
	m.mu.Unlock()

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				m.mu.Lock()
				m.loopRunning = false
				m.mu.Unlock()
				return
			case <-m.triggerCh:
				m.ReconcileOnce(nil)
			case <-ticker.C:
				summary := m.GetFleetSummary()
				if summary.ReconcilingHosts > 0 || summary.DegradedHosts > 0 {
					m.ReconcileOnce(nil)
				}
			}
		}
	}()
}

// GetConfig returns a snapshot of the current declarative FleetConfig.
func (m *Manager) GetConfig() FleetConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.cfg
}

// GetFleetSummary returns a point-in-time snapshot of all hosts' CNI states, events, and rendered manifests.
func (m *Manager) GetFleetSummary() FleetSummary {
	m.mu.RLock()
	defer m.mu.RUnlock()

	hosts := make([]*HostCNIState, 0, len(m.hosts))
	converged := 0
	reconciling := 0
	degraded := 0

	for _, st := range m.hosts {
		// Copy HostCNIState safely
		pluginsCopy := make(map[PluginKind]*HostPluginStatus, len(st.Plugins))
		for k, ps := range st.Plugins {
			pCopy := *ps
			pluginsCopy[k] = &pCopy
		}
		ifacesCopy := append([]string(nil), st.Interfaces...)
		stCopy := &HostCNIState{
			HostName:      st.HostName,
			Role:          st.Role,
			ClusterID:     st.ClusterID,
			OverallPhase:  st.OverallPhase,
			Converged:     st.Converged,
			Interfaces:    ifacesCopy,
			Plugins:       pluginsCopy,
			LastReconcile: st.LastReconcile,
		}
		hosts = append(hosts, stCopy)

		if st.ClusterID == "" {
			continue
		}
		switch {
		case st.Converged:
			converged++
		case st.OverallPhase == PhaseDegraded || st.OverallPhase == PhaseDrifted:
			degraded++
		default:
			reconciling++
		}
	}

	sort.Slice(hosts, func(i, j int) bool {
		return hosts[i].HostName < hosts[j].HostName
	})

	eventsCopy := make([]TransitionEvent, len(m.events))
	copy(eventsCopy, m.events)

	return FleetSummary{
		ClusterID:         m.cfg.ClusterID,
		DesiredGeneration: m.cfg.Generation,
		TotalHosts:        len(hosts),
		ConvergedHosts:    converged,
		ReconcilingHosts:  reconciling,
		DegradedHosts:     degraded,
		ReconcileCycles:   m.reconcileCycles,
		LoopRunning:       m.loopRunning,
		Config:            m.cfg,
		Hosts:             hosts,
		RenderedArtifacts: RenderAllArtifacts(m.cfg),
		Events:            eventsCopy,
		SyncedAt:          time.Now().UTC(),
	}
}
