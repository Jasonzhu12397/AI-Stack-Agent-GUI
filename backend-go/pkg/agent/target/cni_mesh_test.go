package target

import (
	"context"
	"testing"
)

func TestMultiCNIMeshManagerFourTiers(t *testing.T) {
	mgr := NewMultiCNIMeshManager("")
	topo := mgr.GetMeshTopology()

	for _, requiredKey := range []string{
		"calico-pod-cni",
		"ovs-dpdk-br-data",
		"dpdk-sriov-pf0",
		"mellanox-sriov-rocev2",
	} {
		plugin, ok := topo[requiredKey]
		if !ok {
			t.Fatalf("expected CNI mesh plugin %q to be seeded", requiredKey)
		}
		if plugin.Status != "ACTIVE" {
			t.Fatalf("expected plugin %q ACTIVE, got %s", requiredKey, plugin.Status)
		}
	}

	ok, logs, err := mgr.VerifyMeshConvergence(context.Background())
	if err != nil || !ok || len(logs) != 4 {
		t.Fatalf("expected all 4 CNI tiers converged cleanly, got ok=%v logs=%d err=%v", ok, len(logs), err)
	}
}
