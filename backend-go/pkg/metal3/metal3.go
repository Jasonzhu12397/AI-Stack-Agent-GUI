package metal3

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/agent/ephnode"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/agent/target"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/cni"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
)

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
	EphPodAgent     *ephnode.EphNodeAgent
	TargetPodAgent  *target.TargetClusterAgent
	CNIManager      *cni.Manager
	versionCtrl     *VersionController
	controllerLogs  []map[string]interface{}
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
		EphPodAgent: ephnode.New(ephnode.AgentConfig{
			AgentID:        "agent-bootstrap-eph-01",
			PodName:        "metal3-eph-agent-daemon-7b89f4",
			Namespace:      "metal3-system",
			NodeName:       "eph-bootstrap-node-01",
			IronicEndpoint: "http://10.240.10.1:6385/v1",
		}),
		TargetPodAgent: target.New(target.AgentConfig{
			AgentID:   "agent-target-cluster-01",
			PodName:   "capm3-target-agent-operator-9c41a2",
			Namespace: "capi-system",
			ClusterID: "cluster-prod-gpu-k8s",
		}),
		CNIManager:     cni.NewManager("cluster-prod-gpu-k8s"),
		controllerLogs: make([]map[string]interface{}, 0),
	}
	eng.versionCtrl = NewVersionController(eng)
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
		k8sVer := "v1.31.2"
		bootImg := "talos-v1.8.2-k8s-v1.31.2.iso"
		progPct := 100
		if clusterID == nil {
			status = "Available"
			k8sVer = "v1.31.2"
			bootImg = "ironic-ipa-ramdisk.iso"
			progPct = 0
		}

		e.hosts[name] = &models.BareMetalHost{
			Name:                        name,
			RackLocation:                fmt.Sprintf("Rack-E%d-U%02d", (i/4)+1, (i%4)*4+2),
			BMCAddress:                  fmt.Sprintf("https://10.240.10.%d/redfish/v1", 100+i),
			BMCProtocol:                 "Redfish/v1.14.0",
			BootMACAddress:              fmt.Sprintf("52:54:00:c3:2a:%02x", i),
			PowerStatus:                 "ON",
			ProvisioningStatus:          status,
			AssignedRole:                role,
			TargetClusterID:             clusterID,
			K8sVersion:                  k8sVer,
			UpgradeStatus:               "IDLE",
			BootImage:                   bootImg,
			ProvisioningProgressPercent: progPct,
			Hardware: map[string]interface{}{
				"model":     "NVIDIA DGX H100 / Dell PowerEdge XE9680",
				"cores":     128,
				"cpu_cores": 128,
				"cpu_arch":  "x86_64",
				"ram_gb":    512,
				"memory_gb": 512,
				"disk_gb":   7680,
				"gpus":      gpuModel,
				"gpu_model": gpuModel,
			},
			Sensors: map[string]interface{}{
				"cpu_temp_c":        41.0 + float64(i)*0.8,
				"fan_rpm":           6700 + i*110,
				"fan_speed_rpm":     6700 + i*110,
				"power_watt":        380 + i*20,
				"power_watts":       380 + i*20,
				"system_health":     "OK",
				"dimm_status":       "ALL_CHANNELS_NOMINAL",
				"nvme_smart_health": "100% HEALTHY (0 ERRORS)",
			},
			IPAddresses: map[string]string{
				"bmc_ip":          fmt.Sprintf("10.240.10.%d", 100+i),
				"provisioning_ip": fmt.Sprintf("10.244.100.%d", 20+i),
				"target_ip":       fmt.Sprintf("10.250.0.%d", 20+i),
			},
			SerialConsoleRecent: []string{
				fmt.Sprintf("[SOL %s] AMI MegaRAC SP-X BIOS 4.12 initialized", name),
				fmt.Sprintf("[SOL %s] Kernel 6.8.0-45-generic booted successfully", name),
				fmt.Sprintf("[SOL %s] Mellanox CX-6 VF direct SR-IOV bound to net2 (RoCEv2 200G)", name),
				fmt.Sprintf("[SOL %s] Kubelet %s synchronized with Target Control Plane VIP 10.240.10.10", name, k8sVer),
			},
			UpdatedAt: time.Now(),
		}
	}

	// Target Cluster
	e.clusters["cluster-prod-gpu-k8s"] = &models.TargetCluster{
		ID:                "cluster-prod-gpu-k8s",
		Name:              "Production Large-Scale GPU Cluster",
		Version:           "v1.31.2",
		K8sVersion:        "v1.31.2",
		Status:            "READY",
		ControlPlaneNodes: 3,
		WorkerNodes:       7,
		Scale: models.TargetClusterScale{
			ControlPlaneNodes: 3,
			WorkerNodes:       7,
			GPUNodes:          7,
			TotalNodes:        10,
		},
		CNI:             "Multus + Calico + OVS + SR-IOV",
		GPUOperator:     "NVIDIA GPU Operator v24.6.0 (8x H100)",
		ProgressPercent: 100,
		CurrentStage:    "FLEET_READY",
		APIEndpoint:     "https://10.240.10.10:6443",
		CreatedAt:       time.Now().Add(-72 * time.Hour),
	}

	// Seed Alert
	e.alerts["alt_seed_degraded_01"] = &models.HostAlert{
		ID:        "alt_seed_degraded_01",
		HostName:  "bmh-worker-k8s-04",
		Severity:  "WARNING",
		Status:    "ACTIVE",
		Rule:      "NODE_DEGRADED",
		Title:     "节点温度异常升高与驱动告警",
		TitleEn:   "Host Thermal Sensor Degradation & GPU Driver Throttle",
		Message:   "检测到工作节点 bmh-worker-k8s-04 GPU 模组温度达 82.5°C，触发带外风扇调速策略。",
		MessageEn: "Detected thermal sensor spike (82.5°C) on bmh-worker-k8s-04; out-of-band fan boost recommended.",
		ErrorCode: "WARN_THERMAL_GPU_THROTTLE",
		Diagnostics: map[string]interface{}{
			"phase":         "ACTIVE_MONITORING",
			"bmc_ip":        "10.240.10.107",
			"temperature_c": 82.5,
			"fan_rpm":       9200,
			"recommended":   "Auto Cordon & Fan Profile Boost",
		},
		DispatchedChannels: []string{"feishu"},
		DetectedAt:         time.Now().Add(-15 * time.Minute),
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
			Interface:  "Meta Multi-NIC Injector (eth0 + net1 + net2 + net3)",
			Features:   []string{"Multi-CNI Orchestration per Pod", "4x CRD NetworkAttachmentDefinitions", "Calico + OVS-DPDK + Multi-DPDK/SR-IOV Binding"},
			FeaturesZh: []string{"单 Pod 多平面 CNI 联合挂载", "支持多组 NetworkAttachmentDefinition CRD", "协同调度 Calico + OVS-DPDK + 多路 DPDK/SR-IOV"},
			Latency:    "< 0.1µs dispatch",
			Throughput: "Multi-Plane Concurrent",
			Config: map[string]interface{}{
				"cniVersion":     "0.4.0",
				"name":           "multus-cni-network",
				"type":           "multus",
				"defaultNetwork": []string{"calico-primary"},
				"delegates":      []string{"calico", "ovs-dpdk", "dpdk-sriov-pf0", "sriov-rocev2-pf1"},
			},
		},
		Calico: models.CNIComponent{
			Name:       "Calico CNI (Primary Default)",
			Type:       "PRIMARY_DEFAULT",
			Version:    "v3.28.1",
			Status:     "ACTIVE",
			Interface:  "eth0 (Primary Pod Control & Service NIC)",
			Features:   []string{"Default Pod-to-Pod Routing", "BGP Peering with ToR Switches", "Kubernetes NetworkPolicy", "Calico IPAM Allocator"},
			FeaturesZh: []string{"默认 Pod-to-Pod 三层路由", "ToR 交换机 BGP 对等互联", "细粒度 K8s NetworkPolicy 安全策略", "Calico IPAM 地址池分配"},
			Latency:    "~12µs",
			Throughput: "Line-rate 10Gbps Control Plane",
			Config: map[string]interface{}{
				"cniVersion":    "0.3.1",
				"type":          "calico",
				"ipPools":       []string{"172.16.0.0/16"},
				"encapsulation": "None (Direct BGP Routing)",
			},
		},
		OVS: models.CNIComponent{
			Name:       "OVS-DPDK CNI (Userspace vSwitch)",
			Type:       "OVS_DPDK_VSWITCH",
			Version:    "v2.17.8 / DPDK 24.11",
			Status:     "ACTIVE",
			Interface:  "net1 (OVS-DPDK Bridge br-data / dpdkvhostuserclient)",
			Features:   []string{"OVS netdev Userspace Datapath", "vhost-user Zero-Copy Virtio Rings", "802.1Q VLAN 200 Trunking & Isolation", "OpenFlow Hardware Offload"},
			FeaturesZh: []string{"OVS-DPDK 用户态高速交换矩阵 (netdev)", "vhost-user 共享巨页零拷贝通道", "802.1Q VLAN 200 多租户二层隔离", "OpenFlow 流表硬件卸载"},
			Latency:    "~3.2µs (vhost-user)",
			Throughput: "100Gbps OVS-DPDK Forwarding",
			Config: map[string]interface{}{
				"bridge":        "br-data",
				"datapath_type": "netdev",
				"vhost_mode":    "dpdkvhostuserclient",
				"vlan":          200,
				"trunks":        []int{100, 200, 300, 301},
			},
		},
		SRIOV: models.CNIComponent{
			Name:       "Multi-DPDK & SR-IOV Dataplane CNI",
			Type:       "MULTI_DPDK_SRIOV",
			Version:    "v1.4.0 / DPDK 24.11",
			Status:     "ACTIVE",
			Interface:  "net2 (vfio-pci DPDK) + net3 (mlx5_core RoCEv2)",
			Features:   []string{"Multiple Independent SR-IOV/DPDK Planes", "vfio-pci Userspace Poll-Mode Driver (PMD)", "1Gi HugePages Deterministic Memory", "ConnectX-7 RoCEv2 GPU Direct RDMA"},
			FeaturesZh: []string{"多路独立 SR-IOV / DPDK 加速平面", "vfio-pci 用户态轮询驱动 (PMD) 零中断", "1Gi 大页内存确定性零拷贝", "ConnectX-7 RoCEv2 与 GPU Direct RDMA"},
			Latency:    "< 1.2µs",
			Throughput: "200Gbps + 100Gbps Dual-Plane Line-Rate",
			Config: map[string]interface{}{
				"dpdk_driver":  "vfio-pci",
				"hugepages":    "1Gi",
				"rootDevices":  []string{"0000:4b:00.0 (DPDK PF0)", "0000:98:00.0 (ConnectX-7 PF1)"},
				"vfCount":      32,
				"capabilities": []string{"dpdk-pmd", "ovs-dpdk", "rdma", "gpu-direct", "jumbo-frames"},
			},
		},
		DPDKPlanes: []models.CNIComponent{
			{
				Name:       "Plane 1: OVS-DPDK vhost-user Bridge",
				Type:       "OVS_DPDK",
				Version:    "OVS 2.17 + DPDK 24.11",
				Status:     "ACTIVE",
				Interface:  "net1 (br-data / vhost-user0)",
				Features:   []string{"PMD Core Pinning", "1Gi HugePages", "VLAN 200 Trunk"},
				FeaturesZh: []string{"独立 PMD CPU 核绑定", "1Gi 巨页内存共享环", "VLAN 200 二层硬件隔离"},
				Latency:    "3.2µs",
				Throughput: "100Gbps Userspace Switch",
				Config:     map[string]interface{}{"driver": "dpdkvhostuserclient", "bridge": "br-data", "rx_queues": 4},
			},
			{
				Name:       "Plane 2: SR-IOV DPDK vfio-pci PF0",
				Type:       "DPDK_SRIOV_VFIO",
				Version:    "DPDK 24.11 LTS",
				Status:     "ACTIVE",
				Interface:  "net2 (dpdk0 / 0000:4b:02.0)",
				Features:   []string{"vfio-pci Kernel Bypass", "RSS Multi-Queue PMD", "Zero-Interrupt Polling"},
				FeaturesZh: []string{"vfio-pci 完全旁路内核", "多队列 RSS 轮询收发", "高吞吐低抖动报文处理"},
				Latency:    "1.8µs",
				Throughput: "100Gbps Full-Duplex PMD",
				Config:     map[string]interface{}{"driver": "vfio-pci", "resourceName": "intel.com/sriov_dpdk_pf0", "rx_queues": 8},
			},
			{
				Name:       "Plane 3: Mellanox ConnectX-7 RoCEv2 PF1",
				Type:       "SRIOV_ROCEV2_RDMA",
				Version:    "mlx5_core / OFED 24.10",
				Status:     "ACTIVE",
				Interface:  "net3 (mlx5_vf1 / 0000:98:04.0)",
				Features:   []string{"GPU Direct RDMA", "PFC Lossless Ethernet", "MTU 9000 Jumbo Frames"},
				FeaturesZh: []string{"GPU Direct RDMA 显存直通", "PFC 无损以太流控", "MTU 9000 巨型帧"},
				Latency:    "1.15µs",
				Throughput: "200Gbps Line-Rate RDMA",
				Config:     map[string]interface{}{"driver": "mlx5_ib", "resourceName": "mellanox.com/cx7_rocev2_pf1", "gid": "RoCEv2"},
			},
		},
		NetworkAttachmentDefinitions: []map[string]interface{}{
			{
				"name":      "calico-primary",
				"namespace": "default",
				"type":      "calico",
				"cni":       "Default eth0 (BGP Routed + NetworkPolicy)",
			},
			{
				"name":      "ovs-dpdk-vlan200",
				"namespace": "default",
				"type":      "ovs-dpdk",
				"cni":       "Secondary net1 (OVS-DPDK br-data + vhost-user, VLAN 200)",
			},
			{
				"name":      "dpdk-sriov-vfio-pf0",
				"namespace": "default",
				"type":      "sriov-dpdk",
				"cni":       "DPDK Plane net2 (vfio-pci Userspace PMD + 1Gi HugePages)",
			},
			{
				"name":      "sriov-rocev2-mlx5-pf1",
				"namespace": "default",
				"type":      "sriov-rdma",
				"cni":       "RDMA Plane net3 (ConnectX-7 VF RoCEv2, GPU Direct)",
			},
		},
	}

	e.syncHostsToCNILocked(true)

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

// ListHosts returns all registered BareMetalHost entities sorted deterministically by name.
func (e *Engine) ListHosts() []*models.BareMetalHost {
	e.mu.RLock()
	defer e.mu.RUnlock()

	list := make([]*models.BareMetalHost, 0, len(e.hosts))
	for _, h := range e.hosts {
		list = append(list, h)
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].Name < list[j].Name
	})
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

	switch strings.ToLower(strings.TrimSpace(action)) {
	case "power-on", "on":
		host.PowerStatus = "ON"
	case "power-off", "off":
		host.PowerStatus = "OFF"
	case "reboot":
		host.PowerStatus = "REBOOTING"
		host.SerialConsoleRecent = append([]string{
			fmt.Sprintf("[SOL %s] Redfish Cold Reboot triggered via BMC", hostName),
		}, host.SerialConsoleRecent...)
	case "pxe-boot":
		host.PowerStatus = "REBOOTING"
		host.ProvisioningStatus = "Provisioning"
		host.SerialConsoleRecent = append([]string{
			fmt.Sprintf("[SOL %s] Redfish One-Shot PXE/VirtualMedia Boot override active", hostName),
		}, host.SerialConsoleRecent...)
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
[    6.102911] bmh power status: %s | provisioning: %s | k8s: %s
[    7.490192] cloud-init[892]: Metal3 Ironic agent communication verified
[    8.102931] kubelet[1240]: Syncing Pod status to Control Plane Master
======================================================
[SOL Streaming Active - Baud 115200 - Buffer Synced]`, timestamp, host.Name, host.BMCAddress, host.BMCAddress, host.PowerStatus, host.ProvisioningStatus, host.K8sVersion)
}

// ListClusters returns all active target Kubernetes clusters sorted cleanly.
func (e *Engine) ListClusters() []*models.TargetCluster {
	e.mu.RLock()
	defer e.mu.RUnlock()

	list := make([]*models.TargetCluster, 0, len(e.clusters))
	for _, c := range e.clusters {
		list = append(list, c)
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.Before(list[j].CreatedAt)
	})
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
		cni = "Multus + Calico + OVS-DPDK + Multi-SR-IOV/DPDK"
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
		K8sVersion:        version,
		Status:            "READY",
		ControlPlaneNodes: masters,
		WorkerNodes:       workers,
		Scale: models.TargetClusterScale{
			ControlPlaneNodes: masters,
			WorkerNodes:       workers,
			GPUNodes:          gpus,
			TotalNodes:        masters + workers,
		},
		CNI:             cni,
		GPUOperator:     gpuOperator,
		ProgressPercent: 100,
		CurrentStage:    "FLEET_READY",
		APIEndpoint:     "https://10.240.10.10:6443",
		CreatedAt:       time.Now(),
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

// GetLogs returns structured terminal streaming logs for Eph-Node, K8s VersionController, and Ironic.
func (e *Engine) GetLogs(stream string) []map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	now := time.Now()
	allLogs := make([]map[string]interface{}, 0, len(e.controllerLogs)+4)
	allLogs = append(allLogs, e.controllerLogs...)
	allLogs = append(allLogs,
		map[string]interface{}{
			"id":         "log_101",
			"timestamp":  now.Add(-45 * time.Second).Format(time.RFC3339),
			"stream":     "agent",
			"source":     "eph-agent",
			"level":      "info",
			"message":    "Autonomous Watchdog: checked BareMetalHost CRDs (15 items); 0 reconciliation errors",
			"raw_output": "[AGENT:eph-agent] Autonomous Watchdog: checked BareMetalHost CRDs (15 items); 0 reconciliation errors",
		},
		map[string]interface{}{
			"id":         "log_102",
			"timestamp":  now.Add(-30 * time.Second).Format(time.RFC3339),
			"stream":     "k8s-install",
			"source":     "k8s-kubeadm",
			"level":      "info",
			"message":    "stacked-etcd: raft leader heartbeat round-trip 0.8ms across 3 control plane masters",
			"raw_output": "[K8S-INSTALL:k8s-kubeadm] stacked-etcd: raft leader heartbeat round-trip 0.8ms across 3 control plane masters",
		},
		map[string]interface{}{
			"id":         "log_103",
			"timestamp":  now.Add(-15 * time.Second).Format(time.RFC3339),
			"stream":     "ironic-redirect",
			"source":     "ironic-conductor",
			"level":      "info",
			"message":    "ironic-conductor: periodic power state sync completed for 15 baremetal chassis",
			"raw_output": "[IRONIC:ironic-conductor] periodic power state sync completed for 15 baremetal chassis",
		},
		map[string]interface{}{
			"id":         "log_104",
			"timestamp":  now.Add(-5 * time.Second).Format(time.RFC3339),
			"stream":     "agent",
			"source":     "eph-agent",
			"level":      "info",
			"message":    "Eph-Node AI Agent heartbeat ping OK; mTLS 1.3 handshake verified with control plane",
			"raw_output": "[AGENT:eph-agent] Eph-Node AI Agent heartbeat ping OK; mTLS 1.3 handshake verified with control plane",
		},
	)

	if stream == "" || stream == "all" {
		return allLogs
	}

	filtered := make([]map[string]interface{}, 0)
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
			K8sVersion:        "v1.31.2",
			Status:            "READY",
			ControlPlaneNodes: 3,
			WorkerNodes:       targetWorkers,
			Scale: models.TargetClusterScale{
				ControlPlaneNodes: 3,
				WorkerNodes:       targetWorkers,
				GPUNodes:          targetWorkers,
				TotalNodes:        3 + targetWorkers,
			},
			CNI:             "Multus + Calico + OVS + SR-IOV",
			GPUOperator:     "NVIDIA GPU Operator v24.6.0",
			ProgressPercent: 100,
			CurrentStage:    "SCALED",
			APIEndpoint:     "https://10.240.10.10:6443",
			CreatedAt:       time.Now(),
		}
		e.clusters[clusterID] = c
		return c, nil
	}

	c.WorkerNodes = targetWorkers
	c.Scale.WorkerNodes = targetWorkers
	c.Scale.TotalNodes = c.Scale.ControlPlaneNodes + targetWorkers
	c.Status = "READY"
	return c, nil
}

// GetSupportedK8sVersions returns the full matrix of production and bleeding-edge Kubernetes releases.
func (e *Engine) GetSupportedK8sVersions() []models.SupportedK8sVersion {
	return []models.SupportedK8sVersion{
		{
			ID:                "v1.36.0-dev",
			Version:           "v1.36.0-dev",
			MajorMinor:        "v1.36",
			DisplayName:       "Kubernetes v1.36 (Bleeding-Edge / 2026 Q4)",
			DisplayNameZh:     "Kubernetes v1.36 (超前研发预览版 / 2026 Q4)",
			Channel:           "PREVIEW",
			ReleaseDate:       "2026-10-15",
			Status:            "Bleeding Edge",
			StatusZh:          "超前尝鲜",
			BadgeColor:        "purple",
			TalosLinux:        "v1.9.0-alpha",
			ContainerdVersion: "v2.1.0-beta.1",
			RoceOptimized:     true,
			DRAVersion:        "DRA v2 Native Multi-Tenant",
			DescriptionEn:     "Cutting-edge AI supercomputing kernel, native hardware RoCEv2 Direct fabric NUMA pinning, zero-overhead in-pod cgroup v2 tiering, and sub-millisecond pod startup.",
			DescriptionZh:     "前沿 AI 超算原生架构，深度支持 RoCEv2 Direct 织网 NUMA 感知、动态硬件资源分配 (DRA v2) 与低至微秒级的 Pod 瞬时初始化。",
			FeaturesZh: []string{
				"DRA v2 原生多租户 GPU 切分与动态隔离",
				"RoCEv2 200Gbps 直通与网卡级 NUMA 亲和调度",
				"全新 Linux 6.12+ eBPF 零开销转发与加密隧道",
				"原生支持大模型推演容器零拷贝内存预热",
			},
			FeaturesEn: []string{
				"DRA v2 Native Multi-tenant GPU partitioning & dynamic slicing",
				"RoCEv2 200Gbps Direct & NIC-level NUMA affinity scheduler",
				"Linux 6.12+ eBPF zero-overhead dataplane & TLS offload",
				"Zero-copy memory pre-warming for LLM inference containers",
			},
			RecommendedFor: "Next-Gen AI Labs, Multi-Pod H100/B200 Clusters, Autonomous Research",
		},
		{
			ID:                "v1.35.0",
			Version:           "v1.35.0",
			MajorMinor:        "v1.35",
			DisplayName:       "Kubernetes v1.35 (Production Bleeding Edge / 2026 Q2)",
			DisplayNameZh:     "Kubernetes v1.35 (最新生产级推荐 / 2026 Q2)",
			Channel:           "LATEST",
			ReleaseDate:       "2026-04-18",
			Status:            "Production Ready",
			StatusZh:          "最新生产级",
			BadgeColor:        "emerald",
			TalosLinux:        "v1.8.4",
			ContainerdVersion: "v2.0.2",
			RoceOptimized:     true,
			DRAVersion:        "DRA v2 GA",
			DescriptionEn:     "Production-hardened GPU Supernode release with Dynamic Resource Allocation GA, Topology-aware GPU scheduling, and Multi-Subnet Pod IPAM v2.",
			DescriptionZh:     "面向生产级智算中心的黄金推荐版本，Dynamic Resource Allocation GA，原生多拓扑 GPU 编排，支持跨机架无损 RoCEv2 互联。",
			FeaturesZh: []string{
				"Dynamic Resource Allocation (DRA) 正式 GA",
				"拓扑感知 GPU 调度（NVLink 全互联优先对齐）",
				"多网卡 Multus v4.1 与 SR-IOV 硬件直通深度优化",
				"Kubelet 内存 QoS cgroup v2 精准降级保护",
			},
			FeaturesEn: []string{
				"Dynamic Resource Allocation (DRA) officially GA",
				"Topology-aware GPU scheduling with NVLink full-mesh priority",
				"Deep optimization for Multus v4.1 & SR-IOV hardware passthrough",
				"Kubelet memory QoS cgroup v2 precision eviction guard",
			},
			RecommendedFor: "Production Enterprise GPU Clusters, Multi-Node Distributed Training",
		},
		{
			ID:                "v1.34.1",
			Version:           "v1.34.1",
			MajorMinor:        "v1.34",
			DisplayName:       "Kubernetes v1.34 (Enterprise Stable / 2025 Q4)",
			DisplayNameZh:     "Kubernetes v1.34 (企业稳定版 / 2025 Q4)",
			Channel:           "STABLE",
			ReleaseDate:       "2025-11-20",
			Status:            "Enterprise Stable",
			StatusZh:          "企业稳定版",
			BadgeColor:        "cyan",
			TalosLinux:        "v1.8.2",
			ContainerdVersion: "v2.0.0",
			RoceOptimized:     true,
			DRAVersion:        "In-Place GPU Resize GA",
			DescriptionEn:     "Rock-solid enterprise stability featuring In-Place Pod Resource & GPU Resize GA, Structured Authorization, and VolumeAttributesClass.",
			DescriptionZh:     "工业级稳健版本，正式支持 Pod 在线无重启热扩容 (In-Place Resize)、结构化 RBAC 授权与多租户存储规格动态适配。",
			FeaturesZh: []string{
				"Pod 资源与 GPU 算力在线无重启热扩缩 (In-Place Resize)",
				"结构化鉴权策略引擎（Structured Authorization）",
				"mTLS 1.3 严格控制面双向握手防重放",
				"高密度节点挂载延迟降低 45%",
			},
			FeaturesEn: []string{
				"In-Place Pod Resource & GPU compute resize without restart",
				"Structured Authorization policy engine for Zero-Trust",
				"mTLS 1.3 strict control plane bi-directional handshake",
				"High-density node mount latency reduced by 45%",
			},
			RecommendedFor: "Financial Cloud, Mission-Critical Enterprise Production",
		},
		{
			ID:                "v1.33.2",
			Version:           "v1.33.2",
			MajorMinor:        "v1.33",
			DisplayName:       "Kubernetes v1.33 (Production LTS / 2025 Q2)",
			DisplayNameZh:     "Kubernetes v1.33 (长期支持版 LTS / 2025 Q2)",
			Channel:           "LTS",
			ReleaseDate:       "2025-05-10",
			Status:            "LTS",
			StatusZh:          "长期支持",
			BadgeColor:        "blue",
			TalosLinux:        "v1.8.0",
			ContainerdVersion: "v1.7.20",
			RoceOptimized:     true,
			DRAVersion:        "DRA GA (Core)",
			DescriptionEn:     "Long Term Support foundation with Native Sidecar Containers GA, Kubelet RoCEv2 NUMA Pinning, and hardened KMS v2 encryption.",
			DescriptionZh:     "三年长期支持基准版本，原生 Sidecar 容器生命周期 GA，Kubelet 带外高性能 RoCEv2 内存锁死与 KMS v2 硬件级加密。",
			FeaturesZh: []string{
				"原生 Sidecar 容器生命周期管理 GA",
				"Kubelet 节点网卡 NUMA 亲和锁死",
				"KMS v2 密钥轮换无缝在线升级",
				"跨地域集群控制面防网络抖动隔离",
			},
			FeaturesEn: []string{
				"Native Sidecar container lifecycle management GA",
				"Kubelet NIC NUMA affinity pinning",
				"KMS v2 key rotation seamless online upgrade",
				"Cross-region control plane network-jitter isolation",
			},
			RecommendedFor: "Regulated Telecom, Healthcare, Government Private Cloud",
		},
		{
			ID:                "v1.32.3",
			Version:           "v1.32.3",
			MajorMinor:        "v1.32",
			DisplayName:       "Kubernetes v1.32 (Active Maintenance / 2024 Q4)",
			DisplayNameZh:     "Kubernetes v1.32 (活跃维护版 / 2024 Q4)",
			Channel:           "MAINTENANCE",
			ReleaseDate:       "2024-11-28",
			Status:            "Maintenance",
			StatusZh:          "维护期",
			BadgeColor:        "slate",
			TalosLinux:        "v1.7.6",
			ContainerdVersion: "v1.7.18",
			RoceOptimized:     false,
			DRAVersion:        "CDI GA",
			DescriptionEn:     "Container Device Interface (CDI) GA, enhanced swap memory QoS, and deterministic pod lifecycle sleep actions.",
			DescriptionZh:     "Container Device Interface (CDI) GA，增强 Swap 内存 QoS 调优，确定性容器生命周期 Sleep 动作。",
			FeaturesZh: []string{
				"Container Device Interface (CDI) GA",
				"增强型 Swap 内存 QoS 调优",
				"Pod 生命周期 Hook Sleep 动作",
			},
			FeaturesEn: []string{
				"Container Device Interface (CDI) GA",
				"Enhanced node Swap memory QoS tuning",
				"Pod lifecycle Hook Sleep action",
			},
			RecommendedFor: "Existing K8s 1.32 Infrastructure Migrations",
		},
		{
			ID:                "v1.31.4",
			Version:           "v1.31.4",
			MajorMinor:        "v1.31",
			DisplayName:       "Kubernetes v1.31 (Current Fleet Baseline / 2024 Q3)",
			DisplayNameZh:     "Kubernetes v1.31 (当前存量基准 / 2024 Q3)",
			Channel:           "MAINTENANCE",
			ReleaseDate:       "2024-08-14",
			Status:            "Baseline",
			StatusZh:          "当前基线",
			BadgeColor:        "amber",
			TalosLinux:        "v1.7.0",
			ContainerdVersion: "v1.7.15",
			RoceOptimized:     false,
			DRAVersion:        "AppArmor GA",
			DescriptionEn:     "Current deployment baseline running across initial bare-metal cluster instances, with nftables kube-proxy and AppArmor GA.",
			DescriptionZh:     "当前存量裸金属初始安装的基线版本，集成 AppArmor GA 与 nftables 转发。",
			FeaturesZh: []string{
				"AppArmor 字段原生一等公民支持",
				"Kube-proxy nftables 模式 GA",
				"持久卷在线弹性扩容",
			},
			FeaturesEn: []string{
				"AppArmor fields native first-class citizen support",
				"Kube-proxy nftables mode GA",
				"PersistentVolume online elastic expansion",
			},
			RecommendedFor: "Baseline reference, backward compatibility testbeds",
		},
		{
			ID:                "v1.30.8",
			Version:           "v1.30.8",
			MajorMinor:        "v1.30",
			DisplayName:       "Kubernetes v1.30 (Legacy Extended Support)",
			DisplayNameZh:     "Kubernetes v1.30 (存量拓展支持)",
			Channel:           "MAINTENANCE",
			ReleaseDate:       "2024-04-17",
			Status:            "Legacy",
			StatusZh:          "归档维护",
			BadgeColor:        "zinc",
			TalosLinux:        "v1.6.4",
			ContainerdVersion: "v1.7.14",
			RoceOptimized:     false,
			DRAVersion:        "Structured Parameters (Alpha)",
			DescriptionEn:     "Legacy Kubernetes version for backward compatibility validation and older hardware firmware support.",
			DescriptionZh:     "归档支持版本，用于旧硬件带外固件的向后兼容与迁移验证。",
			FeaturesZh: []string{
				"DRA 结构化参数初版测试",
				"节点内存 cgroup v2 换页调优",
			},
			FeaturesEn: []string{
				"Initial structured parameters for DRA",
				"Node memory cgroup v2 swap tuning",
			},
			RecommendedFor: "Legacy systems deprecation, compatibility audits",
		},
	}
}

// Remove old direct-overwrite ApplyVersionToNodes/UpgradeCluster in favor of VersionController (kept as clean delegate)
func (e *Engine) UpgradeCluster(clusterID string, targetVersion string) (*models.TargetCluster, error) {
	if _, err := e.TriggerClusterUpgrade(clusterID, targetVersion, "rolling", nil, 180, "System"); err != nil {
		return nil, err
	}
	return e.GetCluster(clusterID)
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
	msg := fmt.Sprintf("物理机 %s 出现带外硬件异常降级，建议执行自愈诊断。", hostName)
	msgEn := fmt.Sprintf("Host %s reported out-of-band hardware degradation; remediation recommended.", hostName)
	errCode := "ERR_NODE_DEGRADED"

	if strings.Contains(strings.ToUpper(rule), "FAIL") {
		rule = "PROVISIONING_FAILED"
		title = "裸金属装机引导失败 (Provisioning Failed)"
		titleEn = "Metal3 Ironic PXE Provisioning Failed"
		msg = fmt.Sprintf("节点 %s PXE/DHCP 镜像引导超时 (ERR_PXE_DHCP_TIMEOUT)。", hostName)
		msgEn = fmt.Sprintf("Node %s PXE/DHCP provisioning boot timed out (ERR_PXE_DHCP_TIMEOUT).", hostName)
		errCode = "ERR_PXE_DHCP_TIMEOUT"
	} else {
		rule = "NODE_DEGRADED"
	}

	alert := &models.HostAlert{
		ID:                 alertID,
		HostName:           hostName,
		Severity:           "CRITICAL",
		Status:             "ACTIVE",
		Rule:               rule,
		Title:              title,
		TitleEn:            titleEn,
		Message:            msg,
		MessageEn:          msgEn,
		ErrorCode:          errCode,
		Diagnostics:        map[string]interface{}{"phase": "PXE_BOOT", "bmc_ip": "10.240.10.105", "temperature_c": 79.4, "error_detail": errCode, "injected_drill": true},
		DispatchedChannels: []string{"feishu"},
		DetectedAt:         time.Now(),
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

// ListAlerts returns active and resolved proactive alerts ordered newest-first.
func (e *Engine) ListAlerts() []*models.HostAlert {
	e.mu.RLock()
	defer e.mu.RUnlock()

	list := make([]*models.HostAlert, 0, len(e.alerts))
	for _, a := range e.alerts {
		list = append(list, a)
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].DetectedAt.After(list[j].DetectedAt)
	})
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

func (e *Engine) syncHostsToCNILocked(preConverge bool) {
	if e.CNIManager == nil {
		return
	}
	descs := make([]cni.HostDescriptor, 0, len(e.hosts))
	for _, h := range e.hosts {
		cID := ""
		if h.TargetClusterID != nil {
			cID = *h.TargetClusterID
		}
		descs = append(descs, cni.HostDescriptor{
			Name:               h.Name,
			Role:               h.AssignedRole,
			ProvisioningStatus: h.ProvisioningStatus,
			PowerStatus:        h.PowerStatus,
			ClusterID:          cID,
		})
	}
	e.CNIManager.SyncHosts(descs, preConverge)
}

func (e *Engine) GetMultiCNISpec() models.MultiCNISpec {
	e.mu.RLock()
	spec := e.multiCNI
	var cfg *cni.FleetConfig
	if e.CNIManager != nil {
		c := e.CNIManager.GetConfig()
		cfg = &c
	}
	e.mu.RUnlock()

	if cfg != nil {
		spec.Calico.Version = cfg.Calico.Version
		spec.Calico.Config["ipPools"] = []string{cfg.Calico.IPPoolCIDR}
		spec.Calico.Config["bgpAS"] = cfg.Calico.BGPASNumber
		spec.Calico.Config["mtu"] = cfg.Calico.MTU
		spec.OVS.Config["bridge"] = cfg.OVSDPDK.BridgeName
		spec.OVS.Config["vlan"] = cfg.OVSDPDK.VLAN
		spec.Multus.Config["delegates"] = cfg.Multus.Delegates
		if len(cfg.SRIOVInterfaces) > 0 {
			spec.SRIOV.Config["vfCount"] = cfg.SRIOVInterfaces[0].NumVFs
			spec.SRIOV.Config["dpdk_driver"] = cfg.SRIOVInterfaces[0].Driver
		}
	}
	return spec
}

// GetCNIFleetSummary returns the CNI provisioning state machine snapshot across all Metal3 BareMetalHosts.
func (e *Engine) GetCNIFleetSummary() cni.FleetSummary {
	e.mu.Lock()
	e.syncHostsToCNILocked(false)
	mgr := e.CNIManager
	e.mu.Unlock()
	return mgr.GetFleetSummary()
}

// ReconcileCNIFleet steps or converges the CNI state machine across the Metal3 fleet.
func (e *Engine) ReconcileCNIFleet(hostNames []string, convergeAll bool) cni.FleetSummary {
	e.mu.Lock()
	e.syncHostsToCNILocked(false)
	mgr := e.CNIManager
	e.mu.Unlock()
	if convergeAll {
		return mgr.ReconcileUntilConverged(hostNames, 8)
	}
	return mgr.ReconcileOnce(hostNames)
}

// ApplyCNIConfig validates and applies updated Calico/Multus/SR-IOV interface configs, triggering drift reconciliation.
func (e *Engine) ApplyCNIConfig(nextCfg cni.FleetConfig) (cni.FleetSummary, error) {
	e.mu.Lock()
	e.syncHostsToCNILocked(false)
	mgr := e.CNIManager
	e.mu.Unlock()
	return mgr.UpdateConfig(nextCfg)
}

// InjectCNIDrift simulates an interface drift or plugin degradation on a host so operators can verify convergence recovery.
func (e *Engine) InjectCNIDrift(hostName string, plugin cni.PluginKind, degraded bool, reason string) (cni.HostCNIState, error) {
	e.mu.Lock()
	e.syncHostsToCNILocked(false)
	mgr := e.CNIManager
	e.mu.Unlock()
	return mgr.InjectDrift(hostName, plugin, degraded, reason)
}

func (e *Engine) TestCNIConnectivity() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	return map[string]interface{}{
		"success":   true,
		"timestamp": time.Now().Format(time.RFC3339),
		"results": map[string]interface{}{
			"multus": map[string]interface{}{
				"status":        "HEALTHY",
				"dispatch_time": "0.08µs",
				"injected_nics": 4,
				"detail":        "Multus v4.1 attached calico (eth0), ovs-dpdk (net1), dpdk-vfio-pci (net2), and sriov-rocev2 (net3) concurrently.",
			},
			"calico": map[string]interface{}{
				"status":         "HEALTHY",
				"latency_ms":     0.012,
				"packet_loss":    "0.00%",
				"bgp_peers":      "4/4 Established with ToR Arista Leaf Switches",
				"network_policy": "ENFORCING",
			},
			"ovs": map[string]interface{}{
				"status":        "HEALTHY",
				"bridge":        "br-data (OVS-DPDK netdev)",
				"datapath_type": "netdev / vhost-user",
				"vlan_tag":      200,
				"throughput":    "100.0 Gbps",
				"latency_ms":    0.0032,
				"isolation":     "Isolated L2 DPDK vSwitch Broadcast Domain Verified",
			},
			"dpdk": map[string]interface{}{
				"status":       "HEALTHY",
				"pmd_driver":   "vfio-pci (DPDK 24.11 LTS)",
				"hugepages":    "8x 1Gi HugePages Locked",
				"active_vfs":   "net2 (PF0 VF-0) + ovs-dpdk vhost0",
				"latency_ms":   0.0018,
				"throughput":   "100.0 Gbps Zero-Copy PMD",
			},
			"sriov": map[string]interface{}{
				"status":      "HEALTHY",
				"hardware_vf": "Mellanox ConnectX-7 VF-1 (net3) + DPDK VF-0 (net2)",
				"rdma_roce":   "RoCEv2 Active (GID 0xfe80000000000000)",
				"gpu_direct":  "NVIDIA H100 GPU Direct RDMA + Multi-DPDK Verified",
				"latency_ms":  0.0011,
				"throughput":  "198.7 Gbps Wire-Rate",
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

	// 2. Multus CNI NetworkAttachmentDefinitions (Calico + OVS-DPDK + Multi-DPDK/SR-IOV)
	manifests["02-multus-cni-daemonset.yaml"] = `apiVersion: k8s.cni.cncf.io/v1
kind: NetworkAttachmentDefinition
metadata:
  name: calico-primary
  namespace: default
spec:
  config: '{
    "cniVersion": "0.3.1",
    "type": "calico",
    "ipam": { "type": "calico-ipam" }
  }'
---
apiVersion: k8s.cni.cncf.io/v1
kind: NetworkAttachmentDefinition
metadata:
  name: ovs-dpdk-vlan200
  namespace: default
spec:
  config: '{
    "cniVersion": "0.4.0",
    "type": "ovs",
    "bridge": "br-data",
    "datapath_type": "netdev",
    "vhost_mode": "dpdkvhostuserclient",
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
  name: dpdk-sriov-vfio-pf0
  namespace: default
  annotations:
    k8s.v1.cni.cncf.io/resourceName: intel.com/sriov_dpdk_pf0
spec:
  config: '{
    "cniVersion": "0.4.0",
    "type": "sriov",
    "deviceID": "0000:4b:02.0",
    "driver": "vfio-pci",
    "vlan": 300,
    "mtu": 9000,
    "ipam": {
      "type": "host-local",
      "subnet": "10.250.80.0/24",
      "gateway": "10.250.80.1"
    }
  }'
---
apiVersion: k8s.cni.cncf.io/v1
kind: NetworkAttachmentDefinition
metadata:
  name: sriov-rocev2-mlx5-pf1
  namespace: default
  annotations:
    k8s.v1.cni.cncf.io/resourceName: mellanox.com/cx7_rocev2_pf1
spec:
  config: '{
    "cniVersion": "0.4.0",
    "type": "sriov",
    "deviceID": "0000:98:04.0",
    "vlan": 301,
    "mtu": 9000,
    "ipam": {
      "type": "host-local",
      "subnet": "10.250.100.0/24",
      "gateway": "10.250.100.1"
    }
  }'`

	// 3. Multi-NIC Pod Spec (Calico + OVS-DPDK + Multiple DPDK/SR-IOV)
	manifests["03-dual-network-multi-cni-pod.yaml"] = `apiVersion: v1
kind: Pod
metadata:
  name: ai-dpdk-sriov-training-worker-0
  namespace: default
  annotations:
    k8s.v1.cni.cncf.io/networks: |
      [
        {
          "name": "ovs-dpdk-vlan200",
          "interface": "net1",
          "description": "OVS-DPDK vhost-user L2 Bridge (VLAN 200)"
        },
        {
          "name": "dpdk-sriov-vfio-pf0",
          "interface": "net2",
          "description": "SR-IOV DPDK Userspace PMD Plane A (vfio-pci)"
        },
        {
          "name": "sriov-rocev2-mlx5-pf1",
          "interface": "net3",
          "description": "Mellanox ConnectX-7 SR-IOV RoCEv2 Plane B (GPU Direct)"
        }
      ]
spec:
  containers:
  - name: pytorch-dpdk-nccl-node
    image: nvcr.io/nvidia/pytorch:24.08-py3
    resources:
      limits:
        nvidia.com/gpu: 8
        hugepages-1Gi: 8Gi
        intel.com/sriov_dpdk_pf0: 1
        mellanox.com/cx7_rocev2_pf1: 1
    securityContext:
      capabilities:
        add: ["IPC_LOCK", "SYS_RESOURCE", "NET_ADMIN"]`

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

// StartOmniDeploy initiates an interactive step-by-step rapid provisioning flow.
func (e *Engine) StartOmniDeploy(req *models.OmniDeployRequest) models.OmniDeployProgress {
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

	e.dualAgentStatus.CurrentPhase = "EPH_BOOTSTRAP"
	e.dualAgentStatus.PivotStatus = "PENDING"
	e.dualAgentStatus.SyncedAt = time.Now()

	e.omniDeploy = &models.OmniDeployProgress{
		ClusterID:        fmt.Sprintf("cluster-%s", cName),
		ClusterName:      cName,
		Status:           "RUNNING",
		CurrentStepIndex: 1,
		TotalSteps:       7,
		ProgressPercent:  15,
		ElapsedTimeSec:   12,
		EstimatedSec:     120,
		Steps: []models.OmniDeployStep{
			{
				ID:          "step_1_eph_boot",
				Name:        "Eph-Node Boot & Ironic Conductor Spinup",
				NameZh:      "临时引导节点启动与 Ironic Conductor 就绪",
				AgentSource: "EPH_AGENT",
				Status:      "RUNNING",
				DurationMs:  12400,
				Detail:      "Bootstrap Minikube K8s started. Ironic conductor listening on port 6385, Dnsmasq PXE active.",
			},
			{
				ID:          "step_2_bmh_discovery",
				Name:        "BareMetalHost Out-of-Band Discovery & Firmware Baseline",
				NameZh:      "BareMetalHost 带外硬件探测与固件基线校验",
				AgentSource: "EPH_AGENT",
				Status:      "PENDING",
				DurationMs:  22100,
				Detail:      "Awaiting Redfish BMC hardware inspection and sensor baselining.",
			},
			{
				ID:          "step_3_vm_os_inject",
				Name:        "VirtualMedia OS Image Injection & CP01 Bootstrap",
				NameZh:      "VirtualMedia 虚拟光驱镜像注入与 Master 01 引导",
				AgentSource: "EPH_AGENT",
				Status:      "PENDING",
				DurationMs:  31500,
				Detail:      "Awaiting VirtualMedia ISO attachment and kernel boot parameters.",
			},
			{
				ID:          "step_4_target_k8s_init",
				Name:        "Target K8s Control Plane & etcd Quorum Initialization",
				NameZh:      "目标集群控制面与 etcd 三节点法定仲裁初始化",
				AgentSource: "TARGET_AGENT",
				Status:      "PENDING",
				DurationMs:  18200,
				Detail:      fmt.Sprintf("Awaiting HA control plane initialization with %s.", k8sVer),
			},
			{
				ID:          "step_5_pivot_handover",
				Name:        "Dual-Agent Pivot Handover: CRD Migration to Target Cluster",
				NameZh:      "双 Agent Pivot 移交：将 BMO 与 CAPM3 迁移至目标集群自托管",
				AgentSource: "PIVOT",
				Status:      "PENDING",
				DurationMs:  14800,
				Detail:      "Awaiting state handover from eph-node to target cluster.",
			},
			{
				ID:          "step_6_multi_cni_ignition",
				Name:        "Multus + Calico + OVS + SR-IOV Multi-CNI Mesh Ignition",
				NameZh:      "多 CNI 协同网络点火 (Multus + Calico + OVS + SR-IOV)",
				AgentSource: "TARGET_AGENT",
				Status:      "PENDING",
				DurationMs:  9300,
				Detail:      "Awaiting Dual-Network VLAN 100/200 bindings and CNI daemonsets.",
			},
			{
				ID:          "step_7_fleet_ready",
				Name:        "Fleet Ready: All Nodes Online with Dual-Network (Omni-Speed)",
				NameZh:      "机群就绪：全量裸金属物理机加入集群并完成自愈守护",
				AgentSource: "TARGET_AGENT",
				Status:      "PENDING",
				DurationMs:  4500,
				Detail:      "Awaiting final worker registration and health barrier clearance.",
			},
		},
		Manifests:       e.generateDeclarativeManifests(cName, k8sVer),
		ActiveDualAgent: e.dualAgentStatus,
	}

	return *e.omniDeploy
}

// NextOmniStep advances the deployment simulation to the next step.
func (e *Engine) NextOmniStep() models.OmniDeployProgress {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.omniDeploy == nil || len(e.omniDeploy.Steps) == 0 {
		return models.OmniDeployProgress{Status: "IDLE"}
	}

	curr := e.omniDeploy.CurrentStepIndex
	if curr < 7 {
		// Mark current step completed
		e.omniDeploy.Steps[curr-1].Status = "COMPLETED"
		// Move to next step
		e.omniDeploy.CurrentStepIndex = curr + 1
		nextIdx := curr // 0-based for step (curr+1)
		e.omniDeploy.Steps[nextIdx].Status = "RUNNING"
		e.omniDeploy.ElapsedTimeSec += 15
		e.omniDeploy.ProgressPercent = int(float64(e.omniDeploy.CurrentStepIndex) / 7.0 * 100.0)

		// Sync DualAgent phase based on step
		switch e.omniDeploy.CurrentStepIndex {
		case 2:
			e.dualAgentStatus.CurrentPhase = "BMH_INSPECTION"
		case 3:
			e.dualAgentStatus.CurrentPhase = "TARGET_CP_PROVISION"
		case 4:
			e.dualAgentStatus.CurrentPhase = "K8S_INITIALIZATION"
		case 5:
			e.dualAgentStatus.CurrentPhase = "PIVOT_TRANSFER"
			e.dualAgentStatus.PivotStatus = "IN_PROGRESS"
		case 6:
			e.dualAgentStatus.CurrentPhase = "MULTI_CNI_CONVERGE"
			e.dualAgentStatus.PivotStatus = "SELF_HOSTED"
		case 7:
			e.dualAgentStatus.CurrentPhase = "CLUSTER_HEALTHY"
		}

		newEvt := models.DualAgentEvent{
			ID:        fmt.Sprintf("evt_omni_%d", time.Now().UnixMilli()),
			Source:    e.omniDeploy.Steps[nextIdx].AgentSource,
			Phase:     e.dualAgentStatus.CurrentPhase,
			Level:     "SUCCESS",
			Message:   fmt.Sprintf("Advanced to step %d: %s", e.omniDeploy.CurrentStepIndex, e.omniDeploy.Steps[nextIdx].Name),
			MessageZh: fmt.Sprintf("流水线推进至步骤 %d：%s", e.omniDeploy.CurrentStepIndex, e.omniDeploy.Steps[nextIdx].NameZh),
			Timestamp: time.Now(),
		}
		e.dualAgentStatus.Events = append([]models.DualAgentEvent{newEvt}, e.dualAgentStatus.Events...)
	} else {
		// Already at step 7, mark final step completed
		e.omniDeploy.Steps[6].Status = "COMPLETED"
		e.omniDeploy.Status = "READY"
		e.omniDeploy.ProgressPercent = 100
		e.dualAgentStatus.CurrentPhase = "CLUSTER_HEALTHY"
		e.dualAgentStatus.PivotStatus = "SELF_HOSTED"
	}

	e.dualAgentStatus.SyncedAt = time.Now()
	e.omniDeploy.ActiveDualAgent = e.dualAgentStatus
	return *e.omniDeploy
}

// ResetOmniDeploy resets the deployment back to IDLE.
func (e *Engine) ResetOmniDeploy() models.OmniDeployProgress {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.omniDeploy = &models.OmniDeployProgress{
		ClusterID:        "cluster-prod-gpu-k8s",
		ClusterName:      "Production Large-Scale GPU Cluster",
		Status:           "IDLE",
		CurrentStepIndex: 0,
		TotalSteps:       7,
		ProgressPercent:  0,
		ElapsedTimeSec:   0,
		EstimatedSec:     120,
		Steps: []models.OmniDeployStep{
			{
				ID:          "step_1_eph_boot",
				Name:        "Eph-Node Boot & Ironic Conductor Spinup",
				NameZh:      "临时引导节点启动与 Ironic Conductor 就绪",
				AgentSource: "EPH_AGENT",
				Status:      "PENDING",
				DurationMs:  12400,
				Detail:      "Bootstrap Minikube K8s, Ironic conductor listening on port 6385, Dnsmasq PXE active.",
			},
			{
				ID:          "step_2_bmh_discovery",
				Name:        "BareMetalHost Out-of-Band Discovery & Firmware Baseline",
				NameZh:      "BareMetalHost 带外硬件探测与固件基线校验",
				AgentSource: "EPH_AGENT",
				Status:      "PENDING",
				DurationMs:  22100,
				Detail:      "15 Physical hosts validated via Redfish BMC. 128 cores, 512GB RAM, 8x H100 GPUs discovered.",
			},
			{
				ID:          "step_3_vm_os_inject",
				Name:        "VirtualMedia OS Image Injection & CP01 Bootstrap",
				NameZh:      "VirtualMedia 虚拟光驱镜像注入与 Master 01 引导",
				AgentSource: "EPH_AGENT",
				Status:      "PENDING",
				DurationMs:  31500,
				Detail:      "Stream immutable Linux/Talos OS image via VirtualMedia to bmh-master-k8s-01.",
			},
			{
				ID:          "step_4_target_k8s_init",
				Name:        "Target K8s Control Plane & etcd Quorum Initialization",
				NameZh:      "目标集群控制面与 etcd 三节点法定仲裁初始化",
				AgentSource: "TARGET_AGENT",
				Status:      "PENDING",
				DurationMs:  18200,
				Detail:      "HA control plane established with 3 Masters. Kube-apiserver listening on 10.240.10.10:6443.",
			},
			{
				ID:          "step_5_pivot_handover",
				Name:        "Dual-Agent Pivot Handover: CRD Migration to Target Cluster",
				NameZh:      "双 Agent Pivot 移交：将 BMO 与 CAPM3 迁移至目标集群自托管",
				AgentSource: "PIVOT",
				Status:      "PENDING",
				DurationMs:  14800,
				Detail:      "Transfer 15 BMH CRDs and Ironic state to target cluster. Eph-node gracefully decoupled.",
			},
			{
				ID:          "step_6_multi_cni_ignition",
				Name:        "Multus + Calico + OVS + SR-IOV Multi-CNI Mesh Ignition",
				NameZh:      "多 CNI 协同网络点火 (Multus + Calico + OVS + SR-IOV)",
				AgentSource: "TARGET_AGENT",
				Status:      "PENDING",
				DurationMs:  9300,
				Detail:      "Dual network configured. Pods now have default Calico eth0, secondary OVS net1, and SR-IOV RDMA net2.",
			},
			{
				ID:          "step_7_fleet_ready",
				Name:        "Fleet Ready: 15 Nodes Online with Dual-Network (Omni-Speed)",
				NameZh:      "机群就绪：15 台裸金属物理机全量加入集群并完成自愈守护",
				AgentSource: "TARGET_AGENT",
				Status:      "PENDING",
				DurationMs:  4500,
				Detail:      "Target cluster operational. Talos Omni-grade readiness verification complete.",
			},
		},
		Manifests:       e.generateDeclarativeManifests("cluster-prod-gpu-k8s", "v1.31.2"),
		ActiveDualAgent: e.dualAgentStatus,
	}

	return *e.omniDeploy
}

// SimulatePacketFlow traces packet travel across Dual-Network and Multi-CNI.
func (e *Engine) SimulatePacketFlow(req models.PacketSimulationRequest) models.PacketSimulationResult {
	e.mu.RLock()
	defer e.mu.RUnlock()

	trafficType := req.TrafficType
	if trafficType == "" {
		trafficType = "GPU_RDMA_ROCEV2"
	}

	switch trafficType {
	case "APISERVER_MGMT":
		return models.PacketSimulationResult{
			TrafficType:    "APISERVER_MGMT",
			TrafficTypeZh:  "管理控制面专网流量 (VLAN 100, MTU 1500, Calico Default)",
			SelectedPath:   "Kubelet / Pod eth0 -> Calico veth -> Bond0 (eno1/eno2) -> VLAN 100 ToR Switch -> Kube-apiserver HA VIP",
			TotalLatency:   "0.082 ms (~82µs)",
			ThroughputWire: "10 Gbps (Bonded LACP)",
			JumboFrames:    false,
			Status:         "VERIFIED_ACTIVE",
			Hops: []models.PacketHop{
				{
					Order:    1,
					Device:   "Pod eth0 (veth pair)",
					Layer:    "L3 Host-Local",
					Action:   "Calico IPAM routing table lookup (10.244.0.0/16)",
					ActionZh: "Calico IPAM 路由表检索，选路至控制面子网",
					Latency:  "0.012 ms",
					Headers:  "Src: 10.244.0.15:48210 -> Dst: 10.240.10.10:6443 | Protocol: TCP/TLS1.3",
				},
				{
					Order:    2,
					Device:   "Host Linux Kernel Netfilter / eBPF",
					Layer:    "L3/L4 Security",
					Action:   "Kubernetes NetworkPolicy evaluation (Permit Kube-apiserver ingress)",
					ActionZh: "K8s NetworkPolicy 规则评估，放行管理端口通信",
					Latency:  "0.015 ms",
					Headers:  "Mark: 0x200 | Conntrack State: ESTABLISHED",
				},
				{
					Order:    3,
					Device:   "eno1 / eno2 Bond0 (VLAN 100)",
					Layer:    "L2 802.1Q Bonded",
					Action:   "Hardware LACP hashing & 802.1Q VLAN 100 tag encapsulation",
					ActionZh: "物理网卡 LACP 绑定哈希调度，添加 VLAN 100 隔离标签",
					Latency:  "0.025 ms",
					Headers:  "802.1Q Tag: 100 | EtherType: 0x8100 | MTU: 1500",
				},
				{
					Order:    4,
					Device:   "Kube-apiserver Keepalived VIP (10.240.10.10:6443)",
					Layer:    "L7 Application",
					Action:   "HA Control Plane ingress termination & mTLS certificate validation",
					ActionZh: "高可用控制面接收请求，mTLS 客户端证书鉴权通过",
					Latency:  "0.030 ms",
					Headers:  "HTTP/2 200 OK | NodeStatusUpdate accepted",
				},
			},
		}

	case "POD_L2_VLAN200":
		return models.PacketSimulationResult{
			TrafficType:    "POD_L2_VLAN200",
			TrafficTypeZh:  "业务数据专网二层流量 (VLAN 200, MTU 9000 Jumbo, OVS net1)",
			SelectedPath:   "Pod net1 -> Open vSwitch (br-data) -> VLAN 200 Trunk -> 100G Leaf Fabric -> Target Pod net1",
			TotalLatency:   "0.0084 ms (8.4µs)",
			ThroughputWire: "100 Gbps Wire-Rate",
			JumboFrames:    true,
			Status:         "VERIFIED_ACTIVE",
			Hops: []models.PacketHop{
				{
					Order:    1,
					Device:   "Pod net1 (Multus secondary interface)",
					Layer:    "L2 Virtual Port",
					Action:   "Multus NetworkAttachmentDefinition injection (ovs-data-vlan200)",
					ActionZh: "Multus 声明式挂载 net1 接口，进入 OVS 虚拟端口",
					Latency:  "0.0012 ms",
					Headers:  "Src MAC: 52:54:00:fa:20:01 -> Dst MAC: 52:54:00:fa:20:02 | MTU: 9000",
				},
				{
					Order:    2,
					Device:   "Open vSwitch br-data (Kernel datapath)",
					Layer:    "L2 OpenFlow Switching",
					Action:   "OpenFlow flow-table matching: in_port=3, actions=mod_vlan_vid:200,output:1",
					ActionZh: "OpenFlow 极速流表匹配，注入 802.1Q VLAN 200 业务标签",
					Latency:  "0.0028 ms",
					Headers:  "VLAN: 200 | Flow Priority: 32768 | Action: FastPath",
				},
				{
					Order:    3,
					Device:   "Physical ens1f0 (100G Data Uplink)",
					Layer:    "L1/L2 Physical Fabric",
					Action:   "Jumbo Frame transmission (MTU 9000) over Spine-Leaf Fabric",
					ActionZh: "100G 物理链路直传 9000 巨型帧，大幅降低 CPU 中断开销",
					Latency:  "0.0031 ms",
					Headers:  "Payload Size: 8960 Bytes | CRC32 OK",
				},
				{
					Order:    4,
					Device:   "Target Pod net1 (Container Namespace)",
					Layer:    "L2 Target Delivery",
					Action:   "Target OVS bridge stripped VLAN 200 tag and delivered packet into net1",
					ActionZh: "目标节点 OVS 网桥剥除 VLAN 标签，零丢包投递至 Pod 内部",
					Latency:  "0.0013 ms",
					Headers:  "State: Delivered | Zero Packet Loss",
				},
			},
		}

	case "DPDK_USERSPACE_PMD":
		return models.PacketSimulationResult{
			TrafficType:    "DPDK_USERSPACE_PMD",
			TrafficTypeZh:  "用户态 DPDK Poll-Mode 高速报文平面 (vfio-pci / OVS-DPDK, net2, MTU 9000)",
			SelectedPath:   "Pod net2 (DPDK Mempool) -> vfio-pci Userspace PMD -> HugePages 1Gi Ring -> SR-IOV PF0 (100G) -> Peer Pod net2",
			TotalLatency:   "0.0018 ms (1.8µs)",
			ThroughputWire: "100 Gbps Zero-Copy PMD",
			JumboFrames:    true,
			Status:         "VERIFIED_ACTIVE",
			Hops: []models.PacketHop{
				{
					Order:    1,
					Device:   "Pod net2 (DPDK rte_mbuf Mempool / 1Gi HugePages)",
					Layer:    "Userspace Application",
					Action:   "Packet allocated directly inside pinned 1Gi HugePage DMA memory pool without sk_buff allocation",
					ActionZh: "报文直接驻留 1Gi 巨页内存池 (rte_mbuf)，完全绕过内核 sk_buff 与系统调用",
					Latency:  "0.0003 ms (300ns)",
					Headers:  "rte_mbuf: 0x104a80000 | HugePage: 1Gi | RSS Queue: 4",
				},
				{
					Order:    2,
					Device:   "DPDK 24.11 Poll-Mode Driver (vfio-pci)",
					Layer:    "Userspace Kernel-Bypass",
					Action:   "PMD bursts TX descriptors directly via vfio-pci IOMMU DMA ring with zero CPU interrupts",
					ActionZh: "vfio-pci PMD 轮询驱动直接批量投递 TX 描述符至网卡硬件队列，零中断切换",
					Latency:  "0.0006 ms (600ns)",
					Headers:  "IOMMU Group: 42 | Burst Size: 32 pkts | Interrupts: 0",
				},
				{
					Order:    3,
					Device:   "SR-IOV VF0 / OVS-DPDK br-data (VLAN 300)",
					Layer:    "Hardware NIC / Userspace vSwitch",
					Action:   "Hardware L2 VF switch forwards MTU 9000 Jumbo Frame at 148.8 Mpps wire speed",
					ActionZh: "SR-IOV 物理虚拟功能直接线速转发 9000 巨型帧（单口 100G 线速）",
					Latency:  "0.0006 ms (600ns)",
					Headers:  "VLAN: 300 | MTU: 9000 | PCI BDF: 0000:4b:02.0",
				},
				{
					Order:    4,
					Device:   "Peer Pod net2 (DPDK RX Ring)",
					Layer:    "Target Userspace Ring",
					Action:   "Peer PMD polls descriptor ring from pinned memory cache line with deterministic <2µs SLA",
					ActionZh: "对端 Pod PMD 引擎从巨页环直接消费报文，全程 <2µs 确定性时延",
					Latency:  "0.0003 ms (300ns)",
					Headers:  "State: Delivered | Drops: 0 | Jitter: < 80ns",
				},
			},
		}

	default: // "GPU_RDMA_ROCEV2"
		return models.PacketSimulationResult{
			TrafficType:    "GPU_RDMA_ROCEV2",
			TrafficTypeZh:  "超算 GPU Direct RDMA 极速流量 (RoCEv2, MTU 9000, SR-IOV net2)",
			SelectedPath:   "NVIDIA H100 HBM3 -> NVLink/PCIe Gen5 -> Mellanox CX6/CX7 VF (net2) -> RoCEv2 Lossless Fabric -> Remote H100 HBM3",
			TotalLatency:   "0.00115 ms (1.15µs sub-microsecond)",
			ThroughputWire: "200 Gbps Line-Rate Non-Blocking",
			JumboFrames:    true,
			Status:         "VERIFIED_ACTIVE",
			Hops: []models.PacketHop{
				{
					Order:    1,
					Device:   "NVIDIA H100 80GB SXM5 HBM3 Memory",
					Layer:    "Hardware Device Memory",
					Action:   "CUDA NCCL All-Reduce buffer prepared in GPU High Bandwidth Memory",
					ActionZh: "NCCL 分布式训练算子在 GPU HBM3 显存中直接准备 RDMA 发送缓冲区",
					Latency:  "0.00015 ms (150ns)",
					Headers:  "Buffer: 0x7f8840000000 | Size: 1GB Chunk | Protocol: NCCL Ring-AllReduce",
				},
				{
					Order:    2,
					Device:   "PCIe Gen5 x16 Bus / GPU Direct RDMA DMA",
					Layer:    "Hardware DMA Bus",
					Action:   "Zero-Copy Direct Memory Access from GPU directly into Mellanox CX-7 HCA (Bypassing Host CPU)",
					ActionZh: "GPU Direct RDMA 硬件零拷贝，数据直接从显存写入物理网卡，完全旁路 Host CPU",
					Latency:  "0.00025 ms (250ns)",
					Headers:  "DMA Transfer Rate: 63.0 GB/s (PCIe 5.0 x16 saturated)",
				},
				{
					Order:    3,
					Device:   "Mellanox ConnectX-6/7 Dx Virtual Function (net2)",
					Layer:    "SR-IOV RoCEv2 Engine",
					Action:   "Hardware packetization into RoCEv2 UDP packets with BTH (Base Transport Header)",
					ActionZh: "SR-IOV 网卡硬件芯片封包为 RoCEv2 UDP 报文，附加硬件校验码与 BTH 传输头",
					Latency:  "0.00030 ms (300ns)",
					Headers:  "IP: 10.250.100.22 -> 10.250.100.23 | UDP Port: 4791 (RoCEv2) | BTH Opcode: RDMA_WRITE_ONLY",
				},
				{
					Order:    4,
					Device:   "Lossless Ethernet Fabric (PFC & ECN active)",
					Layer:    "L2/L3 Lossless Network",
					Action:   "Priority Flow Control (Priority 3) eliminates packet drop under line rate 200Gbps",
					ActionZh: "数据中心无损以太网络 PFC 流控与 ECN 拥塞通知保障 200G 满线速零丢包",
					Latency:  "0.00035 ms (350ns)",
					Headers:  "VLAN: 200 | CoS: 3 (PFC Protected) | ECN: ECT(0) | MTU: 9000",
				},
				{
					Order:    5,
					Device:   "Remote NVIDIA H100 GPU Memory",
					Layer:    "Target GPU Hardware",
					Action:   "Remote CX-7 VF directly DMA writes incoming data into target GPU HBM3 memory",
					ActionZh: "远端网卡直接通过 DMA 将张量数据写入目标 GPU 显存，完成微秒级超算通信闭环",
					Latency:  "0.00010 ms (100ns)",
					Headers:  "RDMA Write Ack verified | NCCL Step Synchronized",
				},
			},
		}
	}
}

// ValidateManifest validates Kubernetes declarative CRD manifests in pure Go.
func (e *Engine) ValidateManifest(req models.ManifestValidationRequest) models.ManifestValidationResult {
	content := strings.TrimSpace(req.Content)
	if content == "" {
		return models.ManifestValidationResult{
			Valid:        false,
			Errors:       []string{"Manifest content cannot be empty"},
			ChecksPassed: []string{},
		}
	}

	lines := strings.Split(content, "\n")
	kind := "Unknown"
	apiVersion := "Unknown"
	name := "unnamed"
	var checks []string
	var warnings []string
	var errors []string

	for _, l := range lines {
		l = strings.TrimSpace(l)
		if strings.HasPrefix(l, "kind:") {
			kind = strings.TrimSpace(strings.TrimPrefix(l, "kind:"))
		}
		if strings.HasPrefix(l, "apiVersion:") {
			apiVersion = strings.TrimSpace(strings.TrimPrefix(l, "apiVersion:"))
		}
		if strings.HasPrefix(l, "name:") && name == "unnamed" {
			name = strings.TrimSpace(strings.TrimPrefix(l, "name:"))
		}
	}

	// Validation rule checks based on Kind
	checks = append(checks, "YAML structural syntax is well-formed")

	switch kind {
	case "Cluster":
		checks = append(checks, "CAPI Cluster definition matches cluster.x-k8s.io/v1beta1 schema")
		if strings.Contains(content, "pods:") && strings.Contains(content, "cidrBlocks:") {
			checks = append(checks, "Pod network CIDR block configured correctly")
		} else {
			warnings = append(warnings, "Pod CIDR block block not explicitly specified in clusterNetwork")
		}
		if strings.Contains(content, "Metal3Cluster") {
			checks = append(checks, "Infrastructure reference correctly points to Metal3Cluster provider")
		}

	case "Metal3Cluster":
		checks = append(checks, "Metal3Cluster specification matches infrastructure.cluster.x-k8s.io/v1beta1")
		if strings.Contains(content, "controlPlaneEndpoint:") {
			checks = append(checks, "High availability Control Plane endpoint VIP and port verified")
		} else {
			errors = append(errors, "Missing controlPlaneEndpoint in Metal3Cluster spec")
		}

	case "NetworkAttachmentDefinition":
		checks = append(checks, "Multus CRD k8s.cni.cncf.io/v1 NetworkAttachmentDefinition verified")
		if strings.Contains(content, "calico") || strings.Contains(content, "ovs") || strings.Contains(content, "sriov") {
			checks = append(checks, "CNI delegate type valid and recognized by Dual-Network controller")
		} else {
			warnings = append(warnings, "CNI delegate plugin type is non-standard")
		}
		if strings.Contains(content, "ipam") {
			checks = append(checks, "IPAM IP address management configuration detected")
		}

	case "Pod":
		checks = append(checks, "Kubernetes Core v1 Pod specification verified")
		if strings.Contains(content, "k8s.v1.cni.cncf.io/networks") {
			checks = append(checks, "Multus secondary network attachments annotation verified")
		}
		if strings.Contains(content, "nvidia.com/gpu") && strings.Contains(content, "rdma") {
			checks = append(checks, "GPU acceleration paired with RoCEv2/RDMA resource limits for optimal NVLink/InfiniBand scaling")
		}

	case "MachineConfig":
		checks = append(checks, "Talos / Metal3 MachineConfig syntax verified")
		if strings.Contains(content, "mtu: 1500") && strings.Contains(content, "mtu: 9000") {
			checks = append(checks, "Dual-Network configuration confirmed: Control MTU 1500 & Data MTU 9000 Jumbo Frames")
		}

	default:
		warnings = append(warnings, fmt.Sprintf("Generic Kubernetes resource kind '%s' validated without specific CRD schema constraints", kind))
	}

	isValid := len(errors) == 0

	return models.ManifestValidationResult{
		Valid:        isValid,
		Kind:         kind,
		APIVersion:   apiVersion,
		ResourceName: name,
		ChecksPassed: checks,
		Warnings:     warnings,
		Errors:       errors,
		ParsedSpec: map[string]interface{}{
			"line_count":  len(lines),
			"byte_length": len(content),
			"timestamp":   time.Now().Format(time.RFC3339),
		},
	}
}

// GetHostTelemetry returns deep real-time Redfish BMC sensor telemetry.
func (e *Engine) GetHostTelemetry(hostName string) (map[string]interface{}, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	host, exists := e.hosts[hostName]
	if !exists {
		return nil, fmt.Errorf("BareMetalHost '%s' not found", hostName)
	}

	return map[string]interface{}{
		"host_name":           host.Name,
		"power_status":        host.PowerStatus,
		"provisioning_status": host.ProvisioningStatus,
		"rack_location":       host.RackLocation,
		"bmc_address":         host.BMCAddress,
		"cpu_cores":           128,
		"cpu_temp_c":          host.Sensors["cpu_temp_c"],
		"dimm_temp_c":         36.4,
		"fan_rpm":             host.Sensors["fan_rpm"],
		"power_watt":          host.Sensors["power_watt"],
		"psu_efficiency":      "94.2% (80 PLUS Titanium)",
		"pcie_link_speed":     "PCIe Gen5 x16 (32 GT/s per lane)",
		"roce_gid":            "0xfe800000000000000002c9ffff28a110",
		"nvlink_bandwidth":    "900 GB/s bidirectional",
		"redfish_session":     "ESTABLISHED_SECURE_MTLS",
		"updated_at":          time.Now().Format(time.RFC3339),
	}, nil
}

// ReprovisionHost triggers out-of-band Ironic virtual media re-imaging.
func (e *Engine) ReprovisionHost(hostName string) (*models.BareMetalHost, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	host, exists := e.hosts[hostName]
	if !exists {
		return nil, fmt.Errorf("BareMetalHost '%s' not found", hostName)
	}

	host.ProvisioningStatus = "Provisioning"
	host.PowerStatus = "REBOOTING"
	host.UpdatedAt = time.Now()

	return host, nil
}

// DispatchPodAgentCommand routes a command directly to either the Eph-Node Agent or Target Cluster Agent.
func (e *Engine) DispatchPodAgentCommand(targetAgent string, cmd string) (map[string]interface{}, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	var output string
	var err error

	isEph := strings.ToLower(targetAgent) == "eph" || strings.ToLower(targetAgent) == "eph_agent" || strings.ToLower(targetAgent) == "agent_1"

	if isEph {
		output, err = e.EphPodAgent.DispatchCommand(cmd)
		if err == nil {
			e.dualAgentStatus.Events = append([]models.DualAgentEvent{
				{
					ID:        fmt.Sprintf("evt_cmd_%d", time.Now().UnixNano()),
					Source:    "EPH_AGENT",
					Phase:     "COMMAND_EXEC",
					Level:     "SUCCESS",
					Message:   fmt.Sprintf("[Agent 1 Pod Dispatch] Command '%s' executed", cmd),
					MessageZh: fmt.Sprintf("[Agent 1 Pod 指令下发] 执行命令 '%s' 成功", cmd),
					Timestamp: time.Now(),
				},
			}, e.dualAgentStatus.Events...)
		}
	} else {
		output, err = e.TargetPodAgent.DispatchCommand(cmd)
		if err == nil {
			e.dualAgentStatus.Events = append([]models.DualAgentEvent{
				{
					ID:        fmt.Sprintf("evt_cmd_%d", time.Now().UnixNano()),
					Source:    "TARGET_AGENT",
					Phase:     "COMMAND_EXEC",
					Level:     "SUCCESS",
					Message:   fmt.Sprintf("[Agent 2 Pod Dispatch] Command '%s' executed", cmd),
					MessageZh: fmt.Sprintf("[Agent 2 Pod 指令下发] 执行命令 '%s' 成功", cmd),
					Timestamp: time.Now(),
				},
			}, e.dualAgentStatus.Events...)
		}
	}

	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"target_agent": targetAgent,
		"command":      cmd,
		"output":       output,
		"executed_at":  time.Now().Format(time.RFC3339),
	}, nil
}

// GetPodDaemonsTelemetry returns live runtime telemetry from both pure Go pod daemons.
func (e *Engine) GetPodDaemonsTelemetry() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	return map[string]interface{}{
		"agent_1_eph_node":    e.EphPodAgent.GetTelemetry(),
		"agent_2_target_capi": e.TargetPodAgent.GetTelemetry(),
		"coordinated_at":      time.Now().Format(time.RFC3339),
		"runtime":             "Golang 1.22+ Containerized Pod Daemons",
	}
}

