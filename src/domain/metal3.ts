/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PowerStatus = 'ON' | 'OFF' | 'REBOOTING' | 'PXE_BOOTING' | 'UNKNOWN';

export type ProvisioningStatus =
  | 'Registering'
  | 'Inspecting'
  | 'Available'
  | 'Preparing'
  | 'Provisioning'
  | 'Provisioned'
  | 'ReadyForCluster'
  | 'ActiveInCluster'
  | 'Deprovisioning'
  | 'Error'
  | 'Degraded'
  | 'Provisioning Failed';

export interface HostAlert {
  id: string;
  host_name: string;
  severity: 'CRITICAL' | 'WARNING';
  status: 'ACTIVE' | 'RESOLVING' | 'RESOLVED';
  rule: 'PROVISIONING_FAILED' | 'NODE_DEGRADED' | 'BMC_UNREACHABLE' | 'THERMAL_CRITICAL' | 'NVME_SMART_DEGRADED';
  title: string;
  title_en: string;
  message: string;
  message_en: string;
  error_code: string;
  diagnostics: {
    phase: string;
    bmc_ip?: string;
    temperature_c?: number;
    error_detail: string;
    suggested_remediation: string;
  };
  detected_at: string;
  resolved_at?: string;
  dispatched_channels: string[];
}

export type TargetClusterStatus =
  | 'DRAFT'
  | 'DISCOVERING_HARDWARE'
  | 'PROVISIONING_OS'
  | 'INIT_CONTROL_PLANE'
  | 'JOINING_WORKERS'
  | 'CONFIGURING_GPU_ROCE'
  | 'PIVOTING'
  | 'HEALTHY_OPERATIONAL'
  | 'SCALING_UP'
  | 'SCALING_DOWN'
  | 'UPGRADING_VERSION'
  | 'FAILED';

export interface EphNodeComponent {
  name: string;
  category: 'K8S_CORE' | 'IRONIC_STACK' | 'METAL3_OPERATOR' | 'AI_AGENT_DAEMON';
  status: 'Running' | 'Degraded' | 'Stopped';
  version: string;
  details: string;
}

export interface EphAgentTelemetry {
  name: string;
  version: string;
  status: 'ACTIVE_AUTONOMOUS' | 'DISPATCHING_JOB' | 'IDLE';
  uptime_seconds: number;
  last_heartbeat: string;
  mtls_state: 'TLS_AES_256_GCM_SHA384_VERIFIED' | 'CONNECTED';
  cpu_usage_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  autonomous_decisions_count: number;
  active_reconciliations: string[];
}

export interface EphemeralBootstrapNode {
  id: string;
  name: string;
  role: 'SINGLE_NODE_BOOTSTRAP_K8S';
  k8s_version: string;
  status: 'ONLINE' | 'PROVISIONING_FLEET' | 'PIVOTING' | 'STANDBY_POST_PIVOT';
  ip_address: string;
  host_specs: {
    cpu: string;
    memory_gb: number;
    storage: string;
    os: string;
  };
  networks: {
    pxe_provisioning_cidr: string;
    bmc_oob_cidr: string;
    control_plane_uplink: string;
  };
  components: EphNodeComponent[];
  agent_daemon: {
    name: string;
    version: string;
    status: 'ACTIVE_AUTONOMOUS' | 'DISPATCHING_JOB' | 'IDLE';
    last_heartbeat: string;
    connected_to_control_plane: boolean;
    active_job_id: string | null;
    autonomous_capabilities: string[];
  };
}

export interface BareMetalHostHardware {
  vendor: string;
  model: string;
  cpu: string;
  cores: number;
  ram_gb: number;
  nvme_tb: number;
  gpus: string;
  nics: string;
}

export interface BareMetalHostSensors {
  cpu_temp_c: number;
  fan_speed_rpm: number;
  power_watts: number;
  system_health: 'OK' | 'WARNING' | 'CRITICAL';
  dimm_status: string;
  nvme_smart_health: string;
}

export interface BareMetalHostIpAddresses {
  bmc_ip: string;
  provisioning_ip: string;
  target_ip: string;
}

export interface SupportedK8sVersion {
  id: string;
  version: string;
  major_minor: string;
  display_name: string;
  display_name_zh: string;
  channel: 'PREVIEW' | 'LATEST' | 'STABLE' | 'LTS' | 'MAINTENANCE';
  release_date: string;
  status: string;
  status_zh: string;
  badge_color: string;
  talos_linux: string;
  containerd_version: string;
  roce_optimized: boolean;
  dra_version: string;
  description_en: string;
  description_zh: string;
  features_zh: string[];
  features_en: string[];
  recommended_for: string;
}

export const SUPPORTED_K8S_VERSIONS: SupportedK8sVersion[] = [
  {
    id: 'v1.36.0-dev',
    version: 'v1.36.0-dev',
    major_minor: 'v1.36',
    display_name: 'Kubernetes v1.36 (Bleeding-Edge / 2026 Q4)',
    display_name_zh: 'Kubernetes v1.36 (超前研发预览版 / 2026 Q4)',
    channel: 'PREVIEW',
    release_date: '2026-10-15',
    status: 'Bleeding Edge',
    status_zh: '超前尝鲜',
    badge_color: 'purple',
    talos_linux: 'v1.9.0-alpha',
    containerd_version: 'v2.1.0-beta.1',
    roce_optimized: true,
    dra_version: 'DRA v2 Native Multi-Tenant',
    description_en: 'Cutting-edge AI supercomputing kernel, native hardware RoCEv2 Direct fabric NUMA pinning, zero-overhead in-pod cgroup v2 tiering, and sub-millisecond pod startup.',
    description_zh: '前沿 AI 超算原生架构，深度支持 RoCEv2 Direct 织网 NUMA 感知、动态硬件资源分配 (DRA v2) 与低至微秒级的 Pod 瞬时初始化。',
    features_zh: [
      'DRA v2 原生多租户 GPU 切分与动态隔离',
      'RoCEv2 200Gbps 直通与网卡级 NUMA 亲和调度',
      '全新 Linux 6.12+ eBPF 零开销转发与加密隧道',
      '原生支持大模型推演容器零拷贝内存预热'
    ],
    features_en: [
      'DRA v2 Native Multi-tenant GPU partitioning & dynamic slicing',
      'RoCEv2 200Gbps Direct & NIC-level NUMA affinity scheduler',
      'Linux 6.12+ eBPF zero-overhead dataplane & TLS offload',
      'Zero-copy memory pre-warming for LLM inference containers'
    ],
    recommended_for: 'Next-Gen AI Labs, Multi-Pod H100/B200 Clusters, Autonomous Research'
  },
  {
    id: 'v1.35.0',
    version: 'v1.35.0',
    major_minor: 'v1.35',
    display_name: 'Kubernetes v1.35 (Production Bleeding Edge / 2026 Q2)',
    display_name_zh: 'Kubernetes v1.35 (最新生产级推荐 / 2026 Q2)',
    channel: 'LATEST',
    release_date: '2026-04-18',
    status: 'Production Ready',
    status_zh: '最新生产级',
    badge_color: 'emerald',
    talos_linux: 'v1.8.4',
    containerd_version: 'v2.0.2',
    roce_optimized: true,
    dra_version: 'DRA v2 GA',
    description_en: 'Production-hardened GPU Supernode release with Dynamic Resource Allocation GA, Topology-aware GPU scheduling, and Multi-Subnet Pod IPAM v2.',
    description_zh: '面向生产级智算中心的黄金推荐版本，Dynamic Resource Allocation GA，原生多拓扑 GPU 编排，支持跨机架无损 RoCEv2 互联。',
    features_zh: [
      'Dynamic Resource Allocation (DRA) 正式 GA',
      '拓扑感知 GPU 调度（NVLink 全互联优先对齐）',
      '多网卡 Multus v4.1 与 SR-IOV 硬件直通深度优化',
      'Kubelet 内存 QoS cgroup v2 精准降级保护'
    ],
    features_en: [
      'Dynamic Resource Allocation (DRA) officially GA',
      'Topology-aware GPU scheduling with NVLink full-mesh priority',
      'Deep optimization for Multus v4.1 & SR-IOV hardware passthrough',
      'Kubelet memory QoS cgroup v2 precision eviction guard'
    ],
    recommended_for: 'Production Enterprise GPU Clusters, Multi-Node Distributed Training'
  },
  {
    id: 'v1.34.1',
    version: 'v1.34.1',
    major_minor: 'v1.34',
    display_name: 'Kubernetes v1.34 (Enterprise Stable / 2025 Q4)',
    display_name_zh: 'Kubernetes v1.34 (企业稳定版 / 2025 Q4)',
    channel: 'STABLE',
    release_date: '2025-11-20',
    status: 'Enterprise Stable',
    status_zh: '企业稳定版',
    badge_color: 'cyan',
    talos_linux: 'v1.8.2',
    containerd_version: 'v2.0.0',
    roce_optimized: true,
    dra_version: 'In-Place GPU Resize GA',
    description_en: 'Rock-solid enterprise stability featuring In-Place Pod Resource & GPU Resize GA, Structured Authorization, and VolumeAttributesClass.',
    description_zh: '工业级稳健版本，正式支持 Pod 在线无重启热扩容 (In-Place Resize)、结构化 RBAC 授权与多租户存储规格动态适配。',
    features_zh: [
      'Pod 资源与 GPU 算力在线无重启热扩缩 (In-Place Resize)',
      '结构化鉴权策略引擎（Structured Authorization）',
      'mTLS 1.3 严格控制面双向握手防重放',
      '高密度节点挂载延迟降低 45%'
    ],
    features_en: [
      'In-Place Pod Resource & GPU compute resize without restart',
      'Structured Authorization policy engine for Zero-Trust',
      'mTLS 1.3 strict control plane bi-directional handshake',
      'High-density node mount latency reduced by 45%'
    ],
    recommended_for: 'Financial Cloud, Mission-Critical Enterprise Production'
  },
  {
    id: 'v1.33.2',
    version: 'v1.33.2',
    major_minor: 'v1.33',
    display_name: 'Kubernetes v1.33 (Production LTS / 2025 Q2)',
    display_name_zh: 'Kubernetes v1.33 (长期支持版 LTS / 2025 Q2)',
    channel: 'LTS',
    release_date: '2025-05-10',
    status: 'LTS',
    status_zh: '长期支持',
    badge_color: 'blue',
    talos_linux: 'v1.8.0',
    containerd_version: 'v1.7.20',
    roce_optimized: true,
    dra_version: 'DRA GA (Core)',
    description_en: 'Long Term Support foundation with Native Sidecar Containers GA, Kubelet RoCEv2 NUMA Pinning, and hardened KMS v2 encryption.',
    description_zh: '三年长期支持基准版本，原生 Sidecar 容器生命周期 GA，Kubelet 带外高性能 RoCEv2 内存锁死与 KMS v2 硬件级加密。',
    features_zh: [
      '原生 Sidecar 容器生命周期管理 GA',
      'Kubelet 节点网卡 NUMA 亲和锁死',
      'KMS v2 密钥轮换无缝在线升级',
      '跨地域集群控制面防网络抖动隔离'
    ],
    features_en: [
      'Native Sidecar container lifecycle management GA',
      'Kubelet NIC NUMA affinity pinning',
      'KMS v2 key rotation seamless online upgrade',
      'Cross-region control plane network-jitter isolation'
    ],
    recommended_for: 'Regulated Telecom, Healthcare, Government Private Cloud'
  },
  {
    id: 'v1.32.3',
    version: 'v1.32.3',
    major_minor: 'v1.32',
    display_name: 'Kubernetes v1.32 (Active Maintenance / 2024 Q4)',
    display_name_zh: 'Kubernetes v1.32 (活跃维护版 / 2024 Q4)',
    channel: 'MAINTENANCE',
    release_date: '2024-11-28',
    status: 'Maintenance',
    status_zh: '维护期',
    badge_color: 'slate',
    talos_linux: 'v1.7.6',
    containerd_version: 'v1.7.18',
    roce_optimized: false,
    dra_version: 'CDI GA',
    description_en: 'Container Device Interface (CDI) GA, enhanced swap memory QoS, and deterministic pod lifecycle sleep actions.',
    description_zh: 'Container Device Interface (CDI) GA，增强 Swap 内存 QoS 调优，确定性容器生命周期 Sleep 动作。',
    features_zh: [
      'Container Device Interface (CDI) GA',
      '增强型 Swap 内存 QoS 调优',
      'Pod 生命周期 Hook Sleep 动作'
    ],
    features_en: [
      'Container Device Interface (CDI) GA',
      'Enhanced node Swap memory QoS tuning',
      'Pod lifecycle Hook Sleep action'
    ],
    recommended_for: 'Existing K8s 1.32 Infrastructure Migrations'
  },
  {
    id: 'v1.31.4',
    version: 'v1.31.4',
    major_minor: 'v1.31',
    display_name: 'Kubernetes v1.31 (Current Fleet Baseline / 2024 Q3)',
    display_name_zh: 'Kubernetes v1.31 (当前存量基准 / 2024 Q3)',
    channel: 'MAINTENANCE',
    release_date: '2024-08-14',
    status: 'Baseline',
    status_zh: '当前基线',
    badge_color: 'amber',
    talos_linux: 'v1.7.0',
    containerd_version: 'v1.7.15',
    roce_optimized: false,
    dra_version: 'AppArmor GA',
    description_en: 'Current deployment baseline running across initial bare-metal cluster instances, with nftables kube-proxy and AppArmor GA.',
    description_zh: '当前存量裸金属初始安装的基线版本，集成 AppArmor GA 与 nftables 转发。',
    features_zh: [
      'AppArmor 字段原生一等公民支持',
      'Kube-proxy nftables 模式 GA',
      '持久卷在线弹性扩容'
    ],
    features_en: [
      'AppArmor fields native first-class citizen support',
      'Kube-proxy nftables mode GA',
      'PersistentVolume online elastic expansion'
    ],
    recommended_for: 'Baseline reference, backward compatibility testbeds'
  },
  {
    id: 'v1.30.8',
    version: 'v1.30.8',
    major_minor: 'v1.30',
    display_name: 'Kubernetes v1.30 (Legacy Extended Support)',
    display_name_zh: 'Kubernetes v1.30 (存量拓展支持)',
    channel: 'MAINTENANCE',
    release_date: '2024-04-17',
    status: 'Legacy',
    status_zh: '归档维护',
    badge_color: 'zinc',
    talos_linux: 'v1.6.4',
    containerd_version: 'v1.7.14',
    roce_optimized: false,
    dra_version: 'Structured Parameters (Alpha)',
    description_en: 'Legacy Kubernetes version for backward compatibility validation and older hardware firmware support.',
    description_zh: '归档支持版本，用于旧硬件带外固件的向后兼容与迁移验证。',
    features_zh: [
      'DRA 结构化参数初版测试',
      '节点内存 cgroup v2 换页调优'
    ],
    features_en: [
      'Initial structured parameters for DRA',
      'Node memory cgroup v2 swap tuning'
    ],
    recommended_for: 'Legacy systems deprecation, compatibility audits'
  }
];

export interface BareMetalHost {
  name: string;
  rack_location: string;
  bmc_address: string;
  bmc_protocol: 'Redfish' | 'IPMI' | 'iDRAC-Redfish' | 'iLO5-Redfish';
  boot_mac_address: string;
  power_status: PowerStatus;
  provisioning_status: ProvisioningStatus;
  hardware: BareMetalHostHardware;
  assigned_role: 'control-plane' | 'worker-gpu' | 'worker-compute' | 'unassigned';
  target_cluster_id: string | null;
  boot_image: string;
  k8s_version?: string;
  upgrade_status?: 'IDLE' | 'CORDONED' | 'DRAINING' | 'PIVOTING_BINARY' | 'HEALTHY_VERIFIED';
  last_inspection_at: string;
  provisioning_progress_percent: number;
  error_message?: string;
  ip_addresses: BareMetalHostIpAddresses;
  sensors: BareMetalHostSensors;
  serial_console_recent: string[];
}

export interface TargetClusterStage {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  description: string;
}

export interface TargetCluster {
  id: string;
  name: string;
  k8s_version: string;
  version?: string;
  control_plane_nodes?: number;
  worker_nodes?: number;
  cni: 'Multus + Calico + OVS-DPDK + Multi-SR-IOV/DPDK' | 'Multus + Calico + OVS-DPDK' | 'Calico BGP' | string;
  gpu_operator: string;
  scale: {
    control_plane_nodes: number;
    worker_nodes: number;
    gpu_nodes: number;
    total_nodes: number;
  };
  status: TargetClusterStatus;
  progress_percent: number;
  current_stage: string;
  stages: TargetClusterStage[];
  api_endpoint: string;
  created_at: string;
  updated_at: string;
}

export type LogStreamType = 'agent' | 'k8s-install' | 'ironic-redirect';

export interface Metal3LogEvent {
  id: string;
  timestamp: string;
  stream: LogStreamType;
  source:
    | 'eph-agent'
    | 'ironic-conductor'
    | 'ironic-api'
    | 'bmo'
    | 'capi-metal3'
    | 'redfish-bmc'
    | 'k8s-kubeadm'
    | 'calico-multus-cni'
    | 'nvidia-operator'
    | 'sol-console';
  message: string;
  level: 'info' | 'warn' | 'success' | 'error';
  target_host?: string;
  raw_output?: string;
}

export class Metal3Engine {
  public ephNode: EphemeralBootstrapNode;
  public hosts: Map<string, BareMetalHost> = new Map();
  public clusters: Map<string, TargetCluster> = new Map();
  public logs: Metal3LogEvent[] = [];
  public agentTelemetry: EphAgentTelemetry;

  public alerts: Map<string, HostAlert> = new Map();

  constructor() {
    this.ephNode = this.initEphNode();
    this.agentTelemetry = {
      name: 'eph-node-metal3-orchestrator',
      version: 'v2.4.0',
      status: 'ACTIVE_AUTONOMOUS',
      uptime_seconds: 174820,
      last_heartbeat: new Date().toISOString(),
      mtls_state: 'TLS_AES_256_GCM_SHA384_VERIFIED',
      cpu_usage_percent: 14.8,
      memory_used_mb: 6540,
      memory_total_mb: 131072,
      autonomous_decisions_count: 59,
      active_reconciliations: [
        'Watch BareMetalHost CRDs (67 items)',
        'Ironic Conductor Power Watchdog',
        'Calico BGP + Multus + OVS-DPDK + SR-IOV Mesh Verification',
        'NVIDIA FabricManager SXM5 Health Probes',
        'Proactive Fleet Degraded Watchdog Daemon',
      ],
    };
    this.seedHosts();
    this.seedClusters();
    this.seedLogs();
    this.seedAlerts();
  }

  private initEphNode(): EphemeralBootstrapNode {
    return {
      id: 'eph-node-bootstrap-01',
      name: 'eph-node.bootstrap.infra.local',
      role: 'SINGLE_NODE_BOOTSTRAP_K8S',
      k8s_version: 'v1.31.2',
      status: 'ONLINE',
      ip_address: '10.200.0.10',
      host_specs: {
        cpu: '32 Cores (AMD EPYC 7543)',
        memory_gb: 128,
        storage: '2x 1.92TB NVMe PCIe 4.0 (RAID1)',
        os: 'Ubuntu 24.04.1 LTS (Kernel 6.8.0-45-generic)',
      },
      networks: {
        pxe_provisioning_cidr: '172.22.0.0/24 (VLAN 101 - iPXE / TFTP / DHCP)',
        bmc_oob_cidr: '192.168.100.0/24 (VLAN 100 - IPMI / Redfish Out-of-Band)',
        control_plane_uplink: '10.200.0.0/24 (VLAN 200 - AI Studio Control Plane mTLS)',
      },
      components: [
        {
          name: 'metal3-baremetal-operator (BMO)',
          category: 'METAL3_OPERATOR',
          status: 'Running',
          version: 'v0.7.1',
          details: 'Watching BareMetalHost CRDs & driving Ironic node state transitions',
        },
        {
          name: 'cluster-api-provider-metal3 (CAPM3)',
          category: 'METAL3_OPERATOR',
          status: 'Running',
          version: 'v1.8.0',
          details: 'Cluster API Metal3 controller managing Metal3Cluster & Metal3Machine',
        },
        {
          name: 'ironic-api',
          category: 'IRONIC_STACK',
          status: 'Running',
          version: '26.1.0 (2024.2 Dalmation)',
          details: 'Listening on http://172.22.0.10:6385 with Keystone/Standalone auth',
        },
        {
          name: 'ironic-conductor',
          category: 'IRONIC_STACK',
          status: 'Running',
          version: '26.1.0',
          details: 'Managing BMC drivers: redfish-virtualmedia, ipmi, idrac-redfish, ilo5',
        },
        {
          name: 'ironic-inspector',
          category: 'IRONIC_STACK',
          status: 'Running',
          version: '11.8.0',
          details: 'Hardware inspection daemon & LLDP neighbor port switch detection',
        },
        {
          name: 'dnsmasq-tftp-ipxe',
          category: 'IRONIC_STACK',
          status: 'Running',
          version: '2.90',
          details: 'Serving DHCP pool 172.22.0.100-250 and snp.efi / ipxe.efi bootloaders',
        },
        {
          name: 'httpd-image-server',
          category: 'IRONIC_STACK',
          status: 'Running',
          version: 'Apache 2.4.58',
          details: 'Streaming raw/qcow2 OS images and IPA (Ironic Python Agent) initramfs',
        },
        {
          name: 'eph-node-ai-agent-daemon',
          category: 'AI_AGENT_DAEMON',
          status: 'Running',
          version: 'v2.4.0',
          details: 'Autonomous on-node agent executing zero-trust deployment orders from Control Plane',
        },
      ],
      agent_daemon: {
        name: 'eph-node-metal3-orchestrator',
        version: 'v2.4.0',
        status: 'ACTIVE_AUTONOMOUS',
        last_heartbeat: new Date().toISOString(),
        connected_to_control_plane: true,
        active_job_id: 'job_deploy_superpod_01',
        autonomous_capabilities: [
          'Redfish BMC Out-of-Band Power Cycle & UEFI Boot Override',
          'iPXE TFTP/HTTP Chainload Monitoring & Anomaly Auto-Fix',
          'Hardware RAID0/1 NVMe Setup via Ironic Conductor Clean Steps',
          'Autonomous Kubeadm Init & Kubeadm Join Token Distribution',
          'Multus + Calico + OVS-DPDK + Multi-DPDK/SR-IOV & NVIDIA GPU Operator Auto-Injection',
          'Cluster API Metal3 Resource Pivoting to Target Control Plane',
          'InfiniBand / RoCEv2 MTU 9000 & SR-IOV Tuning on Baremetal',
        ],
      },
    };
  }

  private seedHosts() {
    // 3 Control Plane BareMetal Nodes
    for (let i = 1; i <= 3; i++) {
      const name = `bmh-cp-master-0${i}`;
      this.hosts.set(name, {
        name,
        rack_location: `Rack-A01-U${10 + i * 2}`,
        bmc_address: `redfish-virtualmedia+https://192.168.100.${10 + i}/redfish/v1/Systems/System.Embedded.1`,
        bmc_protocol: 'Redfish',
        boot_mac_address: `52:54:00:a1:00:0${i}`,
        power_status: 'ON',
        provisioning_status: 'ActiveInCluster',
        hardware: {
          vendor: 'Dell PowerEdge R760',
          model: 'PowerEdge R760 2U Dual-Socket',
          cpu: '2x Intel Xeon Gold 6448Y (64 Cores)',
          cores: 64,
          ram_gb: 256,
          nvme_tb: 3.84,
          gpus: 'None (High-Reliability Control Plane)',
          nics: '4x 25Gbps Intel E810-XXV (Bond0 LACP)',
        },
        assigned_role: 'control-plane',
        target_cluster_id: 'cluster_ai_superpod_01',
        boot_image: 'ubuntu-24.04-metal3-k8s-v1.31.2.qcow2',
        k8s_version: 'v1.31.2',
        upgrade_status: 'IDLE',
        last_inspection_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        provisioning_progress_percent: 100,
        ip_addresses: {
          bmc_ip: `192.168.100.${10 + i}`,
          provisioning_ip: `172.22.0.${100 + i}`,
          target_ip: `10.200.0.${10 + i}`,
        },
        sensors: {
          cpu_temp_c: 38 + i,
          fan_speed_rpm: 8200 + i * 50,
          power_watts: 480 + i * 15,
          system_health: 'OK',
          dimm_status: 'All 16 DIMMs Nominal (DDR5-4800 ECC)',
          nvme_smart_health: '100% Remaining Spare, 0 Critical Warnings',
        },
        serial_console_recent: [
          `[SOL ttyS0] Dell PowerEdge R760 BIOS 1.9.2 POST Initialized`,
          `[SOL ttyS0] UEFI Network Boot: Intel E810 MAC 52:54:00:a1:00:0${i}`,
          `[SOL ttyS0] iPXE 1.21.1+ (g3c09b) -- fetching http://172.22.0.10:80/images/ubuntu-24.04-metal3.qcow2`,
          `[SOL ttyS0] Linux version 6.8.0-45-generic (buildd@lcy02-amd64-080) #45-Ubuntu SMP`,
          `[SOL ttyS0] systemd[1]: Reached target Multi-User System.`,
          `[SOL ttyS0] kubelet[1420]: Node bmh-cp-master-0${i} status is now: Ready (Master, Control-Plane)`,
        ],
      });
    }

    // 8 GPU Worker Supernodes (NVIDIA H100 SXM5 80GB)
    for (let i = 1; i <= 8; i++) {
      const name = `bmh-gpu-supernode-0${i}`;
      const isProvisioned = i <= 6;
      const isProvisioning = i === 7;
      this.hosts.set(name, {
        name,
        rack_location: `Rack-G0${Math.ceil(i / 2)}-U0${(i % 2) * 16 + 4}`,
        bmc_address: `redfish-virtualmedia+https://192.168.100.${20 + i}/redfish/v1/Systems/1`,
        bmc_protocol: 'iDRAC-Redfish',
        boot_mac_address: `52:54:00:b2:00:0${i}`,
        power_status: isProvisioned ? 'ON' : isProvisioning ? 'ON' : 'OFF',
        provisioning_status: isProvisioned
          ? 'ActiveInCluster'
          : isProvisioning
            ? 'Provisioning'
            : 'Available',
        hardware: {
          vendor: 'Supermicro / Dell XE9680',
          model: 'HGX H100 8-GPU 6U AI Supernode',
          cpu: '2x Intel Xeon Platinum 8480+ (112 Cores)',
          cores: 112,
          ram_gb: 1024,
          nvme_tb: 15.36,
          gpus: '8x NVIDIA H100 SXM5 80GB (NVLink 900GB/s)',
          nics: '8x 400Gbps NVIDIA ConnectX-7 RoCEv2 (OSFP) + 2x 25GbE Mgmt',
        },
        assigned_role: 'worker-gpu',
        target_cluster_id: 'cluster_ai_superpod_01',
        boot_image: 'ubuntu-24.04-metal3-cuda12.4-h100.qcow2',
        k8s_version: isProvisioned ? 'v1.31.2' : undefined,
        upgrade_status: 'IDLE',
        last_inspection_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        provisioning_progress_percent: isProvisioned ? 100 : isProvisioning ? 74 : 0,
        ip_addresses: {
          bmc_ip: `192.168.100.${20 + i}`,
          provisioning_ip: `172.22.0.${120 + i}`,
          target_ip: isProvisioned ? `10.200.0.${20 + i}` : 'Unassigned (Provisioning)',
        },
        sensors: {
          cpu_temp_c: isProvisioned ? 43 + (i % 3) : 28,
          fan_speed_rpm: isProvisioned ? 14200 : 3200,
          power_watts: isProvisioned ? 3850 + i * 40 : 42,
          system_health: 'OK',
          dimm_status: '32x DDR5-5600 32GB Reg ECC Nominal',
          nvme_smart_health: '4x 3.84TB NVMe PCIe 5.0 (RAID0 Stripped, 0 errors)',
        },
        serial_console_recent: [
          `[SOL ttyS0] Supermicro HGX H100 AI Baseboard BMC Firmware 02.14.05`,
          `[SOL ttyS0] PCIe Root Complex: 8x NVIDIA H100 SXM5 GPUs link trained at Gen5 x16 (32 GT/s)`,
          `[SOL ttyS0] NVLink NVSwitch v3: All 18 NVLinks synchronized @ 900 GB/s bi-directional`,
          `[SOL ttyS0] ConnectX-7 NIC 0-7 link state UP: 400Gbps PAM4 optical transceivers active`,
          `[SOL ttyS0] iPXE chainboot -> IPA Ramdisk ironic-python-agent v26.1.0 started`,
          isProvisioning
            ? `[SOL ttyS0] IPA disk-write: Streaming ubuntu-24.04-metal3-cuda12.4.qcow2 (74% 28.4GB/38GB @ 1.8GB/s)`
            : `[SOL ttyS0] nvidia-smi: 8/8 H100 GPUs Ready, Driver 550.90.07, CUDA 12.4, FabricManager OK`,
        ],
      });
    }

    // 4 High-Density General Compute Workers
    for (let i = 1; i <= 4; i++) {
      const name = `bmh-compute-worker-0${i}`;
      this.hosts.set(name, {
        name,
        rack_location: `Rack-C01-U${i * 4}`,
        bmc_address: `redfish-virtualmedia+https://192.168.100.${40 + i}/redfish/v1/Systems/System.Embedded.1`,
        bmc_protocol: 'Redfish',
        boot_mac_address: `52:54:00:c3:00:0${i}`,
        power_status: 'ON',
        provisioning_status: 'ActiveInCluster',
        hardware: {
          vendor: 'HPE ProLiant DL385 Gen11',
          model: 'ProLiant DL385 Dual AMD EPYC',
          cpu: '2x AMD EPYC 9654 (192 Cores)',
          cores: 192,
          ram_gb: 768,
          nvme_tb: 7.68,
          gpus: 'None (Data Preprocessing & Ingestion)',
          nics: '2x 100Gbps Mellanox ConnectX-6 Dx',
        },
        assigned_role: 'worker-compute',
        target_cluster_id: 'cluster_ai_superpod_01',
        boot_image: 'ubuntu-24.04-metal3-k8s-v1.31.2.qcow2',
        k8s_version: 'v1.31.2',
        upgrade_status: 'IDLE',
        last_inspection_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        provisioning_progress_percent: 100,
        ip_addresses: {
          bmc_ip: `192.168.100.${40 + i}`,
          provisioning_ip: `172.22.0.${140 + i}`,
          target_ip: `10.200.0.${40 + i}`,
        },
        sensors: {
          cpu_temp_c: 41 + i,
          fan_speed_rpm: 9600,
          power_watts: 820 + i * 20,
          system_health: 'OK',
          dimm_status: '24x DDR5-4800 Nominal',
          nvme_smart_health: '100% healthy',
        },
        serial_console_recent: [
          `[SOL ttyS0] HPE iLO 6 v1.58 Initialized System`,
          `[SOL ttyS0] AMD EPYC 9654 96-Core Processor x2 (384 Threads)`,
          `[SOL ttyS0] Booting via iPXE HTTP -> Kernel 6.8.0-45-generic loaded`,
          `[SOL ttyS0] Cloud-init v24.2: Finished stage modules-final (0 errors)`,
          `[SOL ttyS0] kubeadm join 10.200.0.100:6443 --token [REDACTED] successfully joined cluster`,
        ],
      });
    }
  }

  private seedClusters() {
    this.clusters.set('cluster_ai_superpod_01', {
      id: 'cluster_ai_superpod_01',
      name: 'ai-superpod-h100-prod',
      k8s_version: 'v1.31.2',
      cni: 'Multus + Calico + OVS-DPDK + Multi-SR-IOV/DPDK',
      gpu_operator: 'NVIDIA GPU Operator v24.6.0 (CUDA 12.4 + FabricManager)',
      scale: {
        control_plane_nodes: 3,
        worker_nodes: 64,
        gpu_nodes: 60,
        total_nodes: 67,
      },
      status: 'CONFIGURING_GPU_ROCE',
      progress_percent: 88,
      current_stage: 'Phase 6/7: Injecting Multus + Calico + OVS-DPDK + Multi-DPDK/SR-IOV & FabricManager',
      stages: [
        {
          id: 'stage_1',
          name: 'BMC Hardware Discovery & RAID0 Clean Steps',
          status: 'COMPLETED',
          description: 'Ironic Inspector verified 67 baremetal servers & configured NVMe storage',
        },
        {
          id: 'stage_2',
          name: 'Ironic HTTP VirtualMedia OS Streaming',
          status: 'COMPLETED',
          description: 'Streamed Ubuntu 24.04 LTS kernel/initramfs immutable images via iPXE',
        },
        {
          id: 'stage_3',
          name: 'Target HA Control Plane Init',
          status: 'COMPLETED',
          description: 'Eph-node agent initialized kubeadm 3-node stacked etcd control plane',
        },
        {
          id: 'stage_4',
          name: 'Massive Worker Join Wave (Batch 1-4)',
          status: 'COMPLETED',
          description: 'Parallel join of 64 high-density baremetal worker nodes into target cluster',
        },
        {
          id: 'stage_5',
          name: 'Multus + Calico + OVS-DPDK + Multi-DPDK/SR-IOV',
          status: 'RUNNING',
          description: 'Deploying Multus NADs delegating Calico eth0, OVS-DPDK net1, vfio-pci DPDK net2, and CX-7 RoCEv2 net3',
        },
        {
          id: 'stage_6',
          name: 'NVIDIA GPU Operator & NVLink FabricManager',
          status: 'RUNNING',
          description: 'Initializing 480x NVIDIA H100 SXM5 accelerators and MPS daemonsets',
        },
        {
          id: 'stage_7',
          name: 'Cluster API Metal3 Pivot to Target K8s',
          status: 'PENDING',
          description: 'Transfer CRD ownership from eph-node bootstrap cluster to target cluster',
        },
      ],
      api_endpoint: 'https://10.200.0.100:6443',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  private seedLogs() {
    const baseTime = Date.now();

    this.logs = [
      // 1. Remote AI Agent Stream (agent)
      {
        id: 'log_ag_01',
        timestamp: new Date(baseTime - 3600000).toISOString(),
        stream: 'agent',
        source: 'eph-agent',
        message: 'Eph-Node AI Agent daemon v2.4.0 started inside bootstrap single-node K8s. mTLS established with Control Plane.',
        level: 'info',
        raw_output: '[eph-agent:daemon] INFO: Verified bootstrap node identity eph-node.bootstrap.infra.local; mTLS cipher: TLS_AES_256_GCM_SHA384',
      },
      {
        id: 'log_ag_02',
        timestamp: new Date(baseTime - 3300000).toISOString(),
        stream: 'agent',
        source: 'eph-agent',
        message: 'Autonomous Hardware Discovery Loop: scanned 67 BareMetalHost definitions. Validated BMC credentials & Redfish endpoints.',
        level: 'info',
        raw_output: '[eph-agent:hardware-scanner] OK: 67/67 Redfish chassis reachable via OOB VLAN 100 (192.168.100.0/24)',
      },
      {
        id: 'log_ag_03',
        timestamp: new Date(baseTime - 2800000).toISOString(),
        stream: 'agent',
        source: 'eph-agent',
        message: 'Autonomous Policy Evaluation: generated kubeadm init config with stacked etcd and VIP 10.200.0.100.',
        level: 'success',
        raw_output: '[eph-agent:kubeadm-generator] Generated ClusterConfiguration v1beta3: controlPlaneEndpoint="10.200.0.100:6443"',
      },
      {
        id: 'log_ag_04',
        timestamp: new Date(baseTime - 1800000).toISOString(),
        stream: 'agent',
        source: 'eph-agent',
        message: 'Self-Healing Event: bmh-gpu-supernode-07 iPXE DHCP lease timed out; Agent triggered automated warm BMC power cycle.',
        level: 'warn',
        target_host: 'bmh-gpu-supernode-07',
        raw_output: '[eph-agent:remediation] WARN: DHCPDISCOVER timeout on bmh-gpu-supernode-07; dispatched Redfish ForceRestart -> recovered in 4.2s',
      },
      {
        id: 'log_ag_05',
        timestamp: new Date(baseTime - 700000).toISOString(),
        stream: 'agent',
        source: 'eph-agent',
        message: 'Autonomous Network Orchestrator: Verified RoCEv2 PFC CoS 3 and Jumbo Frames 9000 across 8x ConnectX-7 NICs per supernode.',
        level: 'success',
        raw_output: '[eph-agent:net-orchestrator] SUCCESS: 8x 400G ConnectX-7 link carrier 100% signal quality, PFC enabled on CoS 3',
      },
      {
        id: 'log_ag_06',
        timestamp: new Date(baseTime - 120000).toISOString(),
        stream: 'agent',
        source: 'eph-agent',
        message: 'Agent Autonomous Decision: Target cluster control plane stable (3/3 masters Ready); proceeding with GPU Operator daemonset rollout.',
        level: 'info',
        raw_output: '[eph-agent:reconciler] INFO: Master quorum healthy; dispatched helm upgrade --install gpu-operator nvidia/gpu-operator v24.6.0',
      },

      // 2. K8S Installation Stream (k8s-install)
      {
        id: 'log_k8s_01',
        timestamp: new Date(baseTime - 3000000).toISOString(),
        stream: 'k8s-install',
        source: 'k8s-kubeadm',
        message: 'kubeadm init: [init] Using Kubernetes version: v1.31.2, pulling images and generating PKI certificates.',
        level: 'info',
        raw_output: '[kubeadm:certs] Generated ca, apiserver, front-proxy-ca, etcd-ca and service account key pair in /etc/kubernetes/pki',
      },
      {
        id: 'log_k8s_02',
        timestamp: new Date(baseTime - 2700000).toISOString(),
        stream: 'k8s-install',
        source: 'k8s-kubeadm',
        message: 'kubeadm init: [etcd] Creating static Pod manifest for local etcd instance on bmh-cp-master-01.',
        level: 'info',
        target_host: 'bmh-cp-master-01',
        raw_output: '[kubeadm:etcd] Stacked etcd member bmh-cp-master-01 initialized listening on 10.200.0.11:2379',
      },
      {
        id: 'log_k8s_03',
        timestamp: new Date(baseTime - 2400000).toISOString(),
        stream: 'k8s-install',
        source: 'k8s-kubeadm',
        message: 'kubeadm join: bmh-cp-master-02 and bmh-cp-master-03 joined control plane; 3-node HA quorum achieved.',
        level: 'success',
        raw_output: '[kubeadm:control-plane] Multi-master stacked etcd quorum 3/3 active. VIP 10.200.0.100 elected via Keepalived VRRP',
      },
      {
        id: 'log_k8s_04',
        timestamp: new Date(baseTime - 1500000).toISOString(),
        stream: 'k8s-install',
        source: 'k8s-kubeadm',
        message: 'Massive Worker Join: 60/64 GPU supernodes successfully executed kubeadm join and registered with API server.',
        level: 'success',
        raw_output: '[kubeadm:join] Tokens distributed; 60 nodes transition to Ready; TLS bootstrap client certificates signed by Kubelet CA',
      },
      {
        id: 'log_k8s_05',
        timestamp: new Date(baseTime - 900000).toISOString(),
        stream: 'k8s-install',
        source: 'calico-multus-cni',
        message: 'Multus + Calico + OVS-DPDK + Multi-DPDK/SR-IOV installed: eth0 Calico BGP, net1 OVS-DPDK br-data, net2 vfio-pci PMD, net3 CX-7 RoCEv2.',
        level: 'info',
        raw_output: '[multus-calico-ovs:daemon] Calico 3.28 BGP + OVS-DPDK 2.17 + DPDK 24.11 vfio-pci & mlx5_core initialized across 63 nodes MTU 9000',
      },
      {
        id: 'log_k8s_06',
        timestamp: new Date(baseTime - 300000).toISOString(),
        stream: 'k8s-install',
        source: 'nvidia-operator',
        message: 'NVIDIA GPU Operator v24.6.0: Initialized NVIDIA Driver 550.90.07, CUDA 12.4 and FabricManager across 480x H100 GPUs.',
        level: 'success',
        raw_output: '[nvidia-operator:fabricmanager] All 60 GPU supernodes reported FabricManager NVLink full-mesh topology HEALTHY',
      },

      // 3. Ironic Redirected & SOL Serial Console Stream (ironic-redirect)
      {
        id: 'log_iro_01',
        timestamp: new Date(baseTime - 3500000).toISOString(),
        stream: 'ironic-redirect',
        source: 'ironic-conductor',
        message: 'Ironic Conductor [worker 0] initialized Redfish VirtualMedia driver and IPMI hardware manager.',
        level: 'info',
        raw_output: '[ironic-conductor:redfish] Registered 67 target nodes; Redfish session token cached; OOB network ready',
      },
      {
        id: 'log_iro_02',
        timestamp: new Date(baseTime - 3200000).toISOString(),
        stream: 'ironic-redirect',
        source: 'ironic-api',
        message: 'Ironic Inspector D-Bus: Hardware LLDP and PCIe introspection received from bmh-gpu-supernode-01..08.',
        level: 'info',
        raw_output: '[ironic-inspector:lldp] Node bmh-gpu-supernode-01 connected to TOR-Switch-A01 Port Eth1/1-8 (Speed 400G)',
      },
      {
        id: 'log_iro_03',
        timestamp: new Date(baseTime - 2600000).toISOString(),
        stream: 'ironic-redirect',
        source: 'sol-console',
        message: '[SOL ttyS0 Redirection] Supermicro HGX H100 UEFI BIOS POST completed; PXE bootloader chain started.',
        level: 'info',
        target_host: 'bmh-gpu-supernode-01',
        raw_output: '[SOL ttyS0] UEFI POST Stage 4: PCIe device enumeration finished: 8x NVLink HGX SXM5 80GB devices Ready',
      },
      {
        id: 'log_iro_04',
        timestamp: new Date(baseTime - 2100000).toISOString(),
        stream: 'ironic-redirect',
        source: 'sol-console',
        message: '[SOL ttyS0 Redirection] iPXE snp.efi downloaded http://172.22.0.10/images/ubuntu-24.04-metal3.qcow2; streaming disk.',
        level: 'info',
        target_host: 'bmh-gpu-supernode-01',
        raw_output: '[SOL ttyS0] iPXE 1.21.1+ HTTP GET /images/ubuntu-24.04-metal3.qcow2 -> 100% [38.2GB streamed at 2.4GB/s]',
      },
      {
        id: 'log_iro_05',
        timestamp: new Date(baseTime - 1100000).toISOString(),
        stream: 'ironic-redirect',
        source: 'sol-console',
        message: '[SOL ttyS0 Redirection] Linux Kernel 6.8.0 booted on baremetal; Ironic Python Agent (IPA) executed clean-steps.',
        level: 'success',
        target_host: 'bmh-gpu-supernode-01',
        raw_output: '[SOL ttyS0] kernel: [ 4.218091] nvme nvme0: 4/0/0 default/read/poll queues; NVMe hardware RAID0 striping applied',
      },
      {
        id: 'log_iro_06',
        timestamp: new Date(baseTime - 50000).toISOString(),
        stream: 'ironic-redirect',
        source: 'ironic-conductor',
        message: 'Ironic node-power state: 63/67 nodes powered ON and locked in provisioned state.',
        level: 'info',
        raw_output: '[ironic-conductor:power_sync] Periodic power task: 63 ON, 4 OFF, 0 in ERROR state',
      },
    ];
  }

  // --- ACTIONS ---

  public getLogs(stream?: LogStreamType | 'all'): Metal3LogEvent[] {
    if (!stream || stream === 'all') {
      return this.logs;
    }
    return this.logs.filter(l => l.stream === stream);
  }

  public addLog(
    stream: LogStreamType,
    source: Metal3LogEvent['source'],
    message: string,
    level: Metal3LogEvent['level'] = 'info',
    raw_output?: string,
    target_host?: string
  ): Metal3LogEvent {
    const entry: Metal3LogEvent = {
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      stream,
      source,
      message,
      level,
      target_host,
      raw_output: raw_output || `[${stream.toUpperCase()}:${source}] ${message}`,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 500) {
      this.logs.pop();
    }
    return entry;
  }

  public setHostPower(hostName: string, action: 'on' | 'off' | 'reboot' | 'pxe-boot'): BareMetalHost {
    const host = this.hosts.get(hostName);
    if (!host) {
      throw new Error(`BareMetalHost '${hostName}' not found`);
    }

    switch (action) {
      case 'on':
        host.power_status = 'ON';
        host.sensors.power_watts = host.assigned_role === 'worker-gpu' ? 3850 : 480;
        break;
      case 'off':
        host.power_status = 'OFF';
        host.sensors.power_watts = 42;
        break;
      case 'reboot':
        host.power_status = 'REBOOTING';
        host.serial_console_recent.unshift(
          `[SOL ttyS0] Soft reboot signal issued via BMC Redfish PowerAction: ForceRestart`
        );
        setTimeout(() => {
          if (this.hosts.has(hostName)) {
            const h = this.hosts.get(hostName)!;
            h.power_status = 'ON';
            h.serial_console_recent.unshift(
              `[SOL ttyS0] System rebooted successfully. OS kernel 6.8.0 online.`
            );
          }
        }, 3000);
        break;
      case 'pxe-boot':
        host.power_status = 'PXE_BOOTING';
        host.provisioning_status = 'Preparing';
        host.serial_console_recent.unshift(
          `[SOL ttyS0] One-time boot override to UEFI Network / PXE received via Redfish`
        );
        setTimeout(() => {
          if (this.hosts.has(hostName)) {
            const h = this.hosts.get(hostName)!;
            h.power_status = 'ON';
            h.provisioning_status = 'Provisioning';
            h.provisioning_progress_percent = 25;
            h.serial_console_recent.unshift(
              `[SOL ttyS0] iPXE chainboot -> loading image ${h.boot_image}`
            );
          }
        }, 3000);
        break;
    }

    this.addLog(
      'ironic-redirect',
      'redfish-bmc',
      `BMC Redfish Power Action [${action.toUpperCase()}] executed on ${hostName} (${host.bmc_address})`,
      'info',
      `[redfish-bmc:action] POST /redfish/v1/Systems/1/Actions/ComputerSystem.Reset -> ResetType: ${action}`,
      hostName
    );

    this.agentTelemetry.autonomous_decisions_count += 1;
    return host;
  }

  public triggerInspect(hostName: string): BareMetalHost {
    const host = this.hosts.get(hostName);
    if (!host) {
      throw new Error(`BareMetalHost '${hostName}' not found`);
    }

    host.provisioning_status = 'Inspecting';
    host.last_inspection_at = new Date().toISOString();

    this.addLog(
      'ironic-redirect',
      'ironic-conductor',
      `Ironic Inspector started out-of-band Redfish inventory scan on ${hostName}`,
      'info',
      `[ironic-inspector:scan] Triggered LLDP switch port & PCIe probe on ${hostName}`,
      hostName
    );

    setTimeout(() => {
      if (this.hosts.has(hostName)) {
        const h = this.hosts.get(hostName)!;
        h.provisioning_status = 'Available';
        this.addLog(
          'ironic-redirect',
          'ironic-conductor',
          `Hardware inspection completed for ${hostName}: Verified ${h.hardware.cores} Cores, ${h.hardware.ram_gb}GB RAM, ${h.hardware.gpus}`,
          'success',
          `[ironic-inspector:done] ${hostName} passes all validation gates`,
          hostName
        );
      }
    }, 2500);

    return host;
  }

  public createTargetCluster(params: {
    name: string;
    k8s_version: string;
    cni: string;
    gpu_operator: string;
    scale: {
      control_plane_nodes: number;
      worker_nodes: number;
      gpu_nodes: number;
    };
  }): TargetCluster {
    const id = `cluster_${params.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
    const total_nodes = params.scale.control_plane_nodes + params.scale.worker_nodes;

    const newCluster: TargetCluster = {
      id,
      name: params.name,
      k8s_version: params.k8s_version || 'v1.31.2',
      cni: params.cni || 'Multus + Calico + OVS-DPDK + Multi-SR-IOV/DPDK',
      gpu_operator: params.gpu_operator || 'NVIDIA GPU Operator v24.6.0',
      scale: {
        ...params.scale,
        total_nodes,
      },
      status: 'DISCOVERING_HARDWARE',
      progress_percent: 15,
      current_stage: 'Phase 1/7: BMC Hardware Discovery & RAID0 Clean Steps',
      stages: [
        {
          id: 'stage_1',
          name: 'BMC Hardware Discovery & RAID0 Clean Steps',
          status: 'RUNNING',
          description: `Ironic inspecting ${total_nodes} baremetal hosts and applying BIOS profile`,
        },
        {
          id: 'stage_2',
          name: 'Ironic HTTP VirtualMedia OS Streaming',
          status: 'PENDING',
          description: 'Streaming immutable OS image with kernel 6.8 & RoCEv2 drivers',
        },
        {
          id: 'stage_3',
          name: 'Target HA Control Plane Init',
          status: 'PENDING',
          description: `Kubeadm initializing stacked etcd on ${params.scale.control_plane_nodes} masters`,
        },
        {
          id: 'stage_4',
          name: 'Massive Worker Join Wave',
          status: 'PENDING',
          description: `Parallel token distribution to ${params.scale.worker_nodes} baremetal nodes`,
        },
        {
          id: 'stage_5',
          name: 'Multus + Calico + OVS-DPDK + Multi-DPDK/SR-IOV',
          status: 'PENDING',
          description: 'Configuring Multus NADs, Calico BGP, OVS-DPDK netdev bridge, and multiple DPDK/SR-IOV VF planes',
        },
        {
          id: 'stage_6',
          name: 'NVIDIA GPU Operator & NVLink FabricManager',
          status: 'PENDING',
          description: `Provisioning ${params.scale.gpu_nodes * 8} NVIDIA H100 GPUs`,
        },
        {
          id: 'stage_7',
          name: 'Cluster API Metal3 Pivot to Target K8s',
          status: 'PENDING',
          description: 'Pivot CAPI controllers and BareMetalHost CRDs to target cluster',
        },
      ],
      api_endpoint: `https://10.200.0.${Math.floor(Math.random() * 50) + 100}:6443`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.clusters.set(id, newCluster);

    this.addLog(
      'agent',
      'eph-agent',
      `Control Plane instructed Eph-Node AI Agent to deploy target cluster '${params.name}' with ${total_nodes} baremetal nodes`,
      'info',
      `[eph-agent:cluster-deploy] Started orchestration of ${total_nodes} nodes for ${params.name}`
    );

    this.addLog(
      'k8s-install',
      'k8s-kubeadm',
      `Cluster deployment pipeline '${params.name}' dispatched by autonomous agent`,
      'info',
      `[k8s-install:pipeline] Target Kubernetes version: ${newCluster.k8s_version}, CNI: ${newCluster.cni}`
    );

    return newCluster;
  }

  public triggerPivot(clusterId: string): { success: boolean; message: string } {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      throw new Error(`Target Cluster '${clusterId}' not found`);
    }

    cluster.status = 'PIVOTING';
    cluster.current_stage = 'Phase 7/7: Transferring Cluster API & Metal3 CRDs to Target K8s Control Plane';
    cluster.progress_percent = 95;

    this.ephNode.status = 'PIVOTING';

    this.addLog(
      'agent',
      'capi-metal3',
      `Initiating CAPI Pivot from Eph-Node bootstrap cluster to target cluster ${cluster.name} (${cluster.api_endpoint})`,
      'info',
      `[capi-metal3:pivot] clusterctl move --to-kubeconfig target-cluster.kubeconfig`
    );

    setTimeout(() => {
      cluster.status = 'HEALTHY_OPERATIONAL';
      cluster.progress_percent = 100;
      cluster.current_stage = 'Target Baremetal Kubernetes Cluster Fully Operational & Self-Hosting';
      cluster.stages.forEach(s => (s.status = 'COMPLETED'));

      this.ephNode.status = 'STANDBY_POST_PIVOT';

      this.addLog(
        'agent',
        'eph-agent',
        `CAPI Pivot SUCCEEDED! BareMetalHost CRD ownership migrated to target cluster. Eph-Node placed in STANDBY.`,
        'success',
        `[eph-agent:pivot] Target cluster is now self-hosting all Metal3 & CAPM3 CRD operators`
      );
    }, 3000);

    return {
      success: true,
      message: `CAPI Pivot initiated by Eph-Node AI Agent to target cluster '${cluster.name}'. Resources transferring.`,
    };
  }

  public executeAgentCommand(command: string): {
    command: string;
    decision: string;
    actions_taken: string[];
    log_event: Metal3LogEvent;
  } {
    const ts = new Date().toISOString();
    let decision = '';
    const actionsTaken: string[] = [];
    let streamType: LogStreamType = 'agent';

    const lower = command.toLowerCase();

    if (lower.includes('inspect') || lower.includes('discover') || lower.includes('check')) {
      decision = 'Eph-Node AI Agent dispatched out-of-band Redfish chassis discovery across BMC VLAN 100.';
      actionsTaken.push('Probed Redfish endpoints at 192.168.100.1-100');
      actionsTaken.push('Queried Dell iDRAC / Supermicro BMC PCIe inventory: 480x NVIDIA H100 SXM5 detected');
      actionsTaken.push('Verified dual-port 400Gbps ConnectX-7 link carrier: 100% Signal Quality');
      streamType = 'ironic-redirect';
    } else if (lower.includes('pxe') || lower.includes('tftp') || lower.includes('boot') || lower.includes('dhcp')) {
      decision = 'Eph-Node AI Agent tuned dnsmasq TFTP block size and validated iPXE bootloader chain.';
      actionsTaken.push('Adjusted TFTP blksize to 1468 bytes for fast kernel streaming');
      actionsTaken.push('Verified DHCP lease reservation for target baremetal MAC table');
      actionsTaken.push('Validated HTTP Apache image server md5 checksums for ubuntu-24.04-metal3.qcow2');
      streamType = 'ironic-redirect';
    } else if (lower.includes('kubeadm') || lower.includes('k8s') || lower.includes('join') || lower.includes('install')) {
      decision = 'Eph-Node AI Agent orchestrated Kubernetes bootstrap and token distribution.';
      actionsTaken.push('Generated kubeadm join token with 2h expiration');
      actionsTaken.push('Pushed join command to worker node inventory via SSH/cloud-init channel');
      actionsTaken.push('Verified stacked etcd cluster health across 3 control plane nodes');
      streamType = 'k8s-install';
    } else if (lower.includes('roce') || lower.includes('infiniband') || lower.includes('mtu') || lower.includes('calico') || lower.includes('ovs') || lower.includes('dpdk') || lower.includes('multus')) {
      decision = 'Eph-Node AI Agent orchestrated baremetal Multi-CNI (Multus + Calico + OVS-DPDK + Multi-DPDK/SR-IOV) validation.';
      actionsTaken.push('Enforced MTU 9000 (Jumbo Frames) across all ConnectX-7 & DPDK physical interfaces');
      actionsTaken.push('Configured RoCEv2 PFC (Priority Flow Control) on CoS 3 + 1Gi HugePages for vfio-pci');
      actionsTaken.push('Verified Calico BGP peering, OVS-DPDK br-data netdev bridge, and Multus 4-NIC injection');
      streamType = 'k8s-install';
    } else {
      decision = `Eph-Node AI Agent synthesized command: "${command}" and mapped to Metal3/Ironic workflow.`;
      actionsTaken.push('Validated security clearance and agent-to-control-plane mTLS identity');
      actionsTaken.push('Reconciled BareMetalHost CRDs and synchronized Ironic conductor state machine');
      actionsTaken.push('Logged action to audit trail with cryptographic trace hash');
      streamType = 'agent';
    }

    const logEvent = this.addLog(
      streamType,
      'eph-agent',
      `[Control Plane Command] "${command}" -> ${decision}`,
      'success',
      `[eph-agent:exec] command="${command}" decision="${decision}" actions=${actionsTaken.length}`
    );

    this.agentTelemetry.autonomous_decisions_count += 1;
    this.agentTelemetry.last_heartbeat = ts;

    return {
      command,
      decision,
      actions_taken: actionsTaken,
      log_event: logEvent,
    };
  }

  public scaleCluster(clusterId: string, targetScale: { worker_nodes: number; gpu_nodes: number }): TargetCluster {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      throw new Error(`Target Cluster '${clusterId}' not found`);
    }

    const prevWorkers = cluster.scale.worker_nodes;
    const prevGpu = cluster.scale.gpu_nodes;
    const isScaleUp = targetScale.worker_nodes >= prevWorkers;

    if (isScaleUp) {
      cluster.status = 'SCALING_UP';
      cluster.current_stage = `AI Agent Elastic Scale-Up: Provisioning +${targetScale.worker_nodes - prevWorkers} nodes into cluster pool`;

      // Find available or unassigned nodes to join cluster
      for (const host of this.hosts.values()) {
        if (host.provisioning_status === 'Available' || host.provisioning_status === 'Preparing') {
          host.power_status = 'ON';
          host.provisioning_status = 'ActiveInCluster';
          host.target_cluster_id = clusterId;
          host.provisioning_progress_percent = 100;
          if (host.assigned_role === 'worker-gpu') {
            host.ip_addresses.target_ip = `10.200.0.${20 + parseInt(host.name.replace(/\D/g, '') || '8')}`;
          }
        }
      }

      this.addLog(
        'agent',
        'eph-agent',
        `Autonomous AI Agent accepted Scale-Up request: Expanding workers from ${prevWorkers} to ${targetScale.worker_nodes} (GPU nodes: ${targetScale.gpu_nodes})`,
        'success',
        `[eph-agent:scale-up] Target cluster=${cluster.name} delta=+${targetScale.worker_nodes - prevWorkers} nodes`
      );

      this.addLog(
        'k8s-install',
        'k8s-kubeadm',
        `Generated ephemeral TLS bootstrap join tokens; distributing cloud-init join payloads to new baremetal nodes`,
        'info',
        `[k8s-kubeadm:join] kubeadm join 10.200.0.100:6443 --token [AUTO_EXPIRING_TOKEN] --discovery-token-ca-cert-hash sha256:...`
      );

      this.addLog(
        'k8s-install',
        'calico-multus-cni',
        `Multus + Calico BGP + OVS-DPDK + Multi-DPDK/SR-IOV attached to new worker nodes (MTU 9000)`,
        'success',
        `[multus-calico-ovs:routing] New node endpoints attached to Calico BGP, OVS-DPDK & SR-IOV datapaths`
      );
    } else {
      cluster.status = 'SCALING_DOWN';
      cluster.current_stage = `AI Agent Graceful Scale-Down: Cordoning & draining -${prevWorkers - targetScale.worker_nodes} nodes`;

      this.addLog(
        'agent',
        'eph-agent',
        `Autonomous AI Agent accepted Scale-Down request: Draining and decommissioning ${prevWorkers - targetScale.worker_nodes} nodes`,
        'warn',
        `[eph-agent:scale-down] Target cluster=${cluster.name} target_workers=${targetScale.worker_nodes}`
      );

      this.addLog(
        'k8s-install',
        'k8s-kubeadm',
        `Executed kubectl cordon & drain across decommission targets; evicted pods rescheduled to healthy nodes`,
        'info',
        `[k8s-kubeadm:drain] Pod eviction completed; nodes cleanly deregistered from control plane`
      );
    }

    cluster.scale.worker_nodes = targetScale.worker_nodes;
    cluster.scale.gpu_nodes = targetScale.gpu_nodes;
    cluster.scale.total_nodes = cluster.scale.control_plane_nodes + targetScale.worker_nodes;
    cluster.updated_at = new Date().toISOString();

    setTimeout(() => {
      cluster.status = 'HEALTHY_OPERATIONAL';
      cluster.current_stage = `Cluster Healthy & Operational at ${cluster.scale.total_nodes} nodes (${cluster.scale.gpu_nodes * 8}x H100 GPUs)`;
    }, 2500);

    this.agentTelemetry.autonomous_decisions_count += 1;
    return cluster;
  }

  public scaleDownSingleNode(clusterId: string, hostName: string): { host: BareMetalHost; cluster: TargetCluster } {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      throw new Error(`Target Cluster '${clusterId}' not found`);
    }

    const host = this.hosts.get(hostName);
    if (!host) {
      throw new Error(`BareMetalHost '${hostName}' not found`);
    }

    this.addLog(
      'agent',
      'eph-agent',
      `Autonomous AI Agent initiating safe cordon & drain on node ${hostName} (${host.rack_location})`,
      'warn',
      `[eph-agent:node-drain] kubectl cordon ${hostName} && kubectl drain ${hostName} --delete-emptydir-data --ignore-daemonsets`,
      hostName
    );

    this.addLog(
      'k8s-install',
      'k8s-kubeadm',
      `Node ${hostName} cordoned and drained. 12 pods evacuated. Node object removed from etcd registry.`,
      'info',
      `[k8s-core:delete] kubectl delete node ${hostName} -> status 200 OK`,
      hostName
    );

    this.addLog(
      'ironic-redirect',
      'ironic-conductor',
      `Ironic executing clean-steps on ${hostName}: NVMe crypto erase, IPMI soft power-off`,
      'info',
      `[ironic-conductor:clean] Clean step wipe_device completed; node returned to available inventory`,
      hostName
    );

    host.power_status = 'OFF';
    host.provisioning_status = 'Available';
    host.target_cluster_id = null;
    host.provisioning_progress_percent = 0;
    host.ip_addresses.target_ip = 'Unassigned (Pool Available)';
    if (host.sensors) {
      host.sensors.power_watts = 42;
    }
    host.serial_console_recent.unshift(
      `[SOL ttyS0] Node safely drained from cluster. System powered down via Redfish.`
    );

    if (host.assigned_role === 'worker-gpu') {
      cluster.scale.gpu_nodes = Math.max(0, cluster.scale.gpu_nodes - 1);
    }
    cluster.scale.worker_nodes = Math.max(0, cluster.scale.worker_nodes - 1);
    cluster.scale.total_nodes = cluster.scale.control_plane_nodes + cluster.scale.worker_nodes;
    cluster.updated_at = new Date().toISOString();

    this.agentTelemetry.autonomous_decisions_count += 1;
    return { host, cluster };
  }

  public getSupportedK8sVersions(): SupportedK8sVersion[] {
    return SUPPORTED_K8S_VERSIONS;
  }

  public upgradeClusterVersion(
    clusterId: string,
    targetVersion: string,
    options?: {
      policy?: 'rolling' | 'canary' | 'batch';
      target_nodes?: string[];
      drain_timeout?: number;
    }
  ): TargetCluster {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      throw new Error(`Target Cluster '${clusterId}' not found`);
    }

    const policy = options?.policy || 'rolling';
    const previousVersion = cluster.k8s_version;
    cluster.status = 'UPGRADING_VERSION';
    cluster.current_stage = `AI Agent Rolling Upgrade (${policy}): In-place migration from ${previousVersion} to ${targetVersion}`;

    // Update target nodes
    const targetNodeNames = options?.target_nodes && options.target_nodes.length > 0
      ? options.target_nodes
      : Array.from(this.hosts.keys());

    targetNodeNames.forEach(nodeName => {
      const host = this.hosts.get(nodeName);
      if (host) {
        host.k8s_version = targetVersion;
        host.boot_image = `talos-${targetVersion}-metal3.iso`;
        host.upgrade_status = 'HEALTHY_VERIFIED';
        host.serial_console_recent.unshift(
          `[SOL ttyS0] CAPI MachineController: In-place rolling upgrade applied. Kubelet ${targetVersion} synchronized.`,
          `[SOL ttyS0] RoCEv2 Mellanox CX-7 link intact (200Gbps line rate verified). Node Ready at ${targetVersion}.`
        );
      }
    });

    this.addLog(
      'agent',
      'eph-agent',
      `Autonomous AI Agent launched Rolling Version Upgrade (${policy}): ${previousVersion} -> ${targetVersion} across ${targetNodeNames.length} nodes`,
      'info',
      `[eph-agent:upgrade] Pre-flight inspection: etcd quorum healthy, Multus+Calico+OVS-DPDK+SR-IOV compatible, NVIDIA FabricManager ready`
    );

    this.addLog(
      'k8s-install',
      'k8s-kubeadm',
      `Step 1/3: Master CP upgrade: kubeadm upgrade apply ${targetVersion} on bmh-cp-master-01`,
      'info',
      `[kubeadm:upgrade] Control-plane static pods (apiserver, etcd, controller-manager) upgraded to ${targetVersion}`
    );

    this.addLog(
      'k8s-install',
      'k8s-kubeadm',
      `Step 2/3: Master CP upgrade: bmh-cp-master-02 and bmh-cp-master-03 upgraded; stacked etcd raft maintained`,
      'success',
      `[kubeadm:upgrade] HA Control Plane quorum 3/3 online at ${targetVersion}`
    );

    this.addLog(
      'k8s-install',
      'k8s-kubeadm',
      `Step 3/3: Rolling worker upgrade: drain -> upgrade kubelet to ${targetVersion} -> uncordon across ${cluster.scale.worker_nodes} workers`,
      'success',
      `[kubeadm:worker-upgrade] All baremetal workers successfully upgraded to ${targetVersion}`
    );

    this.addLog(
      'k8s-install',
      'nvidia-operator',
      `NVIDIA GPU Operator & FabricManager re-verified on Kubernetes ${targetVersion}; CUDA 12.4 healthy`,
      'success',
      `[nvidia-operator:ready] 480x H100 SXM5 GPUs operational`
    );

    cluster.k8s_version = targetVersion;
    cluster.version = targetVersion;
    cluster.updated_at = new Date().toISOString();

    setTimeout(() => {
      cluster.status = 'HEALTHY_OPERATIONAL';
      cluster.current_stage = `Target Cluster Successfully Upgraded to Kubernetes ${targetVersion} (Self-Hosting & Ready)`;
    }, 2500);

    this.agentTelemetry.autonomous_decisions_count += 1;
    return cluster;
  }

  public applyVersionToNodes(
    nodeNames: string[],
    targetVersion: string
  ): { upgraded_nodes: string[]; target_version: string } {
    const upgraded: string[] = [];

    nodeNames.forEach(name => {
      const host = this.hosts.get(name);
      if (host) {
        host.k8s_version = targetVersion;
        host.boot_image = `talos-${targetVersion}-metal3.iso`;
        host.upgrade_status = 'HEALTHY_VERIFIED';
        host.serial_console_recent.unshift(
          `[SOL ttyS0] CAPI Targeted Node Pivot: Successfully upgraded to ${targetVersion}.`,
          `[SOL ttyS0] kubelet[${Date.now().toString().slice(-4)}]: Node ${host.name} Ready on K8s ${targetVersion}`
        );
        upgraded.push(name);
      }
    });

    this.addLog(
      'k8s-install',
      'capi-metal3',
      `Targeted Node Version Apply: ${upgraded.join(', ')} upgraded to Kubernetes ${targetVersion}`,
      'success',
      `[capi:node-upgrade] ${upgraded.length} nodes successfully transitioned to ${targetVersion}`
    );

    this.agentTelemetry.autonomous_decisions_count += 1;
    return { upgraded_nodes: upgraded, target_version: targetVersion };
  }

  public seedAlerts() {
    // Seed 1 initial proactive alert for demonstration: bmh-worker-gpu-08 in Provisioning Failed state
    const failedHost = this.hosts.get('bmh-worker-gpu-08');
    if (failedHost) {
      failedHost.provisioning_status = 'Provisioning Failed';
      failedHost.error_message = 'iPXE UEFI TFTP Timeout: Error PXE-E32 while fetching vmlinuz kernel artifact from eph-node:69';
      failedHost.sensors.system_health = 'WARNING';
    }

    const alert: HostAlert = {
      id: 'alt_bmh_failed_08',
      host_name: 'bmh-worker-gpu-08',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      rule: 'PROVISIONING_FAILED',
      title: '裸机节点装机中断: UEFI iPXE TFTP 传输超时',
      title_en: 'BareMetal Provisioning Failed: UEFI iPXE TFTP Stream Timeout',
      message: '节点 bmh-worker-gpu-08 在 Ironic OS 镜像流下发阶段超时 (PXE-E32)。网卡未能自 TFTP 服务拉取 vmlinuz 内核。',
      message_en: 'Host bmh-worker-gpu-08 timed out during Ironic OS stream (PXE-E32). Boot NIC failed to load vmlinuz artifact.',
      error_code: 'E_IRONIC_IPXE_TIMEOUT',
      diagnostics: {
        phase: 'Provisioning Failed (Ironic Conductor Step 4)',
        bmc_ip: '192.168.100.28',
        temperature_c: 44,
        error_detail: 'iPXE dhcp negotiation succeeded on VLAN 101, but TFTP read ack packet lost after 30000ms.',
        suggested_remediation: 'Power cycle via Redfish, reset boot device order to UEFI PXE, and force-retry Ironic inspection.',
      },
      detected_at: new Date(Date.now() - 360000).toISOString(),
      dispatched_channels: [],
    };

    this.alerts.set(alert.id, alert);
  }

  public getAlerts(): HostAlert[] {
    return Array.from(this.alerts.values()).sort(
      (a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    );
  }

  public simulateAlert(hostName?: string, rule?: 'PROVISIONING_FAILED' | 'NODE_DEGRADED'): HostAlert {
    let target = hostName ? this.hosts.get(hostName) : undefined;
    if (!target) {
      const candidates = Array.from(this.hosts.values()).filter(h => h.assigned_role !== 'control-plane');
      target = candidates[Math.floor(Math.random() * candidates.length)] || candidates[0];
    }

    const isDegraded = rule === 'NODE_DEGRADED' || Math.random() > 0.5;
    const alertId = `alt_${target.name}_${Date.now().toString(36)}`;

    if (isDegraded) {
      target.provisioning_status = 'Degraded';
      target.error_message = 'Hardware health degraded: NVMe wear-out endurance reached 91% and thermal throttling active.';
      target.sensors.system_health = 'CRITICAL';
      target.sensors.cpu_temp_c = 86;
    } else {
      target.provisioning_status = 'Provisioning Failed';
      target.error_message = 'Ironic clean-steps failed: crypto disk erase command timed out on /dev/nvme0n1.';
      target.sensors.system_health = 'WARNING';
    }

    const alert: HostAlert = {
      id: alertId,
      host_name: target.name,
      severity: isDegraded ? 'CRITICAL' : 'WARNING',
      status: 'ACTIVE',
      rule: isDegraded ? 'NODE_DEGRADED' : 'PROVISIONING_FAILED',
      title: isDegraded ? `节点 ${target.name} 运行态性能严重降级 (Degraded)` : `节点 ${target.name} 引导装机失败 (Provisioning Failed)`,
      title_en: isDegraded ? `Node ${target.name} Performance Degraded (Thermal & SMART)` : `Node ${target.name} BareMetal Provisioning Failed`,
      message: isDegraded
        ? `检测到物理主机 ${target.name} CPU 核心温度过热 (86°C) 且 NVMe 介质健康度报警。`
        : `节点 ${target.name} 经 Ironic 编排时发生异常，磁盘清理擦除超时。`,
      message_en: isDegraded
        ? `Node ${target.name} CPU temperature critical (86°C) and NVMe SMART endurance warning.`
        : `Node ${target.name} failed during Ironic clean-steps: crypto erase timed out.`,
      error_code: isDegraded ? 'E_HARDWARE_THERMAL_THROTTLE' : 'E_IRONIC_CLEAN_STEP_FAIL',
      diagnostics: {
        phase: target.provisioning_status,
        bmc_ip: target.ip_addresses?.bmc_ip,
        temperature_c: target.sensors?.cpu_temp_c,
        error_detail: target.error_message || 'Unrecoverable exception in remote baremetal daemon',
        suggested_remediation: 'Trigger AI Agent Autonomous Remediation to execute BMC warm reset and BMO reconciler purge.',
      },
      detected_at: new Date().toISOString(),
      dispatched_channels: [],
    };

    this.alerts.set(alert.id, alert);

    this.addLog(
      'agent',
      'eph-agent',
      `[PROACTIVE_WATCHDOG] Node alert triggered for ${target.name} (${alert.rule})`,
      'error',
      `[alert-engine] Severity: ${alert.severity}. Diagnostic code: ${alert.error_code}`
    );

    return alert;
  }

  public autoRemediateAlert(alertId: string): { success: boolean; actions_taken: string[]; host: BareMetalHost } {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert '${alertId}' not found`);
    }

    const host = this.hosts.get(alert.host_name);
    if (!host) {
      throw new Error(`Host '${alert.host_name}' not found`);
    }

    alert.status = 'RESOLVING';

    const actions = [
      `1. Dispatched Redfish Chassis.Reset (ForceRestart) to BMC ${host.bmc_address}`,
      `2. eph-node AI Agent cleared stuck Ironic conductor clean-step locks`,
      `3. Re-applied BareMetalHost CRD metadata & re-queued iPXE provisioning`,
      `4. BMC fan RPM set to High-Efficiency mode; CPU temp dropped to 39°C`,
      `5. Node marked Available / Ready in pool`,
    ];

    host.provisioning_status = 'Available';
    host.error_message = undefined;
    host.sensors.system_health = 'OK';
    host.sensors.cpu_temp_c = 39;
    host.power_status = 'ON';

    alert.status = 'RESOLVED';
    alert.resolved_at = new Date().toISOString();

    this.addLog(
      'agent',
      'eph-agent',
      `[AUTONOMOUS_HEALING] Successfully self-healed node ${host.name} for alert ${alert.id}`,
      'success',
      actions.join('\n')
    );

    this.agentTelemetry.autonomous_decisions_count += 1;

    return {
      success: true,
      actions_taken: actions,
      host,
    };
  }

  public dispatchAlertToEnterpriseApp(
    alertId: string,
    channel: 'feishu' | 'dingtalk' | 'wecom'
  ): { success: boolean; channel: string; message_id: string } {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert '${alertId}' not found`);
    }

    if (!alert.dispatched_channels.includes(channel)) {
      alert.dispatched_channels.push(channel);
    }

    const messageId = `msg_${channel}_alt_${Date.now()}`;

    this.addLog(
      'agent',
      'eph-agent',
      `[ALERT_DISPATCH] Broadcasted node alert (${alert.rule}) to ${channel.toUpperCase()} webhook`,
      'info',
      `Payload signed & encrypted. Target: ${alert.host_name}, Severity: ${alert.severity}`
    );

    return {
      success: true,
      channel,
      message_id: messageId,
    };
  }

  public dismissAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;
    alert.status = 'RESOLVED';
    alert.resolved_at = new Date().toISOString();
    return true;
  }
}

export const globalMetal3Engine = new Metal3Engine();
