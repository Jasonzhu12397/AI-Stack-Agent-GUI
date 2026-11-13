package cni

import "time"

// PluginKind identifies a coordinated CNI plugin tier managed on Metal3 baremetal hosts.
type PluginKind string

const (
	PluginMultus      PluginKind = "multus"
	PluginCalico      PluginKind = "calico"
	PluginOVSDPDK     PluginKind = "ovs-dpdk"
	PluginSRIOVDPDK   PluginKind = "sriov-dpdk"
	PluginSRIOVRoCEv2 PluginKind = "sriov-rocev2"
)

// ReconcilePhase represents a deterministic state in the CNI provisioning state machine.
type ReconcilePhase string

const (
	PhasePending             ReconcilePhase = "PENDING"
	PhasePreflightCheck      ReconcilePhase = "PREFLIGHT_CHECK"
	PhaseInstallingDaemonSet ReconcilePhase = "INSTALLING_DAEMONSET"
	PhaseBindingInterfaces   ReconcilePhase = "BINDING_INTERFACES"
	PhaseVerifyingMesh       ReconcilePhase = "VERIFYING_MESH"
	PhaseReady               ReconcilePhase = "READY"
	PhaseDrifted             ReconcilePhase = "DRIFTED"
	PhaseDegraded            ReconcilePhase = "DEGRADED"
)

// HostDescriptor provides the minimal Metal3 baremetal host metadata required by the CNI manager.
type HostDescriptor struct {
	Name               string `json:"name"`
	Role               string `json:"role"` // "control-plane" | "worker-gpu" | "worker-compute"
	ProvisioningStatus string `json:"provisioning_status"`
	PowerStatus        string `json:"power_status"`
	ClusterID          string `json:"cluster_id,omitempty"`
}

// CalicoInterfaceConfig models the default primary pod interface (eth0) and BGP fabric.
type CalicoInterfaceConfig struct {
	InterfaceName       string   `json:"interface_name"`
	Version             string   `json:"version"`
	IPPoolCIDR          string   `json:"ip_pool_cidr"`
	ServiceCIDR         string   `json:"service_cidr"`
	Encapsulation       string   `json:"encapsulation"` // "None" | "VXLAN" | "IPIP"
	MTU                 int      `json:"mtu"`
	BGPASNumber         int      `json:"bgp_as_number"`
	ToRPeers            []string `json:"tor_peers"`
	NetworkPolicyStrict bool     `json:"network_policy_strict"`
	FelixDataPath       string   `json:"felix_datapath"` // "iptables" | "bpf"
}

// MultusInterfaceConfig models the Multus CNI meta-plugin coordinating primary + secondary NICs.
type MultusInterfaceConfig struct {
	Version        string                    `json:"version"`
	CNIVersion     string                    `json:"cni_version"`
	Name           string                    `json:"name"`
	DefaultNetwork string                    `json:"default_network"`
	Delegates      []string                  `json:"delegates"`
	KubeconfigPath string                    `json:"kubeconfig_path"`
	ConfDir        string                    `json:"conf_dir"`
	BinDir         string                    `json:"bin_dir"`
	NADs           []NetworkAttachmentConfig `json:"nads"`
}

// OVSDPDKInterfaceConfig models the OVS-DPDK userspace vhost-user L2 bridge interface (net1).
type OVSDPDKInterfaceConfig struct {
	InterfaceName string `json:"interface_name"`
	Version       string `json:"version"`
	BridgeName    string `json:"bridge_name"`
	DatapathType  string `json:"datapath_type"` // "netdev"
	VhostMode     string `json:"vhost_mode"`    // "dpdkvhostuserclient"
	VLAN          int    `json:"vlan"`
	TrunkVLANs    []int  `json:"trunk_vlans"`
	MTU           int    `json:"mtu"`
	PMDCoreMask   string `json:"pmd_core_mask"`
}

// SRIOVInterfaceConfig models an SR-IOV Physical Function / Virtual Function pool (DPDK PMD or RoCEv2 RDMA).
type SRIOVInterfaceConfig struct {
	PluginKind     PluginKind `json:"plugin_kind"`
	InterfaceName  string     `json:"interface_name"` // e.g., net2 or net3
	PFName         string     `json:"pf_name"`        // e.g., ens1f0, ens1f1
	PCIAddress     string     `json:"pci_address"`    // e.g., 0000:4b:00.0
	VendorDeviceID string     `json:"vendor_device_id"`
	NumVFs         int        `json:"num_vfs"`
	Driver         string     `json:"driver"`        // "vfio-pci" | "mlx5_core"
	ResourceName   string     `json:"resource_name"` // e.g., intel.com/sriov_dpdk_pf0
	VLAN           int        `json:"vlan"`
	MTU            int        `json:"mtu"`
	SubnetCIDR     string     `json:"subnet_cidr"`
	Gateway        string     `json:"gateway"`
	HugePages      string     `json:"hugepages"`
	SpoofCheck     bool       `json:"spoof_check"`
	TrustMode      bool       `json:"trust_mode"`
	RoCEv2PFC      bool       `json:"rocev2_pfc"`
	GPUOnly        bool       `json:"gpu_only"`
}

// NetworkAttachmentConfig models a Kubernetes Multus NetworkAttachmentDefinition CRD.
type NetworkAttachmentConfig struct {
	Name          string     `json:"name"`
	Namespace     string     `json:"namespace"`
	PluginKind    PluginKind `json:"plugin_kind"`
	InterfaceName string     `json:"interface_name"`
	Type          string     `json:"type"`
	Bridge        string     `json:"bridge,omitempty"`
	DatapathType  string     `json:"datapath_type,omitempty"`
	VhostMode     string     `json:"vhost_mode,omitempty"`
	Driver        string     `json:"driver,omitempty"`
	DeviceID      string     `json:"device_id,omitempty"`
	ResourceName  string     `json:"resource_name,omitempty"`
	VLAN          int        `json:"vlan"`
	Subnet        string     `json:"subnet"`
	Gateway       string     `json:"gateway"`
	MTU           int        `json:"mtu"`
}

// FleetConfig defines the complete desired declarative CNI topology for the Metal3 cluster.
type FleetConfig struct {
	ClusterID       string                   `json:"cluster_id"`
	Generation      int64                    `json:"generation"`
	Calico          CalicoInterfaceConfig    `json:"calico"`
	Multus          MultusInterfaceConfig    `json:"multus"`
	OVSDPDK         OVSDPDKInterfaceConfig   `json:"ovs_dpdk"`
	SRIOVInterfaces []SRIOVInterfaceConfig   `json:"sriov_interfaces"`
	UpdatedAt       time.Time                `json:"updated_at"`
}

// HostPluginStatus records the reconciled state of one CNI plugin on a specific BareMetalHost.
type HostPluginStatus struct {
	Plugin           PluginKind     `json:"plugin"`
	Interface        string         `json:"interface"`
	Driver           string         `json:"driver"`
	Phase            ReconcilePhase `json:"phase"`
	DesiredRevision  int64          `json:"desired_revision"`
	ObservedRevision int64          `json:"observed_revision"`
	Drifted          bool           `json:"drifted"`
	Healthy          bool           `json:"healthy"`
	MTU              int            `json:"mtu"`
	LatencyUS        float64        `json:"latency_us"`
	Message          string         `json:"message"`
	Attempts         int            `json:"attempts"`
	LastTransition   time.Time      `json:"last_transition"`
}

// HostCNIState captures aggregated CNI convergence and bound interfaces for a Metal3 host.
type HostCNIState struct {
	HostName      string                         `json:"host_name"`
	Role          string                         `json:"role"`
	ClusterID     string                         `json:"cluster_id,omitempty"`
	OverallPhase  ReconcilePhase                 `json:"overall_phase"`
	Converged     bool                           `json:"converged"`
	Interfaces    []string                       `json:"interfaces"`
	Plugins       map[PluginKind]*HostPluginStatus `json:"plugins"`
	LastReconcile time.Time                      `json:"last_reconcile"`
}

// TransitionEvent records an immutable audit/event log entry for CNI state transitions.
type TransitionEvent struct {
	ID        string         `json:"id"`
	HostName  string         `json:"host_name"`
	Plugin    PluginKind     `json:"plugin"`
	FromPhase ReconcilePhase `json:"from_phase"`
	ToPhase   ReconcilePhase `json:"to_phase"`
	Reason    string         `json:"reason"`
	Timestamp time.Time      `json:"timestamp"`
}

// FleetSummary provides cluster-wide CNI provisioning telemetry and rendered interface artifacts.
type FleetSummary struct {
	ClusterID         string             `json:"cluster_id"`
	DesiredGeneration int64              `json:"desired_generation"`
	TotalHosts        int                `json:"total_hosts"`
	ConvergedHosts    int                `json:"converged_hosts"`
	ReconcilingHosts  int                `json:"reconciling_hosts"`
	DegradedHosts     int                `json:"degraded_hosts"`
	ReconcileCycles   int64              `json:"reconcile_cycles"`
	LoopRunning       bool               `json:"loop_running"`
	Config            FleetConfig        `json:"config"`
	Hosts             []*HostCNIState    `json:"hosts"`
	RenderedArtifacts map[string]string  `json:"rendered_artifacts"`
	Events            []TransitionEvent  `json:"events"`
	SyncedAt          time.Time          `json:"synced_at"`
}
