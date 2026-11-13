package cni

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestValidateConfigAndManifestRendering(t *testing.T) {
	cfg := DefaultFleetConfig("cluster-prod-gpu-k8s")
	if err := ValidateConfig(cfg); err != nil {
		t.Fatalf("expected default fleet config to be valid, got err=%v", err)
	}

	artifacts := RenderAllArtifacts(cfg)
	var multusDoc map[string]interface{}
	if err := json.Unmarshal([]byte(artifacts["00-multus.conf"]), &multusDoc); err != nil {
		t.Fatalf("expected valid JSON in 00-multus.conf, got err=%v", err)
	}
	if multusDoc["type"] != "multus" {
		t.Fatalf("expected multus type in 00-multus.conf, got %v", multusDoc["type"])
	}
	for _, needle := range []string{"65001", "tor-spine-peer-01"} {
		if !strings.Contains(artifacts["01-calico-bgp.yaml"], needle) {
			t.Fatalf("expected %s in 01-calico-bgp.yaml", needle)
		}
	}
	for _, needle := range []string{"calico-primary", "ovs-dpdk-vlan200", "dpdk-sriov-vfio-pf0", "sriov-rocev2-mlx5-pf1"} {
		if !strings.Contains(artifacts["02-multus-nads.yaml"], needle) {
			t.Fatalf("expected NAD %s in 02-multus-nads.yaml", needle)
		}
	}
	for _, needle := range []string{"deviceType: vfio-pci", "isRdma: true"} {
		if !strings.Contains(artifacts["03-sriov-node-policies.yaml"], needle) {
			t.Fatalf("expected %s in 03-sriov-node-policies.yaml", needle)
		}
	}

	// Negative invariant checks
	badCIDR := cfg
	badCIDR.Calico.IPPoolCIDR = "not-a-cidr"
	if err := ValidateConfig(badCIDR); err == nil {
		t.Fatalf("expected invalid Calico IPPoolCIDR to fail validation")
	}

	badMultus := cfg
	badMultus.Multus.Delegates = []string{"ovs-dpdk"}
	if err := ValidateConfig(badMultus); err == nil {
		t.Fatalf("expected Multus without primary calico delegate to fail validation")
	}

	badSRIOV := cfg
	badSRIOV.SRIOVInterfaces = []SRIOVInterfaceConfig{cfg.SRIOVInterfaces[0]}
	badSRIOV.SRIOVInterfaces[0].Driver = "invalid-driver"
	if err := ValidateConfig(badSRIOV); err == nil {
		t.Fatalf("expected invalid SR-IOV driver to fail validation")
	}
}

func TestStateMachineTransitionsAndFleetReconciliation(t *testing.T) {
	// Verify transition graph rejects illegal direct jumps
	if CanTransition(PhasePending, PhaseReady) {
		t.Fatalf("illegal direct jump PENDING -> READY must be rejected")
	}
	if CanTransition(PhaseDegraded, PhaseReady) {
		t.Fatalf("illegal direct jump DEGRADED -> READY must be rejected")
	}
	if !CanTransition(PhasePending, PhasePreflightCheck) || !CanTransition(PhaseDrifted, PhaseBindingInterfaces) {
		t.Fatalf("expected valid happy-path and recovery transitions to be permitted")
	}

	mgr := NewManager("cluster-prod-gpu-k8s")
	hosts := []HostDescriptor{
		{Name: "bmh-master-k8s-01", Role: "control-plane", ProvisioningStatus: "ActiveInCluster", PowerStatus: "ON", ClusterID: "cluster-prod-gpu-k8s"},
		{Name: "bmh-worker-k8s-01", Role: "worker-gpu", ProvisioningStatus: "ActiveInCluster", PowerStatus: "ON", ClusterID: "cluster-prod-gpu-k8s"},
		{Name: "bmh-spare-pool-01", Role: "worker-compute", ProvisioningStatus: "Available", PowerStatus: "ON", ClusterID: ""},
	}

	// Seed un-converged active hosts -> should reconcile cleanly step by step to READY
	mgr.SyncHosts(hosts, false)
	s0 := mgr.GetFleetSummary()
	if s0.ConvergedHosts != 0 || s0.TotalHosts != 3 {
		t.Fatalf("expected 0 converged and 3 total hosts initially, got %+v", s0)
	}

	// Converge all active cluster hosts; spare pool host stays PENDING
	sConv := mgr.ReconcileUntilConverged(nil, 10)
	if sConv.ConvergedHosts != 2 || sConv.DegradedHosts != 0 || sConv.ReconcilingHosts != 0 {
		t.Fatalf("expected 2 cluster hosts converged cleanly, got converged=%d reconciling=%d degraded=%d",
			sConv.ConvergedHosts, sConv.ReconcilingHosts, sConv.DegradedHosts)
	}

	// Ensure GPU worker has 5 plugins (including sriov-rocev2) and spare stays PENDING
	for _, hs := range sConv.Hosts {
		switch hs.HostName {
		case "bmh-worker-k8s-01":
			if len(hs.Plugins) != 5 || hs.OverallPhase != PhaseReady || !hs.Converged {
				t.Fatalf("expected bmh-worker-k8s-01 READY with 5 plugins, got phase=%s plugins=%d", hs.OverallPhase, len(hs.Plugins))
			}
		case "bmh-master-k8s-01":
			if len(hs.Plugins) != 4 || hs.OverallPhase != PhaseReady {
				t.Fatalf("expected bmh-master-k8s-01 READY with 4 plugins, got phase=%s plugins=%d", hs.OverallPhase, len(hs.Plugins))
			}
		case "bmh-spare-pool-01":
			if hs.OverallPhase != PhasePending {
				t.Fatalf("expected unjoined spare host to remain PENDING, got %s", hs.OverallPhase)
			}
		}
	}

	// Inject SR-IOV DPDK interface drift on GPU worker -> Reconcile recovers back to READY MTU 9000
	drifted, err := mgr.InjectDrift("bmh-worker-k8s-01", PluginSRIOVDPDK, false, "Unexpected MTU downgrade to 1500")
	if err != nil || drifted.OverallPhase != PhaseDrifted || drifted.Converged {
		t.Fatalf("expected bmh-worker-k8s-01 in DRIFTED state, got err=%v state=%+v", err, drifted)
	}

	sRecovered := mgr.ReconcileUntilConverged([]string{"bmh-worker-k8s-01"}, 6)
	if sRecovered.ConvergedHosts != 2 || sRecovered.DegradedHosts != 0 {
		t.Fatalf("expected bmh-worker-k8s-01 to recover cleanly, got converged=%d degraded=%d", sRecovered.ConvergedHosts, sRecovered.DegradedHosts)
	}
	for _, hs := range sRecovered.Hosts {
		if hs.HostName == "bmh-worker-k8s-01" {
			ps := hs.Plugins[PluginSRIOVDPDK]
			if ps.Phase != PhaseReady || ps.MTU != 9000 || ps.Drifted {
				t.Fatalf("expected sriov-dpdk restored to READY MTU 9000, got %+v", ps)
			}
		}
	}

	// Update config generation -> triggers drift across active cluster hosts -> background loop converges
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	mgr.StartReconcileLoop(ctx, 25*time.Millisecond)

	nextCfg := mgr.GetConfig()
	nextCfg.Calico.BGPASNumber = 65010
	nextCfg.SRIOVInterfaces[0].NumVFs = 64
	sUpd, err := mgr.UpdateConfig(nextCfg)
	if err != nil {
		t.Fatalf("UpdateConfig failed: %v", err)
	}
	if sUpd.DesiredGeneration != 2 {
		t.Fatalf("expected generation=2, got %d", sUpd.DesiredGeneration)
	}

	// Wait briefly for background reconcile loop to converge generation 2
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		cur := mgr.GetFleetSummary()
		if cur.ConvergedHosts == 2 && cur.ReconcilingHosts == 0 && cur.DegradedHosts == 0 {
			if len(cur.Events) == 0 {
				t.Fatalf("expected transition events recorded during convergence")
			}
			return
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for background CNI reconcile loop to converge generation 2: %+v", mgr.GetFleetSummary())
}
