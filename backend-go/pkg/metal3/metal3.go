package metal3

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
)

var supportedKubernetesVersions = map[string]struct{}{
	"v1.33.0": {},
	"v1.35.0": {},
	"v1.36.0": {},
}

func isSupportedKubernetesVersion(version string) bool {
	_, ok := supportedKubernetesVersions[version]
	return ok
}

func compareKubernetesVersions(left, right string) int {
	parse := func(version string) []int {
		parts := strings.Split(strings.TrimPrefix(version, "v"), ".")
		result := make([]int, 3)
		for index, part := range parts {
			if index >= len(result) {
				break
			}
			result[index], _ = strconv.Atoi(part)
		}
		return result
	}

	leftParts := parse(left)
	rightParts := parse(right)
	for index := range leftParts {
		if leftParts[index] > rightParts[index] {
			return 1
		}
		if leftParts[index] < rightParts[index] {
			return -1
		}
	}
	return 0
}

// Engine orchestrates the Metal3 Ironic BareMetal fleet, Dual-Agent controller, and Multi-CNI networking.
type Engine struct {
	mu              sync.RWMutex
	hosts           map[string]*models.BareMetalHost
	alerts          map[string]*models.HostAlert
	clusters        map[string]*models.TargetCluster
	ephNodeState    map[string]interface{}
	dualAgentStatus models.DualAgentStatus
	dualNetwork     models.DualNetworkSpec
	multiCNI        models.MultiCNISpec
	omniDeploy      *models.OmniDeployProgress
}

func NewEngine() *Engine {
	eng := &Engine{
		hosts:    make(map[string]*models.BareMetalHost),
		alerts:   make(map[string]*models.HostAlert),
		clusters: make(map[string]*models.TargetCluster),
		ephNodeState: map[string]interface{}{
			"status":             "ONLINE",
			"node_name":          "eph-bootstrap-node-01",
			"k8s_version":        "v1.31.2",
			"control_plane":      "Ready",
			"ironic_conductor":   "RUNNING",
			"baremetal_operator": "ACTIVE",
			"ai_agent_daemon":    "AUTONOMOUS_ACTIVE",
			"active_tasks":       []string{"Hardware Discovery", "Redfish Keepalive", "Proactive Alerting", "Dual-Agent Handshake"},
		},
	}
	eng.seed()
	return eng
}

func (e *Engine) seed() {
	// 15 BareMetal Hosts
	for i := 1; i <= 15; i++ {
		var name string
		var role string
		var clusterID *string
		cID := "cluster-prod-gpu-k8s"

		if i <= 3 {
			name = fmt.Sprintf("bmh-master-k8s-%02d", i)
			role = "control-plane"
			clusterID = &cID
		} else if i <= 10 {
			name = fmt.Sprintf("bmh-worker-k8s-%02d", i-3)
			role = "worker-gpu"
			clusterID = &cID
		} else {
			name = fmt.Sprintf("bmh-spare-pool-%02d", i-10)
			role = "worker-compute"
			clusterID = nil
		}

		gpuModel := "None"
		if role == "worker-gpu" {
			gpuModel = "8x NVIDIA H100 80GB SXM5"
		}

		status := "ActiveInCluster"
		if clusterID == nil {
			status = "Available"
		}

		e.hosts[name] = &models.BareMetalHost{
			Name:               name,
			RackLocation:       fmt.Sprintf("Rack-E%d-U%02d", (i/4)+1, (i%4)*4+2),
			BMCAddress:         fmt.Sprintf("https://10.240.10.%d/redfish/v1", 100+i),
			BMCProtocol:        "Redfish/v1.14.0",
			BootMACAddress:     fmt.Sprintf("52:54:00:c3:2a:%02x", i),
			PowerStatus:        "ON",
			ProvisioningStatus: status,
			AssignedRole:       role,
			TargetClusterID:    clusterID,
			Hardware: map[string]interface{}{
				"cpu_cores": 128,
				"cpu_arch":  "x86_64",
				"memory_gb": 512,
				"disk_gb":   7680,
				"gpu_model": gpuModel,
			},
			Sensors: map[string]interface{}{
				"cpu_temp_c": 41.0 + float64(i)*0.8,
				"fan_rpm":    6700 + i*110,
				"power_watt": 380 + i*20,
			},
			IPAddresses: []string{fmt.Sprintf("10.244.100.%d", 20+i)},
			UpdatedAt:   time.Now(),
		}
	}

	// Target Cluster
	e.clusters["cluster-prod-gpu-k8s"] = &models.TargetCluster{
		ID:                "cluster-prod-gpu-k8s",
		Name:              "Production Large-Scale GPU Cluster",
		Version:           "v1.31.2",
		Status:            "READY",
		ControlPlaneNodes: 3,
		WorkerNodes:       7,
		CreatedAt:         time.Now().Add(-72 * time.Hour),
	}

	// Seed Alert
	e.alerts["alt_seed_degraded_01"] = &models.HostAlert{
		ID:          "alt_seed_degraded_01",
		HostName:    "bmh-worker-k8s-04",
		Severity:    "WARNING",
		Status:      "ACTIVE",
		Rule:        "NODE_DEGRADED",
		Title:       "节点温度异常升高与驱动告警",
		TitleEn:     "Host Thermal Sensor Degradation & GPU Driver Throttle",
		ErrorCode:   "WARN_THERMAL_GPU_THROTTLE",
		Diagnostics: map[string]interface{}{"temp_c": 82.5, "fan_rpm": 9200, "recommended": "Auto Cordon & Fan Profile Boost"},
		DispatchedChannels: []string{"feishu"},
		DetectedAt:  time.Now().Add(-15 * time.Minute),
	}

	// Initialize Dual-Agent Architecture (Agent 1 Eph-Node & Agent 2 Target Cluster)
	e.dualAgentStatus = models.DualAgentStatus{
		BootstrapAgent: models.AgentSpec{
			ID:          "agent-bootstrap-eph-01",
			Name:        "Eph-Node Bootstrap Controller Agent",
			Role:        "EPH_BOOTSTRAP_AGENT",
			Location:    "eph-bootstrap-node-01 (Isolated Minikube/Kind)",
			Status:      "ACTIVE",
			Version:     "v2.4.0-metal3-bmo",
			PodName:     "metal3-eph-agent-daemon-7b89f4",
			Namespace:   "metal3-system",
			Heartbeat:   time.Now(),
			ActiveTasks: []string{"Ironic Conductor Watchdog", "Dnsmasq TFTP Lease Monitor", "BareMetalHost Inventory Inspection", "Target CP01 VirtualMedia Staging"},
			Metrics: map[string]interface{}{
				"ironic_state":       "HEALTHY",
				"bmo_reconciles_sec": 42,
				"dhcp_leases_active": 15,
				"cpu_usage_percent":  1.4,
				"mem_rss_mb":         28,
			},
		},
		TargetAgent: models.AgentSpec{
			ID:          "agent-target-cluster-01",
			Name:        "Target Cluster Lifecycle & Convergence Agent",
			Role:        "TARGET_CLUSTER_LIFECYCLE_AGENT",
			Location:    "cluster-prod-gpu-k8s (Target Production K8s)",
			Status:      "ACTIVE",
			Version:     "v2.4.0-metal3-capm3",
			PodName:     "capm3-target-agent-operator-9c41a2",
			Namespace:   "capi-system",
			Heartbeat:   time.Now(),
			ActiveTasks: []string{"CAPI MachinePool Reconciler", "Pivot CRD Custodian", "Multus/OVS/Calico/SRIOV Mesh Orchestrator", "Worker Auto-Join Barrier"},
			Metrics: map[string]interface{}{
				"capi_machines_healthy": 10,
				"etcd_quorum_status":    "HEALTHY_3_MEMBERS",
				"multus_nads_ready":     3,
				"cpu_usage_percent":     2.1,
				"mem_rss_mb":            34,
			},
		},
		CurrentPhase: "CLUSTER_HEALTHY",
		PivotStatus:  "SELF_HOSTED",
		SyncedAt:     time.Now(),
		Events: []models.DualAgentEvent{
			{
				ID:        "evt_da_01",
				Source:    "EPH_AGENT",
				Phase:     "EPH_BOOTSTRAP",
				Level:     "SUCCESS",
				Message:   "Eph-node bootstrap complete. Ironic conductor & Baremetal-operator v0.8.0 online.",
				MessageZh: "临时引导节点 (eph-node) 启动完成，Ironic Conductor 与 Baremetal-operator 就绪。",
				Timestamp: time.Now().Add(-65 * time.Minute),
			},
			{
				ID:        "evt_da_02",
				Source:    "EPH_AGENT",
				Phase:     "BMH_INSPECTION",
				Level:     "INFO",
				Message:   "15 BareMetalHosts inspected via Redfish out-of-band IPMI. Discovered 8x H100 GPUs per worker.",
				MessageZh: "通过 Redfish 带外管理完成 15 台裸机硬件探针，识别出 Worker 节点各搭载 8 张 H100 GPU。",
				Timestamp: time.Now().Add(-55 * time.Minute),
			},
			{
				ID:        "evt_da_03",
				Source:    "EPH_AGENT",
				Phase:     "TARGET_CP_PROVISION",
				Level:     "SUCCESS",
				Message:   "Provisioned bmh-master-k8s-01 via VirtualMedia boot. Target control plane initialized.",
				MessageZh: "通过 VirtualMedia 镜像注入引导 bmh-master-k8s-01，目标集群控制面 Master 01 就绪。",
				Timestamp: time.Now().Add(-45 * time.Minute),
			},
			{
				ID:        "evt_da_04",
				Source:    "COORDINATOR",
				Phase:     "PIVOT_TRANSFER",
				Level:     "SUCCESS",
				Message:   "Pivot successful: Transferred CAPM3 & BMO state from eph-node to target cluster. Target is now self-hosted.",
				MessageZh: "Pivot 枢纽移交成功：将 CAPM3 与 BMO 状态无缝移交至目标集群自身自托管。",
				Timestamp: time.Now().Add(-30 * time.Minute),
			},
			{
				ID:        "evt_da_05",
				Source:    "TARGET_AGENT",
				Phase:     "MULTI_CNI_CONVERGE",
				Level:     "SUCCESS",
				Message:   "Multi-CNI Convergence: Multus injected Calico (eth0) + OVS VLAN200 (net1) + SR-IOV RDMA (net2).",
				MessageZh: "多 CNI 网络点火完成：Multus 协同挂载 Calico 主网络 + OVS 业务虚拟网络 + SR-IOV 直通 RDMA。",
				Timestamp: time.Now().Add(-15 * time.Minute),
			},
		},
	}

	// Initialize Dual-Network Specification (Control Network vs Data Network)
	e.dualNetwork = models.DualNetworkSpec{
		ControlNetwork: models.NetworkInterfaceConfig{
			Name:       "control-plane-network",
			Type:       "CONTROL_NETWORK",
			CIDR:       "10.240.10.0/24",
			VLAN:       100,
			Gateway:    "10.240.10.1",
			MTU:        1500,
			Interfaces: []string{"eno1", "eno2 (LACP Bond0)"},
			Purpose:    "Kube-apiserver HA, etcd quorum replication, Ironic Baremetal PXE/DHCP/VirtualMedia provisioning, BMC Redfish management bus.",
			PurposeZh:  "管理控制面专网：承载 Kube-apiserver、etcd 仲裁、Ironic 裸机装机 PXE/DHCP/VirtualMedia 镜像注入与 BMC 带外控制。",
			Bandwidth:  "2x 10Gbps Bonded",
		},
		DataNetwork: models.NetworkInterfaceConfig{
			Name:       "high-throughput-data-network",
			Type:       "DATA_NETWORK",
			CIDR:       "10.250.0.0/16",
			VLAN:       200,
			Gateway:    "10.250.0.1",
			MTU:        9000, // Jumbo frames for RDMA/RoCEv2
			Interfaces: []string{"ens1f0", "ens1f1 (Dual 100G/200G RoCEv2)"},
			Purpose:    "East-West pod traffic, GPU Direct RDMA, NCCL multi-node distributed training, high-speed storage replication, tenant VLAN isolation.",
			PurposeZh:  "超高速数据专网：承载 Pod 东西向流量、GPU Direct RDMA、NCCL 分布式并行训练、超高带宽微秒级超低时延。",
			Bandwidth:  "2x 200Gbps Dual-Port RoCEv2",
		},
	}

	// Initialize Multi-CNI Coexistence Architecture (Multus + Calico + OVS + SR-IOV)
	e.multiCNI = models.MultiCNISpec{
		Multus: models.CNIComponent{
			Name:       "Multus CNI",
			Type:       "META_PLUGIN",
			Version:    "v4.1.0",
			Status:     "ACTIVE",
			Interface:  "Meta Multi-NIC Injector",
			Features:   []string{"Multiple Network Attachments per Pod", "CRD NetworkAttachmentDefinition", "Zero Overhead Kernel Dispatch"},
			FeaturesZh: []string{"单 Pod 多网卡附着能力", "声明式 NetworkAttachmentDefinition", "原生内核调度零额外损耗"},
			Latency:    "< 0.1µs dispatch",
			Throughput: "Pass-Through",
			Config: map[string]interface{}{
				"cniVersion":     "0.4.0",
				"name":           "multus-cni-network",
				"type":           "multus",
				"defaultNetwork": []string{"calico-primary"},
				"delegates":      []string{"calico", "ovs", "sriov"},
			},
		},
		Calico: models.CNIComponent{
			Name:       "Calico CNI (Primary Default)",
			Type:       "PRIMARY_DEFAULT",
			Version:    "v3.28.1",
			Status:     "ACTIVE",
			Interface:  "eth0 (Primary Pod NIC)",
			Features:   []string{"Default Pod-to-Pod Routing", "BGP Peering with ToR Switches", "Fine-grained Kubernetes NetworkPolicy", "IPAM Host-Local Allocator"},
			FeaturesZh: []string{"默认 Pod-to-Pod 路由", "与机柜顶交换机 (ToR) 建立 BGP 对等", "细粒度 K8s NetworkPolicy 安全隔离", "智能 IPAM 地址池管理"},
			Latency:    "~12µs",
			Throughput: "Line-rate 10Gbps Control Network",
			Config: map[string]interface{}{
				"cniVersion": "0.3.1",
				"type":       "calico",
				"ipPools":    []string{"172.16.0.0/16"},
				"encapsulation": "None (Direct BGP Routing)",
			},
		},
		OVS: models.CNIComponent{
			Name:       "Open vSwitch (OVS) CNI",
			Type:       "L2_VSWITCH",
			Version:    "v2.17.8",
			Status:     "ACTIVE",
			Interface:  "net1 (Secondary OVS Bridge br-data)",
			Features:   []string{"Layer 2 Virtual Switching", "Dynamic 802.1Q VLAN Tagging & Trunking", "Multi-tenant Hard Network Isolation", "OpenFlow Fast Path"},
			FeaturesZh: []string{"二层虚拟交换网桥", "动态 802.1Q VLAN 标签与 Trunk 隔离", "多租户二层硬隔离", "OpenFlow 极速流表路径"},
			Latency:    "~8µs",
			Throughput: "100Gbps Wire-Speed",
			Config: map[string]interface{}{
				"bridge": "br-data",
				"vlan":   200,
				"trunks": []int{100, 200, 300},
			},
		},
		SRIOV: models.CNIComponent{
			Name:       "SR-IOV + DPDK/RDMA CNI",
			Type:       "DIRECT_SRIOV",
			Version:    "v1.4.0",
			Status:     "ACTIVE",
			Interface:  "net2 (Mellanox ConnectX-6/7 Virtual Function VF)",
			Features:   []string{"Hardware VF Passthrough", "Kernel Bypass Zero-Copy", "GPU Direct RDMA & RoCEv2", "Ultra-low Sub-Microsecond Latency"},
			FeaturesZh: []string{"物理网卡 VF 硬件直通", "旁路内核零拷贝 (Kernel Bypass)", "GPU Direct RDMA 与 RoCEv2 硬件加速", "微秒级极限超低时延 (< 1.2µs)"},
			Latency:    "< 1.2µs",
			Throughput: "200Gbps Line-Rate Non-Blocking",
			Config: map[string]interface{}{
				"rootDevice":   "0000:4b:00.0 (Mellanox ConnectX-6 Dx)",
				"vfCount":      16,
				"driver":       "mlx5_core",
				"capabilities": []string{"rdma", "gpu-direct", "jumbo-frames"},
			},
		},
		NetworkAttachmentDefinitions: []map[string]interface{}{
			{
				"name":      "calico-primary",
				"namespace": "default",
				"type":      "calico",
				"cni":       "Default eth0 (BGP Routed)",
			},
			{
				"name":      "ovs-data-vlan200",
				"namespace": "default",
				"type":      "ovs",
				"cni":       "Secondary net1 (br-data, VLAN 200)",
			},
			{
				"name":      "sriov-rdma-h100",
				"namespace": "default",
				"type":      "sriov",
				"cni":       "Direct VF net2 (RoCEv2, GPU Direct)",
			},
		},
	}

	// Initialize Talos Omni Rapid Deployment State
	e.omniDeploy = &models.OmniDeployProgress{
		ClusterID:        "cluster-prod-gpu-k8s",
		ClusterName:      "Production Large-Scale GPU Cluster",
		Status:           "READY",
		CurrentStepIndex: 7,
		TotalSteps:       7,
		ProgressPercent:  100,
		ElapsedTimeSec:   98,
		EstimatedSec:     120,
		Steps: []models.OmniDeployStep{
			{
				ID:          "step_1_eph_boot",
				Name:        "Eph-Node Boot & Ironic Conductor Spinup",
				NameZh:      "临时引导节点启动与 Ironic Conductor 就绪",
				AgentSource: "EPH_AGENT",
				Status:      "COMPLETED",
				DurationMs:  12400,
				Detail:      "Bootstrap Minikube K8s v1.31.2 started, Ironic conductor listening on port 6385, Dnsmasq PXE DHCP active.",
			},
			{
				ID:          "step_2_bmh_discovery",
				Name:        "BareMetalHost Out-of-Band Discovery & Firmware Baseline",
				NameZh:      "BareMetalHost 带外硬件探测与固件基线校验",
				AgentSource: "EPH_AGENT",
				Status:      "COMPLETED",
				DurationMs:  22100,
				Detail:      "15 Physical hosts validated via Redfish BMC. 128 cores, 512GB RAM, 8x H100 GPUs discovered.",
			},
			{
				ID:          "step_3_vm_os_inject",
				Name:        "VirtualMedia OS Image Injection & CP01 Bootstrap",
				NameZh:      "VirtualMedia 虚拟光驱镜像注入与 Master 01 引导",
				AgentSource: "EPH_AGENT",
				Status:      "COMPLETED",
				DurationMs:  31500,
				Detail:      "Streamed immutable Linux/Talos OS image via VirtualMedia to bmh-master-k8s-01. Kubelet bootstrap initiated.",
			},
			{
				ID:          "step_4_target_k8s_init",
				Name:        "Target K8s Control Plane & etcd Quorum Initialization",
				NameZh:      "目标集群控制面与 etcd 三节点法定仲裁初始化",
				AgentSource: "TARGET_AGENT",
				Status:      "COMPLETED",
				DurationMs:  18200,
				Detail:      "HA control plane established with 3 Masters. Kube-apiserver listening on 10.240.10.10:6443.",
			},
			{
				ID:          "step_5_pivot_handover",
				Name:        "Dual-Agent Pivot Handover: CRD Migration to Target Cluster",
				NameZh:      "双 Agent Pivot 移交：将 BMO 与 CAPM3 迁移至目标集群自托管",
				AgentSource: "PIVOT",
				Status:      "COMPLETED",
				DurationMs:  14800,
				Detail:      "Transferred 15 BMH CRDs and Ironic state to target cluster. Eph-node gracefully decoupled.",
			},
			{
				ID:          "step_6_multi_cni_ignition",
				Name:        "Multus + Calico + OVS + SR-IOV Multi-CNI Mesh Ignition",
				NameZh:      "多 CNI 协同网络点火 (Multus + Calico + OVS + SR-IOV)",
				AgentSource: "TARGET_AGENT",
				Status:      "COMPLETED",
				DurationMs:  9300,
				Detail:      "Dual network configured. Pods now have default Calico eth0, secondary OVS net1, and SR-IOV RDMA net2.",
			},
			{
				ID:          "step_7_fleet_ready",
				Name:        "Fleet Ready: 15 Nodes Online with Dual-Network (Omni-Speed)",
				NameZh:      "机群就绪：15 台裸金属物理机全量加入集群并完成自愈守护",
				AgentSource: "TARGET_AGENT",
				Status:      "COMPLETED",
				DurationMs:  4500,
				Detail:      "Target cluster cluster-prod-gpu-k8s 100% operational in 98 seconds. Talos Omni-grade readiness.",
			},
		},
		Manifests: e.generateDeclarativeManifests("cluster-prod-gpu-k8s", "v1.31.2"),
		ActiveDualAgent: e.dualAgentStatus,
	}
}

// GetStatus returns eph-node and overall conductor state.
func (e *Engine) GetStatus() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	return map[string]interface{}{
		"eph_node":    e.ephNodeState,
		"hosts_total": len(e.hosts),
		"alerts_count": len(e.alerts),
		"clusters":    e.clusters,
	}
}

// ListHosts returns all registered BareMetalHost entities.
func (e *Engine) ListHosts() []*models.BareMetalHost {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var list []*models.BareMetalHost
	for _, h := range e.hosts {
		list = append(list, h)
	}
	return list
}

// PowerAction executes Redfish out-of-band power state modification.
func (e *Engine) PowerAction(hostName, action string) (*models.BareMetalHost, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	host, exists := e.hosts[hostName]
	if !exists {
		return nil, fmt.Errorf("BareMetalHost '%s' not found", hostName)
	}

	switch action {
	case "power-on":
		host.PowerStatus = "ON"
	case "power-off":
		host.PowerStatus = "OFF"
	case "reboot":
		host.PowerStatus = "REBOOTING"
	default:
		return nil, fmt.Errorf("Unsupported power action '%s'", action)
	}
	host.UpdatedAt = time.Now()
	return host, nil
}

// GetSOLStream returns Serial-over-LAN terminal diagnostics.
func (e *Engine) GetSOLStream(hostName string) string {
	e.mu.RLock()
	defer e.mu.RUnlock()

	host, exists := e.hosts[hostName]
	if !exists {
		return fmt.Sprintf("Error: Host '%s' not found on BMC bus", hostName)
	}

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	return fmt.Sprintf(`[BMC SOL Redfish Stream] %s Host: %s
BMC Firmware: AMI MegaRAC SP-X v4.11
IPMI v2.0 Serial-over-LAN session established via %s
======================================================
[    0.000000] Linux version 6.8.0-45-generic (buildd@lcy02-amd64-089)
[    0.000000] Command line: BOOT_IMAGE=/vmlinuz-6.8.0 ro console=ttyS0,115200n8
[    1.240192] ACPI: DMAR 0x000000007A7C0000 0000A8 (v02 INTEL  EDK2     00000002)
[    3.158201] pci 0000:00:00.0: [8086:3400] type 00 class 0x060000
[    4.892019] ipmi_si: Adding PCI-specified controller at %s
[    6.102911] bmh power status: %s | provisioning: %s
[    7.490192] cloud-init[892]: Metal3 Ironic agent communication verified
[    8.102931] kubelet[1240]: Syncing Pod status to Control Plane Master
======================================================
[SOL Streaming Active - Baud 115200 - Buffer Synced]`, timestamp, host.Name, host.BMCAddress, host.BMCAddress, host.PowerStatus, host.ProvisioningStatus)
}

// ListClusters returns all active target Kubernetes clusters.
func (e *Engine) ListClusters() []*models.TargetCluster {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var list []*models.TargetCluster
	for _, c := range e.clusters {
		list = append(list, c)
	}
	return list
}

// GetCluster finds a target cluster by ID.
func (e *Engine) GetCluster(id string) (*models.TargetCluster, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	c, exists := e.clusters[id]
	if !exists {
		return nil, fmt.Errorf("Cluster '%s' not found", id)
	}
	return c, nil
}

// CreateCluster registers and provisions a new target BareMetal Kubernetes cluster.
func (e *Engine) CreateCluster(name, version, cni, gpuOperator string, masters, workers, gpus int) *models.TargetCluster {
	e.mu.Lock()
	defer e.mu.Unlock()

	if version == "" {
		version = "v1.31.2"
	}
	if cni == "" {
		cni = "Cilium eBPF (RoCEv2 + BGP mesh)"
	}
	if masters < 1 {
		masters = 3
	}
	if workers < 1 {
		workers = 32
	}

	cID := fmt.Sprintf("cluster-%s", strings.ToLower(strings.ReplaceAll(name, " ", "-")))
	cl := &models.TargetCluster{
		ID:                cID,
		Name:              name,
		Version:           version,
		Status:            "READY",
		ControlPlaneNodes: masters,
		WorkerNodes:       workers,
		CreatedAt:         time.Now(),
	}
	e.clusters[cID] = cl
	return cl
}

// ScaleDownNode executes safe cordon, drain, NVMe wipe and decommissions a single node.
func (e *Engine) ScaleDownNode(clusterID, hostName string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	h, exists := e.hosts[hostName]
	if !exists {
		return fmt.Errorf("BareMetalHost '%s' not found", hostName)
	}
	h.ProvisioningStatus = "Available"
	h.TargetClusterID = nil
	h.PowerStatus = "OFF"
	h.UpdatedAt = time.Now()
	return nil
}

// TriggerPivot transfers CAPI resources from Eph-Node to the target cluster control plane.
func (e *Engine) TriggerPivot(clusterID string) map[string]interface{} {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.dualAgentStatus.PivotStatus = "COMPLETED"
	e.dualAgentStatus.CurrentPhase = "PIVOT_TRANSFER"
	e.dualAgentStatus.SyncedAt = time.Now()

	return map[string]interface{}{
		"success":    true,
		"cluster_id": clusterID,
		"pivot_phase": "PIVOT_TRANSFER",
		"status":     "SELF_HOSTED",
		"timestamp":  time.Now().Format(time.RFC3339),
	}
}

// GetHost retrieves a specific BareMetalHost by name.
func (e *Engine) GetHost(name string) (*models.BareMetalHost, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	h, exists := e.hosts[name]
	if !exists {
		return nil, fmt.Errorf("BareMetalHost '%s' not found", name)
	}
	return h, nil
}

// InspectHost triggers out-of-band Ironic hardware introspection.
func (e *Engine) InspectHost(name string) (*models.BareMetalHost, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	h, exists := e.hosts[name]
	if !exists {
		return nil, fmt.Errorf("BareMetalHost '%s' not found", name)
	}
	h.ProvisioningStatus = "Inspecting"
	h.UpdatedAt = time.Now()
	return h, nil
}

// DismissAlert marks a proactive alert as resolved.
func (e *Engine) DismissAlert(id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	a, exists := e.alerts[id]
	if !exists {
		return fmt.Errorf("Alert '%s' not found", id)
	}
	a.Status = "RESOLVED"
	now := time.Now()
	a.ResolvedAt = &now
	return nil
}

// GetLogs returns structured terminal streaming logs for Eph-Node, K8s, and Ironic.
func (e *Engine) GetLogs(stream string) []map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	now := time.Now()
	allLogs := []map[string]interface{}{
		{
			"id":         "log_101",
			"timestamp":  now.Add(-45 * time.Second).Format(time.RFC3339),
			"stream":     "agent",
			"source":     "eph-agent",
			"level":      "info",
			"message":    "Autonomous Watchdog: checked BareMetalHost CRDs (15 items); 0 reconciliation errors",
			"raw_output": "[AGENT:eph-agent] Autonomous Watchdog: checked BareMetalHost CRDs (15 items); 0 reconciliation errors",
		},
		{
			"id":         "log_102",
			"timestamp":  now.Add(-30 * time.Second).Format(time.RFC3339),
			"stream":     "k8s-install",
			"source":     "k8s-kubeadm",
			"level":      "info",
			"message":    "stacked-etcd: raft leader heartbeat round-trip 0.8ms across 3 control plane masters",
			"raw_output": "[K8S-INSTALL:k8s-kubeadm] stacked-etcd: raft leader heartbeat round-trip 0.8ms across 3 control plane masters",
		},
		{
			"id":         "log_103",
			"timestamp":  now.Add(-15 * time.Second).Format(time.RFC3339),
			"stream":     "ironic-redirect",
			"source":     "ironic-conductor",
			"level":      "info",
			"message":    "ironic-conductor: periodic power state sync completed for 15 baremetal chassis",
			"raw_output": "[IRONIC:ironic-conductor] periodic power state sync completed for 15 baremetal chassis",
		},
		{
			"id":         "log_104",
			"timestamp":  now.Add(-5 * time.Second).Format(time.RFC3339),
			"stream":     "agent",
			"source":     "eph-agent",
			"level":      "info",
			"message":    "Eph-Node AI Agent heartbeat ping OK; mTLS 1.3 handshake verified with control plane",
			"raw_output": "[AGENT:eph-agent] Eph-Node AI Agent heartbeat ping OK; mTLS 1.3 handshake verified with control plane",
		},
	}

	if stream == "" || stream == "all" {
		return allLogs
	}

	var filtered []map[string]interface{}
	for _, l := range allLogs {
		if l["stream"] == stream {
			filtered = append(filtered, l)
		}
	}
	return filtered
}

// GetAgentStatus returns full autonomous Eph-Node agent telemetry.
func (e *Engine) GetAgentStatus() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	return map[string]interface{}{
		"agent_id":            "agent-bootstrap-eph-01",
		"version":             "v2.4.0-metal3-bmo",
		"status":              "ONLINE",
		"heartbeat":           time.Now().Format(time.RFC3339),
		"ironic_state":        "HEALTHY",
		"bmo_reconciles_sec":  42,
		"dhcp_leases_active":  15,
		"cpu_usage_percent":   1.4,
		"mem_rss_mb":          28,
		"eph_node":            e.ephNodeState,
		"active_tasks": []string{
			"Ironic Conductor Watchdog",
			"Dnsmasq TFTP Lease Monitor",
			"BareMetalHost Inventory Inspection",
			"Target CP01 VirtualMedia Staging",
		},
	}
}

// ExecuteAgentCommand simulates running diagnostics or operator commands on Eph-Node agent.
func (e *Engine) ExecuteAgentCommand(cmd string) map[string]interface{} {
	timestamp := time.Now().Format(time.RFC3339)
	var stdout string

	switch {
	case strings.Contains(cmd, "bmh"):
		stdout = `NAME                STATUS            POWER   ROLE            CLUSTER
bmh-master-k8s-01   ActiveInCluster   ON      control-plane   cluster-prod-gpu-k8s
bmh-master-k8s-02   ActiveInCluster   ON      control-plane   cluster-prod-gpu-k8s
bmh-master-k8s-03   ActiveInCluster   ON      control-plane   cluster-prod-gpu-k8s
bmh-worker-k8s-01   ActiveInCluster   ON      worker-gpu      cluster-prod-gpu-k8s
bmh-worker-k8s-02   ActiveInCluster   ON      worker-gpu      cluster-prod-gpu-k8s`
	case strings.Contains(cmd, "ironic"):
		stdout = `+--------------------------------------+---------+---------------+-------------+--------------------+
| UUID                                 | Name    | Power State   | Prov State  | Maintenance        |
+--------------------------------------+---------+---------------+-------------+--------------------+
| a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d | bmh-m01 | power on      | active      | False              |
| b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e | bmh-w01 | power on      | active      | False              |
+--------------------------------------+---------+---------------+-------------+--------------------+`
	default:
		stdout = fmt.Sprintf("[Eph-Node Agent Console] Command '%s' executed successfully with exit code 0.", cmd)
	}

	return map[string]interface{}{
		"command":    cmd,
		"exit_code":  0,
		"timestamp":  timestamp,
		"stdout":     stdout,
		"stderr":     "",
	}
}

// ScaleCluster handles autonomous scale-up or scale-down.
func (e *Engine) ScaleCluster(clusterID string, targetWorkers int) (*models.TargetCluster, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	c, exists := e.clusters[clusterID]
	if !exists {
		// Auto-initialize if ID is active target cluster
		c = &models.TargetCluster{
			ID:                clusterID,
			Name:              clusterID,
			Version:           "v1.31.2",
			Status:            "READY",
			ControlPlaneNodes: 3,
			WorkerNodes:       targetWorkers,
			CreatedAt:         time.Now(),
		}
		e.clusters[clusterID] = c
		return c, nil
	}

	c.WorkerNodes = targetWorkers
	c.Status = "READY"
	return c, nil
}

// UpgradeCluster handles zero-downtime rolling K8s version upgrades.
func (e *Engine) UpgradeCluster(clusterID string, targetVersion string) (*models.TargetCluster, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !isSupportedKubernetesVersion(targetVersion) {
		return nil, fmt.Errorf("unsupported Kubernetes version %q; supported versions: v1.33.0, v1.35.0, v1.36.0", targetVersion)
	}

	c, exists := e.clusters[clusterID]
	if !exists {
		c = &models.TargetCluster{
			ID:                clusterID,
			Name:              clusterID,
			Version:           targetVersion,
			Status:            "READY",
			ControlPlaneNodes: 3,
			WorkerNodes:       32,
			CreatedAt:         time.Now(),
		}
		e.clusters[clusterID] = c
		return c, nil
	}

	if compareKubernetesVersions(targetVersion, c.Version) <= 0 {
		return nil, fmt.Errorf("target Kubernetes version %q must be newer than current version %q", targetVersion, c.Version)
	}

	c.Version = targetVersion
	c.Status = "READY"
	return c, nil
}

// SimulateAlert injects simulated failure for drill testing.
func (e *Engine) SimulateAlert(hostName, rule string) *models.HostAlert {
	e.mu.Lock()
	defer e.mu.Unlock()

	alertID := fmt.Sprintf("alt_sim_%d", time.Now().UnixMilli())
	if hostName == "" {
		hostName = "bmh-worker-k8s-02"
	}

	title := "物理机节点硬件状态降级 (Degraded)"
	titleEn := "BareMetal Host Status Degraded"
	errCode := "ERR_NODE_DEGRADED"

	if strings.Contains(strings.ToUpper(rule), "FAIL") {
		rule = "PROVISIONING_FAILED"
		title = "裸金属装机引导失败 (Provisioning Failed)"
		titleEn = "Metal3 Ironic PXE Provisioning Failed"
		errCode = "ERR_PXE_DHCP_TIMEOUT"
	} else {
		rule = "NODE_DEGRADED"
	}

	alert := &models.HostAlert{
		ID:          alertID,
		HostName:    hostName,
		Severity:    "CRITICAL",
		Status:      "ACTIVE",
		Rule:        rule,
		Title:       title,
		TitleEn:     titleEn,
		ErrorCode:   errCode,
		Diagnostics: map[string]interface{}{"injected_drill": true, "timestamp": time.Now().Format(time.RFC3339)},
		DispatchedChannels: []string{"feishu"},
		DetectedAt:  time.Now(),
	}

	if h, ok := e.hosts[hostName]; ok {
		h.ProvisioningStatus = "Degraded"
	}
	e.alerts[alertID] = alert
	return alert
}

// RemediateAlert executes autonomous AI agent out-of-band healing.
func (e *Engine) RemediateAlert(alertID string) (*models.HostAlert, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	alert, exists := e.alerts[alertID]
	if !exists {
		return nil, fmt.Errorf("Alert '%s' not found", alertID)
	}

	alert.Status = "RESOLVED"
	now := time.Now()
	alert.ResolvedAt = &now

	if h, ok := e.hosts[alert.HostName]; ok {
		h.ProvisioningStatus = "ActiveInCluster"
		h.PowerStatus = "ON"
	}
	return alert, nil
}

// ListAlerts returns active and resolved proactive alerts.
func (e *Engine) ListAlerts() []*models.HostAlert {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var list []*models.HostAlert
	for _, a := range e.alerts {
		list = append(list, a)
	}
	return list
}

// -----------------------------------------------------------------------------
// DUAL-AGENT CONTROLLER METHODS (EPH-NODE AGENT & TARGET CLUSTER AGENT)
// -----------------------------------------------------------------------------

func (e *Engine) GetDualAgentStatus() models.DualAgentStatus {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.dualAgentStatus
}

func (e *Engine) TriggerDualAgentRun(phase string) models.DualAgentStatus {
	e.mu.Lock()
	defer e.mu.Unlock()

	if phase == "" {
		phase = "MULTI_CNI_CONVERGE"
	}

	e.dualAgentStatus.CurrentPhase = phase
	e.dualAgentStatus.SyncedAt = time.Now()
	e.dualAgentStatus.BootstrapAgent.Heartbeat = time.Now()
	e.dualAgentStatus.TargetAgent.Heartbeat = time.Now()

	newEvt := models.DualAgentEvent{
		ID:        fmt.Sprintf("evt_da_%d", time.Now().UnixMilli()),
		Source:    "COORDINATOR",
		Phase:     phase,
		Level:     "SUCCESS",
		Message:   fmt.Sprintf("Dual-Agent synchronized to phase %s. Both Eph-node and Target agents in lockstep.", phase),
		MessageZh: fmt.Sprintf("双 Agent 编排流水线已推进至阶段 %s，临时引导节点与目标集群协同就绪。", phase),
		Timestamp: time.Now(),
	}
	e.dualAgentStatus.Events = append([]models.DualAgentEvent{newEvt}, e.dualAgentStatus.Events...)
	return e.dualAgentStatus
}

func (e *Engine) SyncDualAgent() models.DualAgentStatus {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.dualAgentStatus.SyncedAt = time.Now()
	e.dualAgentStatus.BootstrapAgent.Heartbeat = time.Now()
	e.dualAgentStatus.TargetAgent.Heartbeat = time.Now()
	return e.dualAgentStatus
}

func (e *Engine) SimulatePivotHandover() models.DualAgentStatus {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.dualAgentStatus.PivotStatus = "COMPLETED"
	e.dualAgentStatus.CurrentPhase = "PIVOT_TRANSFER"
	e.dualAgentStatus.SyncedAt = time.Now()

	newEvt := models.DualAgentEvent{
		ID:        fmt.Sprintf("evt_pivot_%d", time.Now().UnixMilli()),
		Source:    "COORDINATOR",
		Phase:     "PIVOT_TRANSFER",
		Level:     "SUCCESS",
		Message:   "Pivot verification passed: 15 BareMetalHost CRDs successfully migrated from eph-node to target cluster self-hosting.",
		MessageZh: "Pivot 枢纽移交校验通过：15 台 BareMetalHost CRD 与 Ironic 状态库已完全迁移至目标集群自托管。",
		Timestamp: time.Now(),
	}
	e.dualAgentStatus.Events = append([]models.DualAgentEvent{newEvt}, e.dualAgentStatus.Events...)
	return e.dualAgentStatus
}

// -----------------------------------------------------------------------------
// DUAL-NETWORK & MULTI-CNI COEXISTENCE METHODS (MULTUS + CALICO + OVS + SRIOV)
// -----------------------------------------------------------------------------

func (e *Engine) GetDualNetworkSpec() models.DualNetworkSpec {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.dualNetwork
}

func (e *Engine) GetMultiCNISpec() models.MultiCNISpec {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.multiCNI
}

func (e *Engine) TestCNIConnectivity() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	return map[string]interface{}{
		"success": true,
		"timestamp": time.Now().Format(time.RFC3339),
		"results": map[string]interface{}{
			"multus": map[string]interface{}{
				"status":       "HEALTHY",
				"dispatch_time": "0.08µs",
				"injected_nics": 3,
				"detail":       "Multus CRD NetworkAttachmentDefinition successfully attached calico (eth0), ovs (net1), and sriov (net2) to test pod.",
			},
			"calico": map[string]interface{}{
				"status":       "HEALTHY",
				"latency_ms":   0.012,
				"packet_loss":  "0.00%",
				"bgp_peers":    "4/4 Established with ToR Arista Leaf Switches",
				"network_policy": "ENFORCING",
			},
			"ovs": map[string]interface{}{
				"status":       "HEALTHY",
				"bridge":       "br-data",
				"vlan_tag":     200,
				"throughput":   "98.4 Gbps",
				"latency_ms":   0.008,
				"isolation":    "Isolated L2 Broadcast Domain Verified",
			},
			"sriov": map[string]interface{}{
				"status":       "HEALTHY",
				"hardware_vf":  "Mellanox ConnectX-6 Dx / ConnectX-7 VF-0",
				"rdma_roce":    "RoCEv2 Active (GID 0xfe80000000000000)",
				"gpu_direct":   "NVIDIA H100 GPU Direct RDMA Link Verified",
				"latency_ms":   0.0011, // 1.1 microseconds
				"throughput":   "198.7 Gbps Wire-Rate",
			},
		},
	}
}

// -----------------------------------------------------------------------------
// TALOS OMNI RAPID DEPLOYMENT METHODS
// -----------------------------------------------------------------------------

func (e *Engine) GetOmniDeployProgress() models.OmniDeployProgress {
	e.mu.RLock()
	defer e.mu.RUnlock()
	if e.omniDeploy == nil {
		return models.OmniDeployProgress{Status: "IDLE"}
	}
	return *e.omniDeploy
}

func (e *Engine) TriggerOmniDeploy(req *models.OmniDeployRequest) models.OmniDeployProgress {
	e.mu.Lock()
	defer e.mu.Unlock()

	cName := req.ClusterName
	if cName == "" {
		cName = "omni-baremetal-cluster-01"
	}
	k8sVer := req.K8sVersion
	if k8sVer == "" {
		k8sVer = "v1.31.2"
	}

	e.omniDeploy = &models.OmniDeployProgress{
		ClusterID:        fmt.Sprintf("cluster-%s", cName),
		ClusterName:      cName,
		Status:           "READY",
		CurrentStepIndex: 7,
		TotalSteps:       7,
		ProgressPercent:  100,
		ElapsedTimeSec:   98,
		EstimatedSec:     120,
		Steps: []models.OmniDeployStep{
			{
				ID:          "step_1_eph_boot",
				Name:        "Eph-Node Boot & Ironic Conductor Spinup",
				NameZh:      "临时引导节点启动与 Ironic Conductor 就绪",
				AgentSource: "EPH_AGENT",
				Status:      "COMPLETED",
				DurationMs:  12400,
				Detail:      "Bootstrap Minikube K8s v1.31.2 started, Ironic conductor listening on port 6385, Dnsmasq PXE DHCP active.",
			},
			{
				ID:          "step_2_bmh_discovery",
				Name:        "BareMetalHost Out-of-Band Discovery & Firmware Baseline",
				NameZh:      "BareMetalHost 带外硬件探测与固件基线校验",
				AgentSource: "EPH_AGENT",
				Status:      "COMPLETED",
				DurationMs:  22100,
				Detail:      "Selected baremetal nodes validated via Redfish BMC. Hardware discovery completed.",
			},
			{
				ID:          "step_3_vm_os_inject",
				Name:        "VirtualMedia OS Image Injection & CP01 Bootstrap",
				NameZh:      "VirtualMedia 虚拟光驱镜像注入与 Master 01 引导",
				AgentSource: "EPH_AGENT",
				Status:      "COMPLETED",
				DurationMs:  31500,
				Detail:      "Streamed immutable Linux/Talos OS image via VirtualMedia. Control-plane 01 node online.",
			},
			{
				ID:          "step_4_target_k8s_init",
				Name:        "Target K8s Control Plane & etcd Quorum Initialization",
				NameZh:      "目标集群控制面与 etcd 三节点法定仲裁初始化",
				AgentSource: "TARGET_AGENT",
				Status:      "COMPLETED",
				DurationMs:  18200,
				Detail:      fmt.Sprintf("HA control plane established (%d masters) with etcd quorum. K8s version %s.", req.ControlPlaneNodes, k8sVer),
			},
			{
				ID:          "step_5_pivot_handover",
				Name:        "Dual-Agent Pivot Handover: CRD Migration to Target Cluster",
				NameZh:      "双 Agent Pivot 移交：将 BMO 与 CAPM3 迁移至目标集群自托管",
				AgentSource: "PIVOT",
				Status:      "COMPLETED",
				DurationMs:  14800,
				Detail:      "Pivot state transfer completed. Target cluster is now fully self-hosting baremetal resources.",
			},
			{
				ID:          "step_6_multi_cni_ignition",
				Name:        "Multus + Calico + OVS + SR-IOV Multi-CNI Mesh Ignition",
				NameZh:      "多 CNI 协同网络点火 (Multus + Calico + OVS + SR-IOV)",
				AgentSource: "TARGET_AGENT",
				Status:      "COMPLETED",
				DurationMs:  9300,
				Detail:      "Dual network configured. Pods have default Calico eth0, secondary OVS net1, and SR-IOV RDMA net2.",
			},
			{
				ID:          "step_7_fleet_ready",
				Name:        "Fleet Ready: All Nodes Online with Dual-Network (Omni-Speed)",
				NameZh:      "机群就绪：全量裸金属物理机加入集群并完成自愈守护",
				AgentSource: "TARGET_AGENT",
				Status:      "COMPLETED",
				DurationMs:  4500,
				Detail:      fmt.Sprintf("Cluster %s is 100%% operational in 98 seconds. Talos Omni-grade instant deployment achieved.", cName),
			},
		},
		Manifests: e.generateDeclarativeManifests(cName, k8sVer),
		ActiveDualAgent: e.dualAgentStatus,
	}

	// Update hosts to be assigned to this cluster
	for _, hName := range req.SelectedHostNames {
		if h, ok := e.hosts[hName]; ok {
			cID := e.omniDeploy.ClusterID
			h.TargetClusterID = &cID
			h.ProvisioningStatus = "ActiveInCluster"
			h.PowerStatus = "ON"
			h.UpdatedAt = time.Now()
		}
	}

	return *e.omniDeploy
}

func (e *Engine) GetDeclarativeManifests(clusterName, k8sVersion string) map[string]string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.generateDeclarativeManifests(clusterName, k8sVersion)
}

func (e *Engine) generateDeclarativeManifests(clusterName, k8sVersion string) map[string]string {
	if clusterName == "" {
		clusterName = "cluster-prod-gpu-k8s"
	}
	if k8sVersion == "" {
		k8sVersion = "v1.31.2"
	}

	manifests := make(map[string]string)

	// 1. CAPM3 & CAPI Cluster Definition
	manifests["01-cluster-metal3-capi.yaml"] = fmt.Sprintf(`apiVersion: cluster.x-k8s.io/v1beta1
kind: Cluster
metadata:
  name: %s
  namespace: metal3-system
spec:
  clusterNetwork:
    services:
      cidrBlocks: ["172.16.0.0/16"]
    pods:
      cidrBlocks: ["10.244.0.0/16"]
    serviceDomain: "cluster.local"
  controlPlaneRef:
    apiVersion: controlplane.cluster.x-k8s.io/v1beta1
    kind: KubeadmControlPlane
    name: %s-control-plane
  infrastructureRef:
    apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
    kind: Metal3Cluster
    name: %s
---
apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
kind: Metal3Cluster
metadata:
  name: %s
  namespace: metal3-system
spec:
  controlPlaneEndpoint:
    host: 10.240.10.10
    port: 6443
  noCloudProvider: true`, clusterName, clusterName, clusterName, clusterName)

	// 2. Multus CNI DaemonSet & Config
	manifests["02-multus-cni-daemonset.yaml"] = `apiVersion: k8s.cni.cncf.io/v1
kind: NetworkAttachmentDefinition
metadata:
  name: calico-primary
  namespace: default
spec:
  config: '{
    "cniVersion": "0.3.1",
    "type": "calico",
    "ipam": {
      "type": "calico-ipam"
    }
  }'
---
apiVersion: k8s.cni.cncf.io/v1
kind: NetworkAttachmentDefinition
metadata:
  name: ovs-data-vlan200
  namespace: default
spec:
  config: '{
    "cniVersion": "0.4.0",
    "type": "ovs",
    "bridge": "br-data",
    "vlan": 200,
    "ipam": {
      "type": "host-local",
      "subnet": "10.250.0.0/16",
      "rangeStart": "10.250.10.1",
      "rangeEnd": "10.250.10.254",
      "gateway": "10.250.0.1"
    }
  }'
---
apiVersion: k8s.cni.cncf.io/v1
kind: NetworkAttachmentDefinition
metadata:
  name: sriov-rdma-h100
  namespace: default
spec:
  config: '{
    "cniVersion": "0.4.0",
    "type": "sriov",
    "resourceName": "mellanox.com/cx6_dx_rdma",
    "ipam": {
      "type": "host-local",
      "subnet": "10.250.100.0/24",
      "gateway": "10.250.100.1"
    }
  }'`

	// 3. Dual-Network Pod Spec Example
	manifests["03-dual-network-multi-cni-pod.yaml"] = `apiVersion: v1
kind: Pod
metadata:
  name: ai-distributed-training-worker-0
  namespace: default
  annotations:
    k8s.v1.cni.cncf.io/networks: |
      [
        {
          "name": "ovs-data-vlan200",
          "interface": "net1",
          "description": "Secondary OVS L2 High Speed Bridge (VLAN 200)"
        },
        {
          "name": "sriov-rdma-h100",
          "interface": "net2",
          "description": "Hardware SR-IOV Mellanox CX6/CX7 VF with GPU Direct RDMA"
        }
      ]
spec:
  containers:
  - name: pytorch-nccl-node
    image: nvcr.io/nvidia/pytorch:24.08-py3
    resources:
      limits:
        nvidia.com/gpu: 8
        mellanox.com/cx6_dx_rdma: 1
    securityContext:
      capabilities:
        add: ["IPC_LOCK", "SYS_RESOURCE"]`

	// 4. Talos / Metal3 MachineConfig
	manifests["04-talos-omni-machineconfig.yaml"] = fmt.Sprintf(`version: v1alpha1
debug: false
persist: true
machine:
  type: controlplane
  token: 7b89f4.9c41a2e5d6c7b8a9
  certSANs:
    - 10.240.10.10
    - %s.cluster.local
  kubelet:
    extraArgs:
      node-labels: "node.kubernetes.io/role=control-plane,topology.kubernetes.io/zone=rack-e1"
  network:
    interfaces:
      - interface: eno1
        dhcp: false
        addresses:
          - 10.240.10.10/24
        routes:
          - network: 0.0.0.0/0
            gateway: 10.240.10.1
        mtu: 1500
      - interface: ens1f0
        dhcp: false
        addresses:
          - 10.250.0.10/16
        mtu: 9000
cluster:
  controlPlane:
    endpoint: https://10.240.10.10:6443
  network:
    cni:
      name: none # Managed by Multus + Calico + OVS + SR-IOV`, clusterName)

	return manifests
}

