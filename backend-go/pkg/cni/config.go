package cni

import (
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"time"
)

// DefaultFleetConfig returns the canonical production Calico + Multus + OVS-DPDK + Multi-SR-IOV/DPDK config.
func DefaultFleetConfig(clusterID string) FleetConfig {
	if clusterID == "" {
		clusterID = "cluster-prod-gpu-k8s"
	}

	nads := []NetworkAttachmentConfig{
		{
			Name:          "calico-primary",
			Namespace:     "default",
			PluginKind:    PluginCalico,
			InterfaceName: "eth0",
			Type:          "calico",
			Subnet:        "172.16.0.0/16",
			Gateway:       "172.16.0.1",
			MTU:           1500,
		},
		{
			Name:          "ovs-dpdk-vlan200",
			Namespace:     "default",
			PluginKind:    PluginOVSDPDK,
			InterfaceName: "net1",
			Type:          "ovs",
			Bridge:        "br-data",
			DatapathType:  "netdev",
			VhostMode:     "dpdkvhostuserclient",
			Driver:        "openvswitch-dpdk",
			VLAN:          200,
			Subnet:        "10.250.0.0/16",
			Gateway:       "10.250.0.1",
			MTU:           9000,
		},
		{
			Name:          "dpdk-sriov-vfio-pf0",
			Namespace:     "default",
			PluginKind:    PluginSRIOVDPDK,
			InterfaceName: "net2",
			Type:          "sriov",
			Driver:        "vfio-pci",
			DeviceID:      "0000:4b:02.0",
			ResourceName:  "intel.com/sriov_dpdk_pf0",
			VLAN:          300,
			Subnet:        "10.250.80.0/24",
			Gateway:       "10.250.80.1",
			MTU:           9000,
		},
		{
			Name:          "sriov-rocev2-mlx5-pf1",
			Namespace:     "default",
			PluginKind:    PluginSRIOVRoCEv2,
			InterfaceName: "net3",
			Type:          "sriov",
			Driver:        "mlx5_core",
			DeviceID:      "0000:98:04.0",
			ResourceName:  "mellanox.com/cx7_rocev2_pf1",
			VLAN:          301,
			Subnet:        "10.250.100.0/24",
			Gateway:       "10.250.100.1",
			MTU:           9000,
		},
	}

	return FleetConfig{
		ClusterID:  clusterID,
		Generation: 1,
		Calico: CalicoInterfaceConfig{
			InterfaceName:       "eth0",
			Version:             "v3.28.1",
			IPPoolCIDR:          "172.16.0.0/16",
			ServiceCIDR:         "10.96.0.0/12",
			Encapsulation:       "None",
			MTU:                 1500,
			BGPASNumber:         65001,
			ToRPeers:            []string{"10.240.10.253", "10.240.10.254"},
			NetworkPolicyStrict: true,
			FelixDataPath:       "iptables",
		},
		Multus: MultusInterfaceConfig{
			Version:        "v4.1.0",
			CNIVersion:     "0.4.0",
			Name:           "multus-cni-network",
			DefaultNetwork: "calico-primary",
			Delegates:      []string{"calico", "ovs-dpdk", "dpdk-sriov-pf0", "sriov-rocev2-pf1"},
			KubeconfigPath: "/etc/cni/net.d/multus.d/multus.kubeconfig",
			ConfDir:        "/etc/cni/net.d",
			BinDir:         "/opt/cni/bin",
			NADs:           nads,
		},
		OVSDPDK: OVSDPDKInterfaceConfig{
			InterfaceName: "net1",
			Version:       "v2.17.8 / DPDK 24.11",
			BridgeName:    "br-data",
			DatapathType:  "netdev",
			VhostMode:     "dpdkvhostuserclient",
			VLAN:          200,
			TrunkVLANs:    []int{100, 200, 300, 301},
			MTU:           9000,
			PMDCoreMask:   "0x3c",
		},
		SRIOVInterfaces: []SRIOVInterfaceConfig{
			{
				PluginKind:     PluginSRIOVDPDK,
				InterfaceName:  "net2",
				PFName:         "ens1f0",
				PCIAddress:     "0000:4b:00.0",
				VendorDeviceID: "8086:1592",
				NumVFs:         32,
				Driver:         "vfio-pci",
				ResourceName:   "intel.com/sriov_dpdk_pf0",
				VLAN:           300,
				MTU:            9000,
				SubnetCIDR:     "10.250.80.0/24",
				Gateway:        "10.250.80.1",
				HugePages:      "8Gi (1Gi)",
				SpoofCheck:     false,
				TrustMode:      true,
				RoCEv2PFC:      false,
				GPUOnly:        false,
			},
			{
				PluginKind:     PluginSRIOVRoCEv2,
				InterfaceName:  "net3",
				PFName:         "ens2f0",
				PCIAddress:     "0000:98:00.0",
				VendorDeviceID: "15b3:1021",
				NumVFs:         32,
				Driver:         "mlx5_core",
				ResourceName:   "mellanox.com/cx7_rocev2_pf1",
				VLAN:           301,
				MTU:            9000,
				SubnetCIDR:     "10.250.100.0/24",
				Gateway:        "10.250.100.1",
				HugePages:      "N/A (GPU BAR1 DMA)",
				SpoofCheck:     false,
				TrustMode:      true,
				RoCEv2PFC:      true,
				GPUOnly:        true,
			},
		},
		UpdatedAt: time.Now().UTC(),
	}
}

// ValidateConfig checks structural and networking invariants across Calico, Multus, OVS-DPDK, and SR-IOV.
func ValidateConfig(cfg FleetConfig) error {
	if strings.TrimSpace(cfg.ClusterID) == "" {
		return fmt.Errorf("cluster_id cannot be empty")
	}
	if _, _, err := net.ParseCIDR(cfg.Calico.IPPoolCIDR); err != nil {
		return fmt.Errorf("invalid calico ip_pool_cidr %q: %w", cfg.Calico.IPPoolCIDR, err)
	}
	if cfg.Calico.MTU < 1280 || cfg.Calico.MTU > 9000 {
		return fmt.Errorf("calico mtu %d out of range [1280..9000]", cfg.Calico.MTU)
	}
	if cfg.Calico.BGPASNumber < 64512 || cfg.Calico.BGPASNumber > 65534 {
		return fmt.Errorf("calico bgp_as_number %d must use private 2-byte AS [64512..65534]", cfg.Calico.BGPASNumber)
	}

	if strings.TrimSpace(cfg.Multus.DefaultNetwork) == "" {
		return fmt.Errorf("multus default_network cannot be empty")
	}
	hasCalicoDelegate := false
	for _, d := range cfg.Multus.Delegates {
		if strings.Contains(strings.ToLower(d), "calico") {
			hasCalicoDelegate = true
			break
		}
	}
	if !hasCalicoDelegate {
		return fmt.Errorf("multus delegates must include primary calico delegate")
	}

	if cfg.OVSDPDK.BridgeName == "" || cfg.OVSDPDK.DatapathType != "netdev" {
		return fmt.Errorf("ovs-dpdk requires valid bridge_name and datapath_type=netdev")
	}
	if cfg.OVSDPDK.MTU < 1500 || cfg.OVSDPDK.MTU > 9000 {
		return fmt.Errorf("ovs-dpdk mtu %d out of range [1500..9000]", cfg.OVSDPDK.MTU)
	}

	if len(cfg.SRIOVInterfaces) == 0 {
		return fmt.Errorf("at least one sriov interface plane is required")
	}
	for _, s := range cfg.SRIOVInterfaces {
		if s.NumVFs < 1 || s.NumVFs > 128 {
			return fmt.Errorf("sriov %s num_vfs %d out of range [1..128]", s.InterfaceName, s.NumVFs)
		}
		if s.Driver != "vfio-pci" && s.Driver != "mlx5_core" {
			return fmt.Errorf("sriov %s unsupported driver %q (expected vfio-pci or mlx5_core)", s.InterfaceName, s.Driver)
		}
		if s.MTU < 1500 || s.MTU > 9000 {
			return fmt.Errorf("sriov %s mtu %d out of range [1500..9000]", s.InterfaceName, s.MTU)
		}
		if _, _, err := net.ParseCIDR(s.SubnetCIDR); err != nil {
			return fmt.Errorf("sriov %s invalid subnet_cidr %q: %w", s.InterfaceName, s.SubnetCIDR, err)
		}
	}
	return nil
}

// RenderMultusMasterConfig serializes /etc/cni/net.d/00-multus.conf JSON delegating Calico + OVS-DPDK + SR-IOV.
func RenderMultusMasterConfig(cfg FleetConfig) (string, error) {
	payload := map[string]interface{}{
		"cniVersion":     cfg.Multus.CNIVersion,
		"name":           cfg.Multus.Name,
		"type":           "multus",
		"kubeconfig":     cfg.Multus.KubeconfigPath,
		"logLevel":       "verbose",
		"readinessindicatorfile": "/var/run/multus/ready",
		"delegates": []map[string]interface{}{
			{
				"cniVersion": "0.3.1",
				"name":       "k8s-pod-network",
				"type":       "calico",
				"mtu":        cfg.Calico.MTU,
				"ipam": map[string]interface{}{
					"type": "calico-ipam",
				},
				"policy": map[string]interface{}{
					"type": "k8s",
				},
			},
		},
	}
	b, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// RenderCalicoBGPManifest renders the Calico IPPool & BGPConfiguration YAML for eth0.
func RenderCalicoBGPManifest(c CalicoInterfaceConfig) string {
	peers := strings.Builder{}
	for idx, p := range c.ToRPeers {
		peers.WriteString(fmt.Sprintf(`---
apiVersion: projectcalico.org/v3
kind: BGPPeer
metadata:
  name: tor-spine-peer-%02d
spec:
  peerIP: %s
  asNumber: %d
`, idx+1, p, c.BGPASNumber))
	}

	return fmt.Sprintf(`apiVersion: projectcalico.org/v3
kind: IPPool
metadata:
  name: default-ipv4-ippool
spec:
  cidr: %s
  ipipMode: Never
  vxlanMode: Never
  natOutgoing: true
  nodeSelector: all()
---
apiVersion: projectcalico.org/v3
kind: BGPConfiguration
metadata:
  name: default
spec:
  logSeverityScreen: Info
  nodeToNodeMeshEnabled: true
  asNumber: %d
%s`, c.IPPoolCIDR, c.BGPASNumber, peers.String())
}

// RenderSRIOVNodePolicy renders a SriovNetworkNodePolicy YAML for either vfio-pci DPDK or mlx5_core RoCEv2.
func RenderSRIOVNodePolicy(s SRIOVInterfaceConfig) string {
	devType := "netdevice"
	if s.Driver == "vfio-pci" {
		devType = "vfio-pci"
	}
	policyName := fmt.Sprintf("policy-%s-%s", s.InterfaceName, strings.ReplaceAll(s.Driver, "_", "-"))
	return fmt.Sprintf(`apiVersion: sriovnetwork.openshift.io/v1
kind: SriovNetworkNodePolicy
metadata:
  name: %s
  namespace: sriov-network-operator
spec:
  resourceName: %s
  nodeSelector:
    feature.node.kubernetes.io/network-sriov.capable: "true"
  priority: 10
  mtu: %d
  numVfs: %d
  nicSelector:
    pfNames: ["%s"]
    rootDevices: ["%s"]
  deviceType: %s
  isRdma: %t`,
		policyName,
		strings.TrimPrefix(s.ResourceName, "intel.com/"),
		s.MTU,
		s.NumVFs,
		s.PFName,
		s.PCIAddress,
		devType,
		s.RoCEv2PFC,
	)
}

// RenderNetworkAttachmentYAML renders a k8s.cni.cncf.io/v1 NetworkAttachmentDefinition YAML.
func RenderNetworkAttachmentYAML(n NetworkAttachmentConfig) string {
	cfgMap := map[string]interface{}{
		"cniVersion": "0.4.0",
		"type":       n.Type,
		"mtu":        n.MTU,
	}
	if n.VLAN > 0 {
		cfgMap["vlan"] = n.VLAN
	}
	if n.Bridge != "" {
		cfgMap["bridge"] = n.Bridge
	}
	if n.DatapathType != "" {
		cfgMap["datapath_type"] = n.DatapathType
	}
	if n.VhostMode != "" {
		cfgMap["vhost_mode"] = n.VhostMode
	}
	if n.Driver != "" && n.Type == "sriov" {
		cfgMap["driver"] = n.Driver
	}
	if n.DeviceID != "" {
		cfgMap["deviceID"] = n.DeviceID
	}
	if n.Type == "calico" {
		cfgMap["cniVersion"] = "0.3.1"
		cfgMap["ipam"] = map[string]interface{}{"type": "calico-ipam"}
	} else {
		cfgMap["ipam"] = map[string]interface{}{
			"type":    "host-local",
			"subnet":  n.Subnet,
			"gateway": n.Gateway,
		}
	}

	rawCfg, _ := json.Marshal(cfgMap)
	annotations := ""
	if n.ResourceName != "" {
		annotations = fmt.Sprintf("\n  annotations:\n    k8s.v1.cni.cncf.io/resourceName: %s", n.ResourceName)
	}
	return fmt.Sprintf(`apiVersion: k8s.cni.cncf.io/v1
kind: NetworkAttachmentDefinition
metadata:
  name: %s
  namespace: %s%s
spec:
  config: '%s'`, n.Name, n.Namespace, annotations, string(rawCfg))
}

// RenderAllArtifacts produces a deterministic map of rendered CNI configs for operators and diagnostics.
func RenderAllArtifacts(cfg FleetConfig) map[string]string {
	out := make(map[string]string)
	if multusJSON, err := RenderMultusMasterConfig(cfg); err == nil {
		out["00-multus.conf"] = multusJSON
	}
	out["01-calico-bgp.yaml"] = RenderCalicoBGPManifest(cfg.Calico)

	var nadDocs []string
	for _, n := range cfg.Multus.NADs {
		nadDocs = append(nadDocs, RenderNetworkAttachmentYAML(n))
	}
	out["02-multus-nads.yaml"] = strings.Join(nadDocs, "\n---\n")

	var sriovDocs []string
	for _, s := range cfg.SRIOVInterfaces {
		sriovDocs = append(sriovDocs, RenderSRIOVNodePolicy(s))
	}
	out["03-sriov-node-policies.yaml"] = strings.Join(sriovDocs, "\n---\n")
	return out
}
