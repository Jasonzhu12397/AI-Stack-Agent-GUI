package metal3

import (
	"strings"
	"testing"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
)

func TestMultiCNICalicoMultusOVSDPDKAndMultipleDPDKPlanes(t *testing.T) {
	eng := NewEngine()

	spec := eng.GetMultiCNISpec()
	if spec.Multus.Name != "Multus CNI" {
		t.Fatalf("expected Multus CNI meta-plugin, got %s", spec.Multus.Name)
	}
	delegates, _ := spec.Multus.Config["delegates"].([]string)
	if len(delegates) != 4 {
		t.Fatalf("expected 4 multus delegates (calico + ovs-dpdk + multi-dpdk/sriov), got %v", spec.Multus.Config["delegates"])
	}
	if !strings.HasPrefix(spec.Calico.Interface, "eth0") || !strings.Contains(spec.Calico.Name, "Calico") {
		t.Fatalf("expected Calico primary CNI on eth0, got %+v", spec.Calico)
	}
	if spec.OVS.Config["datapath_type"] != "netdev" || spec.OVS.Config["vhost_mode"] != "dpdkvhostuserclient" {
		t.Fatalf("expected OVS-DPDK netdev + dpdkvhostuserclient, got %+v", spec.OVS.Config)
	}
	if len(spec.DPDKPlanes) < 3 {
		t.Fatalf("expected at least 3 DPDK/SR-IOV planes, got %d", len(spec.DPDKPlanes))
	}
	if len(spec.NetworkAttachmentDefinitions) < 4 {
		t.Fatalf("expected 4 Multus NetworkAttachmentDefinitions, got %v", spec.NetworkAttachmentDefinitions)
	}

	// Test CNI connectivity suite returns multus, calico, ovs (netdev), dpdk (vfio-pci), sriov
	conn := eng.TestCNIConnectivity()
	results, ok := conn["results"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected connectivity results map, got %T", conn["results"])
	}
	for _, key := range []string{"multus", "calico", "ovs", "dpdk", "sriov"} {
		if _, exists := results[key]; !exists {
			t.Fatalf("expected %s metrics in TestCNIConnectivity results", key)
		}
	}

	// Test DPDK userspace PMD packet simulation
	sim := eng.SimulatePacketFlow(models.PacketSimulationRequest{TrafficType: "DPDK_USERSPACE_PMD"})
	if sim.TrafficType != "DPDK_USERSPACE_PMD" || !sim.JumboFrames || len(sim.Hops) != 4 {
		t.Fatalf("expected 4-hop Jumbo-Frame DPDK_USERSPACE_PMD simulation, got %+v", sim)
	}
	if !strings.Contains(sim.SelectedPath, "vfio-pci") || !strings.Contains(sim.SelectedPath, "HugePages") {
		t.Fatalf("expected vfio-pci & HugePages in DPDK packet path, got %s", sim.SelectedPath)
	}

	// Test declarative manifests include Multus NADs for calico, ovs-dpdk, dpdk-sriov-vfio-pf0, and sriov-rocev2-mlx5-pf1
	manifests := eng.GetDeclarativeManifests("ai-prod-test", "v1.35.0")
	nadYAML := manifests["02-multus-cni-daemonset.yaml"]
	for _, needle := range []string{"calico-primary", "ovs-dpdk-vlan200", "dpdk-sriov-vfio-pf0", "sriov-rocev2-mlx5-pf1"} {
		if !strings.Contains(nadYAML, needle) {
			t.Fatalf("expected %s in 02-multus-cni-daemonset.yaml", needle)
		}
	}
	podYAML := manifests["03-dual-network-multi-cni-pod.yaml"]
	if !strings.Contains(podYAML, "hugepages-1Gi") || !strings.Contains(podYAML, "intel.com/sriov_dpdk_pf0") {
		t.Fatalf("expected 1Gi HugePages and multiple DPDK/SR-IOV limits in pod YAML")
	}
}
