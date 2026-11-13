/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  Layers,
  Power,
  RefreshCw,
  Terminal,
  Play,
  RotateCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Network,
  Radio,
  FileCode,
  Send,
  Boxes,
  HelpCircle,
  ExternalLink,
  Copy,
  Download,
  Trash2,
  Pause,
  Eye,
  Sliders,
  ChevronRight,
  X,
  Filter,
  Monitor,
  Flame,
  Gauge,
  Check,
  Scale,
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  Bell,
  BellRing,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  BareMetalHost,
  EphemeralBootstrapNode,
  TargetCluster,
  Metal3LogEvent,
  PowerStatus,
  ProvisioningStatus,
  LogStreamType,
  EphAgentTelemetry,
  HostAlert,
  SupportedK8sVersion,
  SUPPORTED_K8S_VERSIONS,
} from '../domain/metal3';

interface Metal3FleetViewProps {
  currentPrincipal: any;
}

export const Metal3FleetView: React.FC<Metal3FleetViewProps> = ({ currentPrincipal }) => {
  const { language, t } = useLanguage();

  const [ephNode, setEphNode] = useState<EphemeralBootstrapNode | null>(null);
  const [hosts, setHosts] = useState<BareMetalHost[]>([]);
  const [clusters, setClusters] = useState<TargetCluster[]>([]);
  const [logs, setLogs] = useState<Metal3LogEvent[]>([]);
  const [agentTelemetry, setAgentTelemetry] = useState<EphAgentTelemetry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Active Main SubTab
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'dualagent' | 'multicni' | 'omni' | 'versions' | 'terminal' | 'cluster' | 'fleet' | 'ephnode'>('dashboard');

  // Kubernetes Supported Versions & Fleet Upgrade State (v1.33 ~ v1.36)
  const [k8sVersions, setK8sVersions] = useState<SupportedK8sVersion[]>(SUPPORTED_K8S_VERSIONS);
  const [selectedTargetVersion, setSelectedTargetVersion] = useState<string>('v1.35.0');
  const [upgradeScope, setUpgradeScope] = useState<'all' | 'control-plane' | 'worker-gpu' | 'custom'>('all');
  const [selectedUpgradeNodes, setSelectedUpgradeNodes] = useState<string[]>([]);
  const [upgradePolicy, setUpgradePolicy] = useState<'rolling' | 'canary' | 'batch'>('rolling');
  const [drainTimeout, setDrainTimeout] = useState<number>(300);
  const [upgradeProgress, setUpgradeProgress] = useState<any>(null);
  const [isApplyingVersion, setIsApplyingVersion] = useState<boolean>(false);
  const [versionFeedback, setVersionFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [versionFilterCategory, setVersionFilterCategory] = useState<'all' | 'stable' | 'preview'>('all');

  // Dual-Agent Orchestration State
  const [dualAgent, setDualAgent] = useState<any>(null);
  const [triggeringDualRun, setTriggeringDualRun] = useState<boolean>(false);
  const [syncingHeartbeats, setSyncingHeartbeats] = useState<boolean>(false);
  const [pivotingHandover, setPivotingHandover] = useState<boolean>(false);

  // Dual-Network & Multi-CNI Coexistence State
  const [dualNetwork, setDualNetwork] = useState<any>(null);
  const [multiCNI, setMultiCNI] = useState<any>(null);
  const [cniTestResults, setCniTestResults] = useState<any>(null);
  const [testingCNI, setTestingCNI] = useState<boolean>(false);
  const [cniFleet, setCniFleet] = useState<any>(null);
  const [reconcilingCNI, setReconcilingCNI] = useState<boolean>(false);
  const [activeCniArtifact, setActiveCniArtifact] = useState<string>('00-multus.conf');

  // Talos Omni Rapid Deployment State
  const [omniProgress, setOmniProgress] = useState<any>(null);
  const [omniDeploying, setOmniDeploying] = useState<boolean>(false);
  const [omniClusterName, setOmniClusterName] = useState<string>('ai-superpod-h100-omni');
  const [omniK8sVersion, setOmniK8sVersion] = useState<string>('v1.31.2');
  const [omniControlPlanes, setOmniControlPlanes] = useState<number>(3);
  const [omniGPUWorkers, setOmniGPUWorkers] = useState<number>(8);
  const [omniManifests, setOmniManifests] = useState<Record<string, string>>({});
  const [activeManifestKey, setActiveManifestKey] = useState<string>('01-cluster-metal3-capi.yaml');
  const [copiedManifest, setCopiedManifest] = useState<boolean>(false);

  // Packet Flow Simulator State
  const [packetTrafficType, setPacketTrafficType] = useState<'GPU_RDMA_ROCEV2' | 'DPDK_USERSPACE_PMD' | 'POD_L2_VLAN200' | 'APISERVER_MGMT'>('GPU_RDMA_ROCEV2');
  const [packetSimResult, setPacketSimResult] = useState<any>(null);
  const [simulatingPacket, setSimulatingPacket] = useState<boolean>(false);

  // Stepper State
  const [omniStepping, setOmniStepping] = useState<boolean>(false);
  const [omniResetting, setOmniResetting] = useState<boolean>(false);

  // Manifest Live Editor & Validation State
  const [manifestEditorText, setManifestEditorText] = useState<string>('');
  const [manifestValidation, setManifestValidation] = useState<any>(null);
  const [validatingYaml, setValidatingYaml] = useState<boolean>(false);

  // Real-time Host Redfish Telemetry
  const [hostTelemetry, setHostTelemetry] = useState<any>(null);
  const [fetchingTelemetry, setFetchingTelemetry] = useState<boolean>(false);
  const [reprovisioningHost, setReprovisioningHost] = useState<boolean>(false);

  // Pod-Resident Dual-Agent Daemons State (100% Pure Go)
  const [podDaemons, setPodDaemons] = useState<any>(null);
  const [podFiles, setPodFiles] = useState<any>(null);
  const [activePodCodeKey, setActivePodCodeKey] = useState<string>('eph_main_go');
  const [podCommandTarget, setPodCommandTarget] = useState<'eph' | 'target'>('eph');
  const [podCommandInput, setPodCommandInput] = useState<string>('INSPECT_INVENTORY');
  const [podCommandOutput, setPodCommandOutput] = useState<string>('');
  const [dispatchingPodCmd, setDispatchingPodCmd] = useState<boolean>(false);
  const [copiedPodCode, setCopiedPodCode] = useState<boolean>(false);

  // Terminal & Live Logs State
  const [activeStream, setActiveStream] = useState<LogStreamType | 'all'>('all');
  const [logLevelFilter, setLogLevelFilter] = useState<'all' | 'info' | 'success' | 'warn' | 'error'>('all');
  const [terminalSearch, setTerminalSearch] = useState<string>('');
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedConsole, setCopiedConsole] = useState<boolean>(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Interactive Command Input inside Terminal
  const [terminalCommand, setTerminalCommand] = useState<string>('');
  const [executingCmd, setExecutingCmd] = useState<boolean>(false);
  const [commandFeedback, setCommandFeedback] = useState<any>(null);

  // Node Dashboard Filters
  const [dashboardRoleFilter, setDashboardRoleFilter] = useState<string>('all');
  const [dashboardPowerFilter, setDashboardPowerFilter] = useState<string>('all');
  const [dashboardPhaseFilter, setDashboardPhaseFilter] = useState<string>('all');
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState<string>('');
  const [dashboardViewMode, setDashboardViewMode] = useState<'grid' | 'table'>('grid');

  // New Cluster Modal
  const [showDeployModal, setShowDeployModal] = useState<boolean>(false);
  const [newClusterName, setNewClusterName] = useState<string>('ai-superpod-h100-cluster-02');
  const [newClusterK8sVer, setNewClusterK8sVer] = useState<string>('v1.31.2');
  const [newClusterCNI, setNewClusterCNI] = useState<string>('Multus + Calico + OVS-DPDK + Multi-SR-IOV/DPDK');
  const [newClusterMasters, setNewClusterMasters] = useState<number>(3);
  const [newClusterWorkers, setNewClusterWorkers] = useState<number>(32);
  const [newClusterGpuNodes, setNewClusterGpuNodes] = useState<number>(32);
  const [deployingCluster, setDeployingCluster] = useState<boolean>(false);

  // Elastic Scaling Modal
  const [showScaleModal, setShowScaleModal] = useState<boolean>(false);
  const [scaleTargetWorkers, setScaleTargetWorkers] = useState<number>(64);
  const [scaleTargetGpuNodes, setScaleTargetGpuNodes] = useState<number>(60);
  const [scalingCluster, setScalingCluster] = useState<boolean>(false);

  // Rolling Version Upgrade Modal
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [upgradeTargetVersion, setUpgradeTargetVersion] = useState<string>('v1.32.0');
  const [upgradingCluster, setUpgradingCluster] = useState<boolean>(false);

  // Single Node Drain / Scale-down
  const [drainingHostName, setDrainingHostName] = useState<string | null>(null);

  // Selected Host for Details / SOL Console Drawer
  const [selectedHost, setSelectedHost] = useState<BareMetalHost | null>(null);

  // Proactive Fleet Alerts State
  const [alerts, setAlerts] = useState<HostAlert[]>([]);
  const [remediatingAlertId, setRemediatingAlertId] = useState<string | null>(null);
  const [dispatchingChannel, setDispatchingChannel] = useState<{ alertId: string; channel: string } | null>(null);
  const [simulatingAlert, setSimulatingAlert] = useState<boolean>(false);
  const [alertFeedback, setAlertFeedback] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Safe JSON Fetch utility to prevent JSON.parse syntax errors on non-JSON/HTML/corrupted network responses
  const safeJsonFetch = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      if (!text || text.trim() === '') return { ok: res.ok, status: res.status, data: null };
      try {
        const parsed = JSON.parse(text);
        return { ok: res.ok, status: res.status, ...parsed };
      } catch {
        return { ok: false, status: res.status, error: text };
      }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error' };
    }
  };

  // Fetch Metal3 data from API
  const fetchMetal3Data = async () => {
    try {
      const [ephRes, bmhRes, clRes, logsRes, agentRes, alertsRes, daRes, netRes, cniRes, cniFleetRes, omniRes, manRes, podDaemonsRes, podCodeRes, k8sVerRes] = await Promise.all([
        safeJsonFetch('/api/v1/metal3/eph-node'),
        safeJsonFetch('/api/v1/metal3/bmh'),
        safeJsonFetch('/api/v1/metal3/clusters'),
        safeJsonFetch('/api/v1/metal3/logs'),
        safeJsonFetch('/api/v1/metal3/agent/status'),
        safeJsonFetch('/api/v1/metal3/alerts'),
        safeJsonFetch('/api/v1/metal3/dual-agent/status'),
        safeJsonFetch('/api/v1/metal3/network/spec'),
        safeJsonFetch('/api/v1/metal3/cni/spec'),
        safeJsonFetch('/api/v1/metal3/cni/fleet'),
        safeJsonFetch('/api/v1/metal3/omni/status'),
        safeJsonFetch('/api/v1/metal3/omni/manifests'),
        safeJsonFetch('/api/v1/metal3/agents/pod-daemons'),
        safeJsonFetch('/api/v1/metal3/agents/pod-code'),
        safeJsonFetch('/api/v1/metal3/k8s-versions'),
      ]);

      if (k8sVerRes?.data && Array.isArray(k8sVerRes.data)) {
        setK8sVersions(k8sVerRes.data);
      }
      if (ephRes?.data) setEphNode(ephRes.data);
      if (bmhRes?.data) {
        const normalizedHosts = bmhRes.data.map((h: any) => ({
          ...h,
          boot_image: h.boot_image || 'talos-v1.8.2-cloud-init.iso',
          provisioning_progress_percent: h.provisioning_progress_percent ?? (h.provisioning_status === 'ActiveInCluster' ? 100 : 80),
          hardware: {
            vendor: h.hardware?.vendor || 'Dell EMC',
            model: h.hardware?.model || 'PowerEdge R760xa AI SuperServer',
            cpu: h.hardware?.cpu || 'Dual Intel Xeon Platinum 8480+ (112C/224T)',
            cores: h.hardware?.cores || h.hardware?.cpu_cores || 128,
            ram_gb: h.hardware?.ram_gb || h.hardware?.memory_gb || 512,
            nvme_tb: h.hardware?.nvme_tb || 15.36,
            gpus: h.hardware?.gpus || h.hardware?.gpu_model || '8x NVIDIA H100 80GB SXM5',
            nics: h.hardware?.nics || 'Dual 200Gbps Mellanox ConnectX-7',
          },
          sensors: {
            cpu_temp_c: h.sensors?.cpu_temp_c || 42.0,
            fan_speed_rpm: h.sensors?.fan_speed_rpm || h.sensors?.fan_rpm || 7200,
            power_watts: h.sensors?.power_watts || h.sensors?.power_watt || 420,
            system_health: h.sensors?.system_health || 'OK',
            dimm_status: h.sensors?.dimm_status || 'ALL_CHANNELS_NOMINAL',
            nvme_smart_health: h.sensors?.nvme_smart_health || '100% HEALTHY (0 ERRORS)',
          },
          ip_addresses: h.ip_addresses || {
            bmc_ip: h.ip_addresses?.bmc_ip || '10.240.10.101',
            provisioning_ip: h.ip_addresses?.provisioning_ip || '10.244.100.21',
            target_ip: h.ip_addresses?.target_ip || '10.250.0.21',
          },
          serial_console_recent: h.serial_console_recent || [
            `[SOL ${h.name}] System booted and synchronized`,
          ],
        }));
        setHosts(normalizedHosts);
        if (selectedHost) {
          const updated = normalizedHosts.find((h: BareMetalHost) => h.name === selectedHost.name);
          if (updated) setSelectedHost(updated);
        }
      }
      if (clRes?.data) {
        const normalized = clRes.data.map((c: any) => ({
          ...c,
          k8s_version: c.k8s_version || c.version || 'v1.31.2',
          cni: c.cni || 'Multus + Calico + OVS + SR-IOV',
          gpu_operator: c.gpu_operator || 'NVIDIA GPU Operator v24.6.0 (8x H100)',
          progress_percent: c.progress_percent ?? 100,
          current_stage: c.current_stage || 'FLEET_READY',
          api_endpoint: c.api_endpoint || 'https://10.240.10.10:6443',
          scale: c.scale || {
            control_plane_nodes: c.control_plane_nodes || 3,
            worker_nodes: c.worker_nodes || 7,
            gpu_nodes: c.worker_nodes || 7,
            total_nodes: (c.control_plane_nodes || 3) + (c.worker_nodes || 7),
          },
        }));
        setClusters(normalized);
        if (normalized[0]) {
          setScaleTargetWorkers(normalized[0].scale?.worker_nodes ?? 7);
          setScaleTargetGpuNodes(normalized[0].scale?.gpu_nodes ?? 7);
          const upgRes = await safeJsonFetch(`/api/v1/metal3/clusters/${normalized[0].id}/upgrade-status`);
          if (upgRes?.data?.job_id) {
            setUpgradeProgress(upgRes.data);
          }
        }
      }
      if (logsRes?.data) setLogs(logsRes.data);
      if (agentRes?.data) setAgentTelemetry(agentRes.data);
      if (alertsRes?.data) setAlerts(alertsRes.data);
      if (daRes?.data) setDualAgent(daRes.data);
      if (netRes?.data) setDualNetwork(netRes.data);
      if (cniRes?.data) setMultiCNI(cniRes.data);
      if (cniFleetRes?.data) setCniFleet(cniFleetRes.data);
      if (omniRes?.data) setOmniProgress(omniRes.data);
      if (manRes?.manifests) {
        setOmniManifests(manRes.manifests);
        const keys = Object.keys(manRes.manifests);
        if (keys.length > 0 && !activeManifestKey) setActiveManifestKey(keys[0]);
      }
      if (podDaemonsRes?.data) {
        setPodDaemons(podDaemonsRes.data);
      }
      if (podCodeRes?.files) {
        setPodFiles(podCodeRes.files);
      }
    } catch (err) {
      console.error('Failed to fetch metal3 data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDispatchPodCommand = async (targetAgent?: 'eph' | 'target', cmd?: string) => {
    const tgt = targetAgent || podCommandTarget;
    const command = cmd || podCommandInput;
    if (!command) return;
    try {
      setDispatchingPodCmd(true);
      const res = await safeJsonFetch('/api/v1/metal3/agents/pod-daemons/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_agent: tgt, command }),
      });
      if (res?.data?.output) {
        setPodCommandOutput(res.data.output);
      }
      await fetchMetal3Data();
    } catch (err) {
      console.error('Dispatch pod command failed:', err);
    } finally {
      setDispatchingPodCmd(false);
    }
  };

  const handleCopyPodCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPodCode(true);
    setTimeout(() => setCopiedPodCode(false), 2000);
  };

  // Simulate Node Degradation / Provisioning Failure
  const handleSimulateAlert = async (rule?: 'NODE_DEGRADED' | 'PROVISIONING_FAILED') => {
    setSimulatingAlert(true);
    try {
      const res = await safeJsonFetch('/api/v1/metal3/alerts/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: rule || 'PROVISIONING_FAILED' }),
      });
      if (res.data) {
        setAlertFeedback({
          message:
            language === 'zh'
              ? `已成功注入硬件异常演练 (${res.data.host_name}) [${res.data.error_code}]`
              : `Fault drill injected for (${res.data.host_name}) [${res.data.error_code}]`,
          type: 'info',
        });
        await fetchMetal3Data();
      }
    } catch (err) {
      console.error('Simulate alert failed:', err);
    } finally {
      setSimulatingAlert(false);
    }
  };

  // Autonomous Self-Healing by AI Agent
  const handleRemediateAlert = async (alertId: string) => {
    setRemediatingAlertId(alertId);
    try {
      const res = await safeJsonFetch(`/api/v1/metal3/alerts/${alertId}/remediate`, {
        method: 'POST',
      });
      if (res.success) {
        setAlertFeedback({
          message: t.alertRemediationSuccess,
          type: 'success',
        });
        await fetchMetal3Data();
      }
    } catch (err) {
      console.error('Remediate alert failed:', err);
    } finally {
      setRemediatingAlertId(null);
    }
  };

  // Dispatch alert to Enterprise Chatbot
  const handleDispatchAlert = async (alertId: string, channel: 'feishu' | 'dingtalk' | 'wecom') => {
    setDispatchingChannel({ alertId, channel });
    try {
      const res = await safeJsonFetch(`/api/v1/metal3/alerts/${alertId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      if (res.success) {
        setAlertFeedback({
          message: `${t.alertDispatchSuccess} (${channel.toUpperCase()})`,
          type: 'success',
        });
        await fetchMetal3Data();
      }
    } catch (err) {
      console.error('Dispatch alert failed:', err);
    } finally {
      setDispatchingChannel(null);
    }
  };

  // Dismiss / Mark Alert Resolved
  const handleDismissAlert = async (alertId: string) => {
    try {
      await safeJsonFetch(`/api/v1/metal3/alerts/${alertId}/dismiss`, { method: 'POST' });
      await fetchMetal3Data();
    } catch (err) {
      console.error('Dismiss alert failed:', err);
    }
  };

  // Dual-Agent Orchestration Actions
  const handleTriggerDualRun = async (phase?: string) => {
    try {
      setTriggeringDualRun(true);
      const res = await safeJsonFetch('/api/v1/metal3/dual-agent/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: phase || 'MULTI_CNI_CONVERGE' }),
      });
      if (res?.data) {
        setDualAgent(res.data);
      }
    } catch (err) {
      console.error('Trigger dual-agent run failed:', err);
    } finally {
      setTriggeringDualRun(false);
    }
  };

  const handleSyncHeartbeats = async () => {
    try {
      setSyncingHeartbeats(true);
      const res = await safeJsonFetch('/api/v1/metal3/dual-agent/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res?.data) setDualAgent(res.data);
    } catch (err) {
      console.error('Sync heartbeats failed:', err);
    } finally {
      setSyncingHeartbeats(false);
    }
  };

  const handlePivotHandover = async () => {
    try {
      setPivotingHandover(true);
      const res = await safeJsonFetch('/api/v1/metal3/dual-agent/pivot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res?.data) setDualAgent(res.data);
    } catch (err) {
      console.error('Pivot handover failed:', err);
    } finally {
      setPivotingHandover(false);
    }
  };

  // Multi-CNI Packet Flow Benchmark
  const handleTestCNIPackets = async () => {
    try {
      setTestingCNI(true);
      const res = await safeJsonFetch('/api/v1/metal3/cni/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res?.results) {
        setCniTestResults(res.results);
      }
    } catch (err) {
      console.error('Test CNI failed:', err);
    } finally {
      setTestingCNI(false);
    }
  };

  // Talos Omni Rapid BareMetal Deploy
  const handleInstantOmniDeploy = async () => {
    try {
      setOmniDeploying(true);
      const hostNames = hosts.slice(0, 11).map(h => h.name);
      const res = await safeJsonFetch('/api/v1/metal3/omni/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cluster_name: omniClusterName,
          k8s_version: omniK8sVersion,
          control_plane_nodes: omniControlPlanes,
          worker_gpu_nodes: omniGPUWorkers,
          selected_host_names: hostNames,
          enable_dual_network: true,
          enable_multi_cni: true,
          auto_pivot: true,
        }),
      });
      if (res?.data) {
        setOmniProgress(res.data);
        if (res.data.manifests) {
          setOmniManifests(res.data.manifests);
        }
      }
      await fetchMetal3Data();
    } catch (err) {
      console.error('Omni deploy failed:', err);
    } finally {
      setOmniDeploying(false);
    }
  };

  // Packet Flow Simulation (Multi-CNI & Dual Network)
  const handleSimulatePacketFlow = async (trafficType?: 'GPU_RDMA_ROCEV2' | 'DPDK_USERSPACE_PMD' | 'POD_L2_VLAN200' | 'APISERVER_MGMT') => {
    const tType = trafficType || packetTrafficType;
    try {
      setSimulatingPacket(true);
      setPacketTrafficType(tType);
      const res = await safeJsonFetch('/api/v1/metal3/cni/simulate-packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traffic_type: tType }),
      });
      if (res?.data) {
        setPacketSimResult(res.data);
      }
    } catch (err) {
      console.error('Simulate packet failed:', err);
    } finally {
      setSimulatingPacket(false);
    }
  };

  // Fleet CNI State Machine Reconcile & Drift Handlers (pkg/cni)
  const handleReconcileCNIFleet = async (convergeAll: boolean = true) => {
    try {
      setReconcilingCNI(true);
      const res = await safeJsonFetch('/api/v1/metal3/cni/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ converge_all: convergeAll }),
      });
      if (res?.data) {
        setCniFleet(res.data);
      }
    } catch (err) {
      console.error('Reconcile CNI fleet failed:', err);
    } finally {
      setReconcilingCNI(false);
    }
  };

  const handleInjectCNIDrift = async (hostName: string = 'bmh-worker-k8s-01', plugin: string = 'sriov-dpdk') => {
    try {
      setReconcilingCNI(true);
      await safeJsonFetch('/api/v1/metal3/cni/drift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_name: hostName, plugin, degraded: false }),
      });
      const fleetRes = await safeJsonFetch('/api/v1/metal3/cni/fleet');
      if (fleetRes?.data) setCniFleet(fleetRes.data);
    } catch (err) {
      console.error('Inject CNI drift failed:', err);
    } finally {
      setReconcilingCNI(false);
    }
  };

  // Omni Deployment Stepper Handlers
  const handleStartOmni = async () => {
    try {
      setOmniStepping(true);
      const hostNames = hosts.slice(0, 11).map(h => h.name);
      const res = await safeJsonFetch('/api/v1/metal3/omni/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cluster_name: omniClusterName,
          k8s_version: omniK8sVersion,
          control_plane_nodes: omniControlPlanes,
          worker_gpu_nodes: omniGPUWorkers,
          selected_host_names: hostNames,
          enable_dual_network: true,
          enable_multi_cni: true,
          auto_pivot: true,
        }),
      });
      if (res?.data) {
        setOmniProgress(res.data);
      }
      await fetchMetal3Data();
    } catch (err) {
      console.error('Start Omni failed:', err);
    } finally {
      setOmniStepping(false);
    }
  };

  const handleNextOmniStep = async () => {
    try {
      setOmniStepping(true);
      const res = await safeJsonFetch('/api/v1/metal3/omni/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res?.data) {
        setOmniProgress(res.data);
      }
      await fetchMetal3Data();
    } catch (err) {
      console.error('Next Omni step failed:', err);
    } finally {
      setOmniStepping(false);
    }
  };

  const handleResetOmni = async () => {
    try {
      setOmniResetting(true);
      const res = await safeJsonFetch('/api/v1/metal3/omni/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res?.data) {
        setOmniProgress(res.data);
      }
      await fetchMetal3Data();
    } catch (err) {
      console.error('Reset Omni failed:', err);
    } finally {
      setOmniResetting(false);
    }
  };

  // YAML Manifest Validation with Pure Go Engine
  const handleValidateYaml = async (contentToValidate?: string) => {
    try {
      setValidatingYaml(true);
      const content = contentToValidate || manifestEditorText || omniManifests[activeManifestKey] || '';
      const res = await safeJsonFetch('/api/v1/metal3/omni/validate-yaml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: activeManifestKey,
          content: content,
        }),
      });
      if (res?.data) {
        setManifestValidation(res.data);
      }
    } catch (err) {
      console.error('Validate YAML failed:', err);
    } finally {
      setValidatingYaml(false);
    }
  };

  // Real-time Redfish Telemetry
  const handleFetchHostTelemetry = async (hostName: string) => {
    try {
      setFetchingTelemetry(true);
      const res = await safeJsonFetch(`/api/v1/metal3/bmh/${hostName}/telemetry`);
      if (res?.telemetry) {
        setHostTelemetry(res.telemetry);
      }
    } catch (err) {
      console.error('Fetch host telemetry failed:', err);
    } finally {
      setFetchingTelemetry(false);
    }
  };

  const handleReprovisionHost = async (hostName: string) => {
    try {
      setReprovisioningHost(true);
      const res = await safeJsonFetch(`/api/v1/metal3/bmh/${hostName}/reprovision`, {
        method: 'POST',
      });
      if (res?.success) {
        await fetchMetal3Data();
        await handleFetchHostTelemetry(hostName);
      }
    } catch (err) {
      console.error('Reprovision host failed:', err);
    } finally {
      setReprovisioningHost(false);
    }
  };

  const handleCopyManifest = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 2000);
  };

  useEffect(() => {
    fetchMetal3Data();
    const interval = setInterval(fetchMetal3Data, 6000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll terminal when new logs arrive
  useEffect(() => {
    if (autoScroll && activeSubTab === 'terminal') {
      terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeStream, logLevelFilter, activeSubTab, autoScroll]);

  // Live simulation tick: periodically generate realistic live events when isLiveStreaming is on
  useEffect(() => {
    if (!isLiveStreaming) return;
    const streamTicker = setInterval(() => {
      const mockStreams: LogStreamType[] = ['agent', 'k8s-install', 'ironic-redirect'];
      const pickedStream = mockStreams[Math.floor(Math.random() * mockStreams.length)];

      const sampleAgentEvents = [
        'Eph-Node AI Agent heartbeat ping OK; mTLS 1.3 handshake verified with control plane',
        'Autonomous Watchdog: checked BareMetalHost CRDs (67 items); 0 reconciliation errors',
        'Autonomous Telemetry: bmh-gpu-supernode-01..08 NVLink 900GB/s bandwidth confirmed nominal',
        'Autonomous Policy Check: Calico BGP spine-leaf peering + Multus NAD mesh verified with ToR switch',
      ];

      const sampleK8sEvents = [
        'kubelet[2104]: [cgroup] cgroup v2 memory & pids limits synchronized across all pods',
        'stacked-etcd: raft leader heartbeat round-trip 0.8ms across 3 control plane masters',
        'multus-cni: Attached eth0 (Calico), net1 (OVS-DPDK br-data), net2 (vfio-pci DPDK), net3 (CX-7 RoCEv2)',
        'nvidia-fabricmanager: All 8 SXM5 H100 GPUs reporting NVSwitch non-blocking full mesh',
      ];

      const sampleIronicEvents = [
        'ironic-conductor: periodic power state sync completed for 67 baremetal chassis',
        'dnsmasq-dhcp[812]: DHCPACK(eth0) 172.22.0.127 52:54:00:b2:00:07 bmh-gpu-supernode-07',
        '[SOL ttyS0] Linux kernel 6.8: ConnectX-7 IB0 RoCEv2 MTU 9000 link state UP',
        'ironic-inspector: LLDP chassis-id TLV parsed; switch port Eth1/4 assigned to VLAN 101',
      ];

      let msg = '';
      let source: any = 'eph-agent';
      if (pickedStream === 'agent') {
        msg = sampleAgentEvents[Math.floor(Math.random() * sampleAgentEvents.length)];
        source = 'eph-agent';
      } else if (pickedStream === 'k8s-install') {
        msg = sampleK8sEvents[Math.floor(Math.random() * sampleK8sEvents.length)];
        source = 'k8s-kubeadm';
      } else {
        msg = sampleIronicEvents[Math.floor(Math.random() * sampleIronicEvents.length)];
        source = 'ironic-conductor';
      }

      setLogs(prev => [
        {
          id: `live_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          timestamp: new Date().toISOString(),
          stream: pickedStream,
          source,
          message: msg,
          level: 'info',
          raw_output: `[${pickedStream.toUpperCase()}:${source}] ${msg}`,
        },
        ...prev.slice(0, 150),
      ]);
    }, 4500);

    return () => clearInterval(streamTicker);
  }, [isLiveStreaming]);

  // BMC Power Action
  const handlePowerAction = async (hostName: string, action: 'on' | 'off' | 'reboot' | 'pxe-boot') => {
    try {
      const res = await safeJsonFetch(`/api/v1/metal3/bmh/${hostName}/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res?.data) {
        setHosts(prev => prev.map(h => (h.name === hostName ? res.data : h)));
        fetchMetal3Data();
      }
    } catch (err) {
      console.error('Power action failed:', err);
    }
  };

  // Inspect Host
  const handleInspectHost = async (hostName: string) => {
    try {
      const res = await safeJsonFetch(`/api/v1/metal3/bmh/${hostName}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res?.data) {
        setHosts(prev => prev.map(h => (h.name === hostName ? res.data : h)));
        fetchMetal3Data();
      }
    } catch (err) {
      console.error('Inspect failed:', err);
    }
  };

  // Trigger CAPI Pivot
  const handleTriggerPivot = async (clusterId: string) => {
    if (
      !confirm(
        language === 'zh'
          ? '确认将 CAPI 及 Metal3 CRD 资产控制权移交 (Pivot) 至目标集群主控平面？'
          : 'Confirm CAPI resource pivot to Target K8s Cluster control plane?'
      )
    ) {
      return;
    }
    try {
      const res = await safeJsonFetch(`/api/v1/metal3/clusters/${clusterId}/pivot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res?.success) {
        fetchMetal3Data();
      }
    } catch (err) {
      console.error('Pivot failed:', err);
    }
  };

  // Elastic Scaling Handler (Scale Up / Scale Down)
  const handleScaleCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCluster) return;

    setScalingCluster(true);
    try {
      const res = await safeJsonFetch(`/api/v1/metal3/clusters/${activeCluster.id}/scale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_nodes: Number(scaleTargetWorkers),
          gpu_nodes: Number(scaleTargetGpuNodes),
        }),
      });

      if (res?.success) {
        setShowScaleModal(false);
        fetchMetal3Data();
      }
    } catch (err) {
      console.error('Scaling failed:', err);
    } finally {
      setScalingCluster(false);
    }
  };

  // Rolling Version Upgrade Handler
  const handleUpgradeCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCluster) return;

    setUpgradingCluster(true);
    try {
      const res = await safeJsonFetch(`/api/v1/metal3/clusters/${activeCluster.id}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_k8s_version: upgradeTargetVersion,
          policy: upgradePolicy,
          drain_timeout: drainTimeout,
        }),
      });

      if (res?.success) {
        setShowUpgradeModal(false);
        setUpgradeProgress(res.data);
        fetchMetal3Data();
      }
    } catch (err) {
      console.error('Upgrade failed:', err);
    } finally {
      setUpgradingCluster(false);
    }
  };

  // Kubernetes Version Matrix Apply Handler (Fleet & Scoped)
  const handleApplyVersionToFleet = async (customVersion?: string) => {
    const targetVer = customVersion || selectedTargetVersion;
    if (!activeCluster) return;

    setIsApplyingVersion(true);
    setVersionFeedback(null);
    try {
      let nodesToUpgrade: string[] = [];
      if (upgradeScope === 'all') {
        nodesToUpgrade = hosts.map(h => h.name);
      } else if (upgradeScope === 'control-plane') {
        nodesToUpgrade = hosts.filter(h => h.assigned_role === 'control-plane').map(h => h.name);
      } else if (upgradeScope === 'worker-gpu') {
        nodesToUpgrade = hosts.filter(h => h.assigned_role === 'worker-gpu').map(h => h.name);
      } else if (upgradeScope === 'custom') {
        nodesToUpgrade = selectedUpgradeNodes.length > 0 ? selectedUpgradeNodes : hosts.slice(0, 3).map(h => h.name);
      }

      const res = await safeJsonFetch(`/api/v1/metal3/clusters/${activeCluster.id}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_k8s_version: targetVer,
          policy: upgradePolicy,
          target_nodes: nodesToUpgrade,
          drain_timeout: drainTimeout,
        }),
      });

      if (res?.success) {
        setUpgradeProgress(res.data);
        setVersionFeedback({
          message: `${language === 'zh' ? '成功触发集群版本平滑升级！目标版本: ' : 'Successfully triggered cluster rolling upgrade! Target: '} ${targetVer}`,
          type: 'success',
        });
        await fetchMetal3Data();
      } else {
        const errMsg = typeof res?.error === 'string'
          ? res.error
          : res?.error?.message || res?.message || 'Upgrade trigger failed';
        setVersionFeedback({
          message: errMsg,
          type: 'error',
        });
      }
    } catch (err: any) {
      setVersionFeedback({
        message: err?.message || 'Network error during upgrade',
        type: 'error',
      });
    } finally {
      setIsApplyingVersion(false);
    }
  };

  // Apply Version to Single Specific Node Handler
  const handleApplyVersionToSingleNode = async (nodeName: string, targetVer?: string) => {
    const ver = targetVer || selectedTargetVersion;
    setIsApplyingVersion(true);
    try {
      const res = await safeJsonFetch('/api/v1/metal3/nodes/version-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_name: nodeName,
          target_k8s_version: ver,
          policy: 'rolling',
          drain_timeout: 180,
        }),
      });
      if (res?.success) {
        setVersionFeedback({
          message: `${language === 'zh' ? '节点 ' : 'Node '}${nodeName} ${language === 'zh' ? '已成功应用版本: ' : 'successfully applied version: '}${ver}`,
          type: 'success',
        });
        await fetchMetal3Data();
      } else {
        const errMsg = typeof res?.error === 'string'
          ? res.error
          : res?.error?.message || res?.message || 'Node version apply failed';
        setVersionFeedback({
          message: errMsg,
          type: 'error',
        });
      }
    } catch (err: any) {
      setVersionFeedback({
        message: err?.message || 'Node version apply failed',
        type: 'error',
      });
    } finally {
      setIsApplyingVersion(false);
    }
  };

  // Single Node Safe Drain & Decommission
  const handleDrainNode = async (hostName: string) => {
    if (!activeCluster) return;
    if (
      !confirm(
        language === 'zh'
          ? `确认由 AI Agent 安全逐出并缩容节点 ${hostName}？(将执行 kubectl cordon & drain，抹除 NVMe 磁盘并下电归还备用池)`
          : `Confirm AI Agent safe cordon & drain on node ${hostName}? (Will cordon, drain pods, sanitize disk, and return to pool)`
      )
    ) {
      return;
    }

    setDrainingHostName(hostName);
    try {
      const res = await safeJsonFetch(`/api/v1/metal3/clusters/${activeCluster.id}/scale-down-node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_name: hostName }),
      });

      if (res?.success) {
        fetchMetal3Data();
      }
    } catch (err) {
      console.error('Drain node failed:', err);
    } finally {
      setDrainingHostName(null);
    }
  };

  // Dispatch Command to Eph-Node Agent
  const handleDispatchCommand = async (cmdToRun?: string) => {
    const cmd = cmdToRun || terminalCommand;
    if (!cmd.trim()) return;

    setExecutingCmd(true);
    setCommandFeedback(null);
    try {
      const res = await safeJsonFetch('/api/v1/metal3/agent/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });

      if (res?.data) {
        setCommandFeedback(res.data);
        setTerminalCommand('');
        fetchMetal3Data();
      }
    } catch (err) {
      console.error('Failed to dispatch command:', err);
    } finally {
      setExecutingCmd(false);
    }
  };

  // Deploy Target Cluster
  const handleCreateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeployingCluster(true);
    try {
      const res = await safeJsonFetch('/api/v1/metal3/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClusterName,
          k8s_version: newClusterK8sVer,
          cni: newClusterCNI,
          gpu_operator: 'NVIDIA GPU Operator v24.6.0 (CUDA 12.4 + FabricManager)',
          scale: {
            control_plane_nodes: Number(newClusterMasters),
            worker_nodes: Number(newClusterWorkers),
            gpu_nodes: Number(newClusterGpuNodes),
          },
        }),
      });

      if (res?.success) {
        setShowDeployModal(false);
        fetchMetal3Data();
        setActiveSubTab('cluster');
      }
    } catch (err) {
      console.error('Failed to create target cluster:', err);
    } finally {
      setDeployingCluster(false);
    }
  };

  // Copy Console Text Output
  const handleCopyTerminal = () => {
    const formatted = filteredTerminalLogs
      .map(
        l =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.stream.toUpperCase()}] [${l.level.toUpperCase()}] ${l.raw_output || l.message}`
      )
      .join('\n');
    navigator.clipboard.writeText(formatted);
    setCopiedConsole(true);
    setTimeout(() => setCopiedConsole(false), 2000);
  };

  // Export Console Log File
  const handleExportLog = () => {
    const formatted = filteredTerminalLogs
      .map(
        l =>
          `[${l.timestamp}] [${l.stream.toUpperCase()}] [${l.source}] [${l.level.toUpperCase()}] ${l.raw_output || l.message}`
      )
      .join('\n');
    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metal3-${activeStream}-log-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered Terminal Logs
  const filteredTerminalLogs = logs.filter(l => {
    const matchesStream = activeStream === 'all' || l.stream === activeStream;
    const matchesLevel = logLevelFilter === 'all' || l.level === logLevelFilter;
    const matchesSearch =
      !terminalSearch ||
      l.message.toLowerCase().includes(terminalSearch.toLowerCase()) ||
      (l.raw_output && l.raw_output.toLowerCase().includes(terminalSearch.toLowerCase())) ||
      l.source.toLowerCase().includes(terminalSearch.toLowerCase()) ||
      (l.target_host && l.target_host.toLowerCase().includes(terminalSearch.toLowerCase()));
    return matchesStream && matchesLevel && matchesSearch;
  });

  // Filtered hosts for Node Dashboard
  const filteredDashboardHosts = hosts.filter(h => {
    const matchesRole = dashboardRoleFilter === 'all' || h.assigned_role === dashboardRoleFilter;
    const matchesPower = dashboardPowerFilter === 'all' || h.power_status === dashboardPowerFilter;
    const matchesPhase = dashboardPhaseFilter === 'all' || h.provisioning_status === dashboardPhaseFilter;
    const matchesSearch =
      !dashboardSearchQuery ||
      h.name.toLowerCase().includes(dashboardSearchQuery.toLowerCase()) ||
      h.rack_location.toLowerCase().includes(dashboardSearchQuery.toLowerCase()) ||
      h.boot_mac_address.toLowerCase().includes(dashboardSearchQuery.toLowerCase()) ||
      (h.ip_addresses?.bmc_ip && h.ip_addresses.bmc_ip.includes(dashboardSearchQuery)) ||
      (h.ip_addresses?.provisioning_ip && h.ip_addresses.provisioning_ip.includes(dashboardSearchQuery)) ||
      (h.ip_addresses?.target_ip && h.ip_addresses.target_ip.includes(dashboardSearchQuery)) ||
      h.hardware.vendor.toLowerCase().includes(dashboardSearchQuery.toLowerCase()) ||
      h.hardware.gpus.toLowerCase().includes(dashboardSearchQuery.toLowerCase());
    return matchesRole && matchesPower && matchesPhase && matchesSearch;
  });

  const activeCluster = clusters[0];

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <Boxes className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">{t.metal3Title}</h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                eph-node Agent Active (mTLS 1.3)
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-4xl leading-relaxed">{t.metal3Subtitle}</p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowDeployModal(true)}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>{t.btnDeployCluster}</span>
            </button>
            <button
              onClick={fetchMetal3Data}
              disabled={refreshing}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Refresh Fleet Status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{language === 'zh' ? '刷新全量状态' : 'Sync Fleet'}</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>{language === 'zh' ? '引导节点 (eph-node)' : 'Bootstrap Eph-Node'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                v1.31.2
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-white font-mono">{ephNode?.status || 'ONLINE'}</span>
              <span className="text-xs text-emerald-400 font-mono">1 Node K8s</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 truncate">
              {ephNode?.ip_address || '10.240.10.1'} | {(ephNode?.host_specs?.cpu ? ephNode.host_specs.cpu.split(' ')[0] : '64')} Cores
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>{language === 'zh' ? 'BareMetalHost 裸机资产' : 'BMH Fleet Scale'}</span>
              <Server className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-white font-mono">{hosts.length}</span>
              <span className="text-xs text-slate-400">
                ({hosts.filter(h => h.assigned_role === 'worker-gpu').length} GPU Nodes)
              </span>
            </div>
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>
                {hosts.filter(h => h.provisioning_status === 'ActiveInCluster').length} Active in Cluster
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>{language === 'zh' ? 'NVIDIA H100 GPU 算力' : 'AI Accelerators'}</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {hosts.filter(h => h.assigned_role === 'worker-gpu').length * 8}
              </span>
              <span className="text-xs text-slate-400">x H100 SXM5</span>
            </div>
            <div className="text-[10px] text-indigo-300 mt-1 truncate">
              NVLink 900GB/s • 400G ConnectX-7
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>{language === 'zh' ? '目标集群部署状态' : 'Target K8s Deployment'}</span>
              <Boxes className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-white font-mono">
                {activeCluster ? `${activeCluster.progress_percent}%` : 'IDLE'}
              </span>
              <span className="text-xs text-cyan-400 truncate">{activeCluster?.name}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 truncate">
              {activeCluster?.status === 'CONFIGURING_GPU_ROCE'
                ? 'RoCEv2 Fabric Init'
                : activeCluster?.status === 'SCALING_UP'
                  ? 'AI Agent Elastic Scale-Up'
                  : activeCluster?.status === 'SCALING_DOWN'
                    ? 'AI Agent Graceful Scale-Down'
                    : activeCluster?.status === 'UPGRADING_VERSION'
                      ? 'AI Agent In-Place Rolling Upgrade'
                      : activeCluster?.status}
            </div>
          </div>
        </div>
      </div>

      {/* Proactive Health Alerts Feedback Toast */}
      {alertFeedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition animate-in fade-in duration-200 ${
            alertFeedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
              : 'bg-indigo-950/80 border-indigo-700 text-indigo-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{alertFeedback.message}</span>
          </div>
          <button
            onClick={() => setAlertFeedback(null)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Proactive Health Alert System Banner */}
      {(() => {
        const activeAlerts = alerts.filter(a => a.status !== 'RESOLVED');
        if (activeAlerts.length > 0) {
          return (
            <div className="p-4 rounded-xl border border-rose-500/70 bg-gradient-to-r from-rose-950/50 via-slate-900 to-rose-950/40 shadow-xl shadow-rose-950/30 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-900/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-rose-900/60 text-rose-300 border border-rose-700">
                    <BellRing className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white tracking-tight">{t.alertBannerTitle}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-600 text-white animate-pulse">
                        {activeAlerts.length} {t.alertDegradedCount}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-300/80 mt-0.5">
                      {language === 'zh'
                        ? 'eph-node AI Agent 智能感知 BareMetalHost 降级与装机中断，支持带外一键自愈与协同群告警派发。'
                        : 'eph-node AI Agent actively senses baremetal degradation and provisioning interruptions, providing out-of-band self-healing & bot dispatch.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleSimulateAlert('NODE_DEGRADED')}
                    disabled={simulatingAlert}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-800/80 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                    title="Simulate Node Degraded Alert"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>{simulatingAlert ? '...' : (language === 'zh' ? '模拟性能降级 (Degraded)' : 'Drill: Degraded')}</span>
                  </button>
                  <button
                    onClick={() => handleSimulateAlert('PROVISIONING_FAILED')}
                    disabled={simulatingAlert}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-800/80 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                    title="Simulate Provisioning Failed Alert"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>{simulatingAlert ? '...' : (language === 'zh' ? '模拟装机中断 (Failed)' : 'Drill: Failed')}</span>
                  </button>
                </div>
              </div>

              {/* Alert Items List */}
              <div className="space-y-3">
                {activeAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className="p-3.5 rounded-lg bg-slate-950/80 border border-rose-900/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            alert.severity === 'CRITICAL'
                              ? 'bg-rose-950 text-rose-300 border-rose-700'
                              : 'bg-amber-950 text-amber-300 border-amber-700'
                          }`}
                        >
                          {alert.severity === 'CRITICAL' ? t.alertSeverityCritical : t.alertSeverityWarning}
                        </span>
                        <span className="font-mono font-bold text-white">{alert.host_name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {alert.error_code}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(alert.detected_at).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="font-semibold text-slate-200">
                        {language === 'zh' ? alert.title : alert.title_en}
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {language === 'zh' ? alert.message : alert.message_en}
                      </p>

                      {alert.diagnostics && (
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
                          <span>Phase: {alert.diagnostics.phase}</span>
                          <span>• BMC: {alert.diagnostics.bmc_ip}</span>
                          {alert.diagnostics.temperature_c && <span>• Temp: {alert.diagnostics.temperature_c}°C</span>}
                          <span className="text-amber-400/90">• {alert.diagnostics.error_detail}</span>
                        </div>
                      )}
                    </div>

                    {/* Alert Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRemediateAlert(alert.id)}
                        disabled={remediatingAlertId === alert.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Wrench className={`w-3.5 h-3.5 ${remediatingAlertId === alert.id ? 'animate-spin' : ''}`} />
                        <span>{remediatingAlertId === alert.id ? t.alertStatusResolving : t.alertAutoRemediateBtn}</span>
                      </button>

                      {/* Dispatch Buttons */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                        <button
                          onClick={() => handleDispatchAlert(alert.id, 'feishu')}
                          disabled={dispatchingChannel?.alertId === alert.id}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                            alert.dispatched_channels.includes('feishu')
                              ? 'bg-blue-950 text-blue-300 border border-blue-700'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800'
                          }`}
                          title="Dispatch to Feishu"
                        >
                          <Send className="w-3 h-3 text-blue-400" />
                          <span>{language === 'zh' ? '飞书' : 'Feishu'}</span>
                          {alert.dispatched_channels.includes('feishu') && <Check className="w-3 h-3 text-emerald-400" />}
                        </button>
                        <button
                          onClick={() => handleDispatchAlert(alert.id, 'wecom')}
                          disabled={dispatchingChannel?.alertId === alert.id}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                            alert.dispatched_channels.includes('wecom')
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800'
                          }`}
                          title="Dispatch to WeCom"
                        >
                          <span>{language === 'zh' ? '企微' : 'WeCom'}</span>
                          {alert.dispatched_channels.includes('wecom') && <Check className="w-3 h-3 text-emerald-400" />}
                        </button>
                        <button
                          onClick={() => handleDispatchAlert(alert.id, 'dingtalk')}
                          disabled={dispatchingChannel?.alertId === alert.id}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                            alert.dispatched_channels.includes('dingtalk')
                              ? 'bg-amber-950 text-amber-300 border border-amber-700'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800'
                          }`}
                          title="Dispatch to DingTalk"
                        >
                          <span>{language === 'zh' ? '钉钉' : 'DingTalk'}</span>
                          {alert.dispatched_channels.includes('dingtalk') && <Check className="w-3 h-3 text-emerald-400" />}
                        </button>
                      </div>

                      <button
                        onClick={() => handleDismissAlert(alert.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs transition cursor-pointer"
                        title={t.alertDismissBtn}
                      >
                        {t.alertDismissBtn}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // Nominal Zero-Alert state
        return (
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <div className="p-1.5 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-medium">
                {language === 'zh'
                  ? '裸金属节点主动健康监控就绪: 全量 67 节点处于就绪/装机状态 (零活跃 Degraded / Failed 告警)'
                  : 'Proactive Health Watchdog Active: All 67 baremetal hosts nominal (0 active Degraded/Failed alerts)'}
              </span>
            </div>

            <button
              onClick={() => handleSimulateAlert('PROVISIONING_FAILED')}
              disabled={simulatingAlert}
              className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-amber-300 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
              title="Simulate a node failure alert to verify watchdog & auto-healing"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{simulatingAlert ? '...' : t.alertSimulateBtn}</span>
            </button>
          </div>
        );
      })()}

      {/* Main Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        {/* Tab 1: Node Dashboard */}
        <button
          onClick={() => setActiveSubTab('dashboard')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'dashboard'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>{t.tabNodeDashboard}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-200 text-[10px] font-mono">
            {hosts.length} Nodes
          </span>
        </button>

        {/* Tab: Dual-Agent Orchestration (Agent 1 Eph-Node & Agent 2 Target Cluster) */}
        <button
          onClick={() => setActiveSubTab('dualagent')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'dualagent'
              ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4 text-cyan-300" />
          <span>{t.tabMetal3DualAgent}</span>
          <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] font-mono font-bold">
            Eph ⇄ Target
          </span>
        </button>

        {/* Tab: Dual-Network & Multi-CNI Coexistence (Multus + Calico + OVS + SR-IOV) */}
        <button
          onClick={() => setActiveSubTab('multicni')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'multicni'
              ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-md shadow-cyan-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Network className="w-4 h-4 text-emerald-300" />
          <span>{t.tabMetal3MultiCNI}</span>
          <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-mono font-bold">
            4-CNI Mesh
          </span>
        </button>

        {/* Tab: Talos Omni-Style Rapid Deployment Wizard */}
        <button
          onClick={() => setActiveSubTab('omni')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'omni'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-orange-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>{t.tabMetal3Omni}</span>
          <span className="px-1.5 py-0.2 rounded bg-amber-950 border border-amber-800 text-amber-300 text-[10px] font-mono font-bold">
            120s Omni
          </span>
        </button>

        {/* Tab: Kubernetes Version Matrix & Node Upgrade Selector (v1.33 ~ v1.36) */}
        <button
          onClick={() => setActiveSubTab('versions')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'versions'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Boxes className="w-4 h-4 text-purple-300" />
          <span>{t.tabMetal3Versions || (language === 'zh' ? 'K8s 多版本编排矩阵' : 'K8s Version Matrix')}</span>
          <span className="px-1.5 py-0.2 rounded bg-purple-950 border border-purple-800 text-purple-300 text-[10px] font-mono font-bold">
            v1.33 ~ v1.36
          </span>
        </button>

        {/* Tab 3: Target Cluster Pipeline */}
        <button
          onClick={() => setActiveSubTab('cluster')}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'cluster'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>{language === 'zh' ? '目标集群流水线' : 'Target K8s Pipeline'}</span>
          {activeCluster && (
            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
              {activeCluster.scale?.total_nodes ?? ((activeCluster.control_plane_nodes || 3) + (activeCluster.worker_nodes || 7))} Nodes
            </span>
          )}
        </button>

        {/* Tab 4: BMH Fleet Specs */}
        <button
          onClick={() => setActiveSubTab('fleet')}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'fleet'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>{language === 'zh' ? 'BareMetalHost 资产台账' : 'BMH Asset Spec Table'}</span>
        </button>

        {/* Tab 5: Ephemeral Node Architecture */}
        <button
          onClick={() => setActiveSubTab('ephnode')}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'ephnode'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>{language === 'zh' ? '引导节点 (eph-node) 架构' : 'Eph-Node Architecture'}</span>
        </button>

        {/* Tab 2: Terminal & Multi-Stream Output */}
        <button
          onClick={() => setActiveSubTab('terminal')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'terminal'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>{t.tabTerminalLogs}</span>
          <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 text-[10px] font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Stream
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* --- TAB 1: DEDICATED NODE DASHBOARD VIEW (INDIVIDUAL NODE VISUALIZATION) --- */}
      {/* ========================================================================= */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Dashboard Summary KPI Header */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">
                {language === 'zh' ? '裸机节点总量' : 'Total BareMetal Fleet'}
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-white">{hosts.length}</span>
                <span className="text-xs text-slate-400">Nodes</span>
              </div>
              <div className="mt-1 text-[11px] text-indigo-400 flex items-center gap-1">
                <span>100% Redfish BMC Ready</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">{t.filterByPower}</span>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {hosts.filter(h => h.power_status === 'ON').length} ON
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  {hosts.filter(h => h.power_status === 'OFF').length} OFF
                </span>
                {hosts.some(h => h.power_status === 'REBOOTING' || h.power_status === 'PXE_BOOTING') && (
                  <span className="flex items-center gap-1 text-xs text-amber-400 font-mono">
                    <RotateCw className="w-3 h-3 animate-spin" />
                    {hosts.filter(h => h.power_status === 'REBOOTING' || h.power_status === 'PXE_BOOTING').length}
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Avg Power: 3,420W / Supernode</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">{t.filterByPhase}</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {hosts.filter(h => h.provisioning_status === 'ActiveInCluster').length}
                </span>
                <span className="text-xs text-slate-400">Joined</span>
                <span className="text-xs text-cyan-400 font-mono ml-2">
                  {hosts.filter(h => h.provisioning_status === 'Provisioning').length} Provisioning
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {hosts.filter(h => h.provisioning_status === 'Available').length} Available in Pool
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">
                {language === 'zh' ? 'GPU 拓扑与 RoCEv2' : 'GPU Fabric & RoCEv2'}
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-indigo-400">64</span>
                <span className="text-xs text-slate-400">x H100 80GB</span>
              </div>
              <div className="mt-1 text-[11px] text-emerald-400 truncate">
                8x 400Gbps CX-7 / node • MTU 9000
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">
                {language === 'zh' ? '平均热度与传感器' : 'Fleet Thermal & Health'}
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-slate-200">41.8°C</span>
                <span className="text-xs text-emerald-400 font-mono">Nominal</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">0 Critical Alarms • Fans 100% OK</div>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative min-w-[240px] flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={
                    language === 'zh'
                      ? '搜索节点名、BMC IP、业务 IP、MAC、机架...'
                      : 'Search node name, BMC IP, target IP, MAC, rack...'
                  }
                  value={dashboardSearchQuery}
                  onChange={e => setDashboardSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                {dashboardSearchQuery && (
                  <button
                    onClick={() => setDashboardSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Role filter */}
              <select
                value={dashboardRoleFilter}
                onChange={e => setDashboardRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">{language === 'zh' ? '全部角色' : 'All Roles'}</option>
                <option value="control-plane">Control Plane (3)</option>
                <option value="worker-gpu">Worker GPU Supernodes (8)</option>
                <option value="worker-compute">Worker Compute (4)</option>
              </select>

              {/* Power filter */}
              <select
                value={dashboardPowerFilter}
                onChange={e => setDashboardPowerFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">{language === 'zh' ? '全部电源状态' : 'All Power States'}</option>
                <option value="ON">Power ON</option>
                <option value="OFF">Power OFF</option>
                <option value="REBOOTING">Rebooting</option>
                <option value="PXE_BOOTING">PXE Booting</option>
              </select>

              {/* Phase filter */}
              <select
                value={dashboardPhaseFilter}
                onChange={e => setDashboardPhaseFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">{language === 'zh' ? '全部部署阶段' : 'All Phases'}</option>
                <option value="ActiveInCluster">ActiveInCluster</option>
                <option value="Provisioning">Provisioning</option>
                <option value="Inspecting">Inspecting</option>
                <option value="Available">Available</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1.5 border border-slate-800 rounded-lg p-1 bg-slate-950 shrink-0">
              <button
                onClick={() => setDashboardViewMode('grid')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                  dashboardViewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {language === 'zh' ? '矩阵网格卡片' : 'Grid Cards'}
              </button>
              <button
                onClick={() => setDashboardViewMode('table')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                  dashboardViewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {language === 'zh' ? '紧凑明细表' : 'Spec Table'}
              </button>
            </div>
          </div>

          {/* GRID CARDS VIEW */}
          {dashboardViewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDashboardHosts.map(host => {
                const isGpu = host.assigned_role === 'worker-gpu';
                const isMaster = host.assigned_role === 'control-plane';
                const isPowerOn = host.power_status === 'ON';
                const isDraining = drainingHostName === host.name;
                const hostAlert = alerts.find(a => a.host_name === host.name && a.status !== 'RESOLVED');
                const isDegradedOrFailed =
                  host.provisioning_status === 'Degraded' ||
                  host.provisioning_status === 'Provisioning Failed' ||
                  !!hostAlert;

                return (
                  <div
                    key={host.name}
                    className={`border rounded-xl p-4 transition-all hover:border-slate-700 flex flex-col justify-between ${
                      isDegradedOrFailed
                        ? 'border-rose-500/80 shadow-lg shadow-rose-950/40 bg-gradient-to-b from-rose-950/30 via-slate-900 to-slate-900'
                        : host.provisioning_status === 'Provisioning'
                          ? 'bg-slate-900 border-cyan-600/60 shadow-lg shadow-cyan-950/20'
                          : isPowerOn
                            ? 'bg-slate-900 border-slate-800 hover:shadow-md hover:shadow-indigo-950/20'
                            : 'bg-slate-900 border-slate-800/60 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Host Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-white tracking-tight">{host.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {host.rack_location}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800 flex items-center gap-1">
                              <Boxes className="w-2.5 h-2.5" />
                              {host.k8s_version || 'v1.31.2'}
                            </span>
                            {host.upgrade_status && host.upgrade_status !== 'IDLE' && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                                {host.upgrade_status}
                              </span>
                            )}
                            {isDegradedOrFailed && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-600 text-white animate-pulse">
                                ALERT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">{host.hardware.model}</div>
                        </div>

                        {/* Power Indicator */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold flex items-center gap-1.5 border ${
                              host.power_status === 'ON'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                : host.power_status === 'OFF'
                                  ? 'bg-slate-950 text-slate-400 border-slate-800'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                host.power_status === 'ON'
                                  ? 'bg-emerald-400 animate-pulse'
                                  : host.power_status === 'OFF'
                                    ? 'bg-slate-600'
                                    : 'bg-amber-400 animate-spin'
                              }`}
                            />
                            {host.power_status}
                          </span>

                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${
                              isMaster
                                ? 'bg-purple-950 text-purple-300 border-purple-800'
                                : isGpu
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                  : 'bg-blue-950 text-blue-300 border-blue-800'
                            }`}
                          >
                            {host.assigned_role}
                          </span>
                        </div>
                      </div>

                      {/* Provisioning Phase Badge & Progress Bar */}
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 mb-3">
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="text-slate-400 font-medium">
                            {language === 'zh' ? 'Ironic 编排阶段:' : 'Provisioning Phase:'}
                          </span>
                          <span
                            className={`font-mono font-semibold ${
                              isDegradedOrFailed
                                ? 'text-rose-400 font-bold'
                                : host.provisioning_status === 'ActiveInCluster'
                                  ? 'text-emerald-400'
                                  : host.provisioning_status === 'Provisioning'
                                    ? 'text-cyan-400'
                                    : host.provisioning_status === 'Inspecting'
                                      ? 'text-amber-400'
                                      : 'text-slate-300'
                            }`}
                          >
                            {host.provisioning_status}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isDegradedOrFailed
                                ? 'bg-rose-500'
                                : host.provisioning_status === 'ActiveInCluster'
                                  ? 'bg-emerald-500'
                                  : host.provisioning_status === 'Provisioning'
                                    ? 'bg-cyan-500 animate-pulse'
                                    : host.provisioning_status === 'Inspecting'
                                      ? 'bg-amber-500'
                                      : 'bg-slate-600'
                            }`}
                            style={{ width: `${host.provisioning_progress_percent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                          <span>Image: {(host.boot_image ? host.boot_image.replace(/\.iso$/, '') : 'talos-v1.8')}</span>
                          <span>{host.provisioning_progress_percent}%</span>
                        </div>
                      </div>

                      {/* IP Addresses Matrix */}
                      <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 mb-3 space-y-1.5 text-[11px] font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Radio className="w-3 h-3 text-indigo-400" />
                            {language === 'zh' ? 'BMC 带外 IP:' : 'BMC OOB IP:'}
                          </span>
                          <span className="text-slate-200 font-semibold">{host.ip_addresses?.bmc_ip || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Network className="w-3 h-3 text-cyan-400" />
                            {language === 'zh' ? 'PXE 引导 IP:' : 'PXE Prov IP:'}
                          </span>
                          <span className="text-slate-200">{host.ip_addresses?.provisioning_ip || 'DHCP'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Boxes className="w-3 h-3 text-emerald-400" />
                            {language === 'zh' ? 'K8s 业务 IP:' : 'Target K8s IP:'}
                          </span>
                          <span className="text-emerald-400 font-semibold">
                            {host.ip_addresses?.target_ip || 'Unassigned'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                          <span className="text-slate-500">MAC: {host.boot_mac_address}</span>
                          <span className="text-slate-400 font-sans">{host.bmc_protocol}</span>
                        </div>
                      </div>

                      {/* Hardware Spec Chips */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
                        <div className="bg-slate-950/60 border border-slate-800/80 rounded p-1.5">
                          <span className="text-slate-400 block mb-0.5">CPU & Memory</span>
                          <span className="text-white font-mono font-medium block truncate">
                            {host.hardware.cores}C • {host.hardware.ram_gb}GB
                          </span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-800/80 rounded p-1.5">
                          <span className="text-slate-400 block mb-0.5">Accelerators</span>
                          <span className="text-emerald-400 font-mono font-medium block truncate">
                            {isGpu ? '8x H100 SXM5' : 'None (CPU Node)'}
                          </span>
                        </div>
                      </div>

                      {/* Live Sensors Summary */}
                      {host.sensors && (
                        <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-slate-950 border border-slate-800 mb-3">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Flame className="w-3 h-3 text-amber-400" />
                            {host.sensors.cpu_temp_c}°C
                          </span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Activity className="w-3 h-3 text-cyan-400" />
                            {host.sensors.fan_speed_rpm.toLocaleString()} RPM
                          </span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-yellow-400" />
                            {host.sensors.power_watts} W
                          </span>
                        </div>
                      )}

                      {/* Active Alert Notification on Card */}
                      {hostAlert && (
                        <div className="p-2.5 rounded-lg bg-rose-950/90 border border-rose-800 mb-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-rose-300 flex items-center gap-1">
                              <BellRing className="w-3 h-3 text-rose-400 animate-pulse" />
                              {hostAlert.severity}: {hostAlert.error_code}
                            </span>
                            <button
                              onClick={() => handleRemediateAlert(hostAlert.id)}
                              disabled={remediatingAlertId === hostAlert.id}
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer"
                            >
                              <Wrench className={`w-2.5 h-2.5 ${remediatingAlertId === hostAlert.id ? 'animate-spin' : ''}`} />
                              <span>{remediatingAlertId === hostAlert.id ? '...' : (language === 'zh' ? 'AI 自愈' : 'Auto-Heal')}</span>
                            </button>
                          </div>
                          <div className="text-[10px] text-rose-200/90 leading-tight line-clamp-2">
                            {language === 'zh' ? hostAlert.message : hostAlert.message_en}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Power Actions & SOL Inspector */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        {isPowerOn ? (
                          <button
                            onClick={() => handlePowerAction(host.name, 'off')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 text-slate-300 text-[11px] font-medium transition cursor-pointer border border-slate-700 hover:border-rose-700"
                            title="Power OFF via Redfish"
                          >
                            {t.btnPowerOff}
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePowerAction(host.name, 'on')}
                            className="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-[11px] font-medium transition cursor-pointer border border-emerald-800"
                            title="Power ON via Redfish"
                          >
                            {t.btnPowerOn}
                          </button>
                        )}

                        <button
                          onClick={() => handlePowerAction(host.name, 'reboot')}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer border border-slate-700"
                          title="Warm Reboot"
                        >
                          {t.btnReboot}
                        </button>

                        <button
                          onClick={() => handleInspectHost(host.name)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer border border-slate-700"
                          title="Trigger Ironic Inspector"
                        >
                          {t.btnInspect}
                        </button>

                        {/* Drain / Scale-down single node button if node is in cluster */}
                        {host.provisioning_status === 'ActiveInCluster' && !isMaster && (
                          <button
                            onClick={() => handleDrainNode(host.name)}
                            disabled={isDraining}
                            className="px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                            title="AI Agent Safe Cordon & Drain (Scale-Down)"
                          >
                            {isDraining ? <RotateCw className="w-3 h-3 animate-spin" /> : <ArrowDownCircle className="w-3 h-3" />}
                            <span>{t.btnDrain}</span>
                          </button>
                        )}

                        {/* Apply Version quick button */}
                        <button
                          onClick={() => handleApplyVersionToSingleNode(host.name)}
                          disabled={isApplyingVersion}
                          className="px-2 py-1 rounded bg-purple-950/70 hover:bg-purple-900/80 text-purple-300 border border-purple-800 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                          title={`Apply Kubernetes ${selectedTargetVersion} to ${host.name}`}
                        >
                          <Boxes className="w-3 h-3 text-purple-400" />
                          <span>{t.btnApplyToNode || (language === 'zh' ? '应用版本' : 'Apply')}</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setSelectedHost(host)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-700/60 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        title={language === 'zh' ? '查看节点详细配置、带外传感器与串口控制台 (SOL)' : 'View Host Details, Sensors & SOL Serial Console'}
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{t.btnSol}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE SPEC VIEW */}
          {dashboardViewMode === 'table' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold font-mono">
                    <tr>
                      <th className="py-3 px-4">HOST & RACK</th>
                      <th className="py-3 px-3">K8S VER</th>
                      <th className="py-3 px-3">POWER</th>
                      <th className="py-3 px-3">PHASE</th>
                      <th className="py-3 px-3">BMC OOB IP</th>
                      <th className="py-3 px-3">PROV IP</th>
                      <th className="py-3 px-3">TARGET K8S IP</th>
                      <th className="py-3 px-3">CPU / RAM</th>
                      <th className="py-3 px-3">ACCELERATOR</th>
                      <th className="py-3 px-3">SENSORS</th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono">
                    {filteredDashboardHosts.map(host => {
                      const isPowerOn = host.power_status === 'ON';
                      const isMaster = host.assigned_role === 'control-plane';
                      return (
                        <tr key={host.name} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{host.name}</div>
                            <div className="text-[10px] text-slate-400 font-sans">
                              {host.rack_location} • {(host.hardware?.model ? host.hardware.model.split(' ')[0] : 'Dell-R760xa')}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                              {host.k8s_version || 'v1.31.2'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isPowerOn ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {host.power_status}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                host.provisioning_status === 'ActiveInCluster'
                                  ? 'bg-indigo-950 text-indigo-300'
                                  : host.provisioning_status === 'Provisioning'
                                    ? 'bg-cyan-950 text-cyan-300'
                                    : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {host.provisioning_status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">{host.ip_addresses?.bmc_ip || 'N/A'}</td>
                          <td className="py-3 px-3 text-slate-400">{host.ip_addresses?.provisioning_ip || 'N/A'}</td>
                          <td className="py-3 px-3 text-emerald-400 font-semibold">
                            {host.ip_addresses?.target_ip || 'Unassigned'}
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {host.hardware.cores}C / {host.hardware.ram_gb}G
                          </td>
                          <td className="py-3 px-3 text-indigo-300">
                            {host.assigned_role === 'worker-gpu' ? '8x H100 SXM5' : 'None'}
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {host.sensors ? `${host.sensors.cpu_temp_c}°C / ${host.sensors.power_watts}W` : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            <button
                              onClick={() => handleApplyVersionToSingleNode(host.name)}
                              disabled={isApplyingVersion}
                              className="px-2 py-1 rounded bg-purple-950/80 hover:bg-purple-900 text-purple-300 text-[11px] font-sans transition cursor-pointer"
                              title={`Apply Kubernetes ${selectedTargetVersion} to ${host.name}`}
                            >
                              {language === 'zh' ? '应用版本' : 'Apply'}
                            </button>
                            {host.provisioning_status === 'ActiveInCluster' && !isMaster && (
                              <button
                                onClick={() => handleDrainNode(host.name)}
                                className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 text-[11px] font-sans transition cursor-pointer"
                                title="Drain & Scale Down"
                              >
                                {language === 'zh' ? '安全缩容' : 'Drain'}
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedHost(host)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition cursor-pointer inline-flex items-center gap-1"
                              title={language === 'zh' ? '查看节点详情与控制台' : 'View Host Details & Console'}
                            >
                              <Eye className="w-3 h-3 text-indigo-400" />
                              <span>{t.btnSol}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- TAB 2: TEXT TERMINAL & MULTI-STREAM OUTPUT (ALL 3 LOG STREAMS) --- */}
      {/* ========================================================================= */}
      {activeSubTab === 'terminal' && (
        <div className="space-y-6">
          {/* Remote AI Agent Live Status Card */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white font-mono">
                      {agentTelemetry?.name || 'eph-node-metal3-orchestrator'}
                    </span>
                    <span className="ml-2 text-xs text-indigo-300 font-mono">v2.4.0</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950 border border-emerald-700 text-emerald-300 flex items-center gap-1.5 ml-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    AUTONOMOUS ORCHESTRATING
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-4">
                  <span>
                    mTLS State:{' '}
                    <span className="text-slate-200 font-mono">
                      {agentTelemetry?.mtls_state || 'TLS_AES_256_GCM_SHA384_VERIFIED'}
                    </span>
                  </span>
                  <span>
                    Last Heartbeat:{' '}
                    <span className="text-emerald-400 font-mono">
                      {agentTelemetry?.last_heartbeat ? new Date(agentTelemetry.last_heartbeat).toLocaleTimeString() : 'Just now'}
                    </span>
                  </span>
                  <span>
                    Target Cluster:{' '}
                    <span className="text-cyan-400 font-mono">{activeCluster?.name || 'ai-superpod-h100-prod'}</span>
                  </span>
                </div>
              </div>

              {/* Agent Resource Metrics */}
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] text-slate-500 block uppercase">CPU Load</span>
                  <span className="text-sm font-bold text-slate-200">
                    {agentTelemetry?.cpu_usage_percent || 14.8}%
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] text-slate-500 block uppercase">RAM Usage</span>
                  <span className="text-sm font-bold text-slate-200">
                    {((agentTelemetry?.memory_used_mb || 6540) / 1024).toFixed(1)} GB / 128 GB
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] text-slate-500 block uppercase">Autonomous Actions</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {agentTelemetry?.autonomous_decisions_count || 59}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Reconciliations Ticker */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-400 font-medium">
                {language === 'zh' ? '智能体活动监视环:' : 'Active Reconcilers:'}
              </span>
              {(agentTelemetry?.active_reconciliations || [
                'Watch BareMetalHost CRDs (67 items)',
                'Ironic Conductor Power Watchdog',
                'Calico BGP + Multus + OVS-DPDK + SR-IOV Mesh Verification',
                'NVIDIA FabricManager SXM5 Health Probes',
                'K8s In-Place Rolling Upgrade & Elastic Autoscaler Daemon',
              ]).map((rec, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-slate-300 font-mono text-[10px] flex items-center gap-1"
                >
                  <span className="w-1 h-1 rounded-full bg-indigo-400" />
                  {rec}
                </span>
              ))}
            </div>
          </div>

          {/* 3 Stream Selector Tabs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              {/* Stream Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveStream('agent')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                    activeStream === 'agent'
                      ? 'bg-emerald-600 text-white shadow shadow-emerald-600/30'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{t.streamAgent}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
                    {logs.filter(l => l.stream === 'agent').length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveStream('k8s-install')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                    activeStream === 'k8s-install'
                      ? 'bg-cyan-600 text-white shadow shadow-cyan-600/30'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>{t.streamK8s}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
                    {logs.filter(l => l.stream === 'k8s-install').length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveStream('ironic-redirect')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                    activeStream === 'ironic-redirect'
                      ? 'bg-indigo-600 text-white shadow shadow-indigo-600/30'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{t.streamIronic}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
                    {logs.filter(l => l.stream === 'ironic-redirect').length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveStream('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                    activeStream === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span>{t.streamAll}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">{logs.length}</span>
                </button>
              </div>

              {/* Terminal Controls: Live streaming toggle, level filter, clear, copy, export */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Streaming Toggle */}
                <button
                  onClick={() => setIsLiveStreaming(!isLiveStreaming)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                    isLiveStreaming
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {isLiveStreaming ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>LIVE</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3 text-slate-400" />
                      <span>PAUSED</span>
                    </>
                  )}
                </button>

                {/* Log Level Filter */}
                <select
                  value={logLevelFilter}
                  onChange={e => setLogLevelFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="all">Level: ALL</option>
                  <option value="info">INFO</option>
                  <option value="success">SUCCESS</option>
                  <option value="warn">WARN</option>
                  <option value="error">ERROR</option>
                </select>

                {/* Auto Scroll Checkbox */}
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={e => setAutoScroll(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Auto-scroll</span>
                </label>

                {/* Copy Button */}
                <button
                  onClick={handleCopyTerminal}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs flex items-center gap-1 transition cursor-pointer"
                  title="Copy terminal contents"
                >
                  {copiedConsole ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {/* Export Button */}
                <button
                  onClick={handleExportLog}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs flex items-center gap-1 transition cursor-pointer"
                  title="Download .log file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Search within logs */}
            <div className="pt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={language === 'zh' ? '在终端输出中搜索过滤 (grep)...' : 'Filter terminal output (grep)...'}
                  value={terminalSearch}
                  onChange={e => setTerminalSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                {terminalSearch && (
                  <button
                    onClick={() => setTerminalSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <span className="text-xs text-slate-500 font-mono shrink-0">
                {filteredTerminalLogs.length} / {logs.length} entries
              </span>
            </div>

            {/* High-Fidelity Text Console Screen */}
            <div className="mt-3 bg-[#080c14] border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
              {/* Terminal Window Header Bar */}
              <div className="bg-[#0f1422] px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-slate-400 ml-2">
                    eph-node:~$ tail -f /var/log/metal3/{activeStream}.log
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span>UTF-8</span>
                  <span>•</span>
                  <span>ANSI Console</span>
                </div>
              </div>

              {/* Terminal Scroll Area */}
              <div className="p-4 font-mono text-[11px] leading-relaxed max-h-[480px] min-h-[340px] overflow-y-auto space-y-1 text-slate-300">
                {filteredTerminalLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <div>No log entries match the selected filters.</div>
                    <div className="text-[10px] mt-1">Try selecting stream 'ALL' or clearing the search query.</div>
                  </div>
                ) : (
                  filteredTerminalLogs.map((l, idx) => {
                    const isError = l.level === 'error';
                    const isWarn = l.level === 'warn';
                    const isSuccess = l.level === 'success';

                    return (
                      <div
                        key={l.id || idx}
                        className={`flex items-start gap-2.5 hover:bg-white/[0.03] px-1.5 py-0.5 rounded transition ${
                          isError ? 'text-rose-400 bg-rose-950/20' : isWarn ? 'text-amber-300' : ''
                        }`}
                      >
                        {/* Line number */}
                        <span className="text-slate-600 select-none w-8 text-right shrink-0">
                          {filteredTerminalLogs.length - idx}
                        </span>

                        {/* Timestamp */}
                        <span className="text-slate-500 shrink-0 select-none">
                          {new Date(l.timestamp).toLocaleTimeString()}
                        </span>

                        {/* Stream Badge */}
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 select-none ${
                            l.stream === 'agent'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : l.stream === 'k8s-install'
                                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                                : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                          }`}
                        >
                          [{l.stream.toUpperCase()}]
                        </span>

                        {/* Source Tag */}
                        <span className="text-indigo-400/90 font-semibold shrink-0">[{l.source}]</span>

                        {/* Target Host if any */}
                        {l.target_host && (
                          <span className="text-purple-300 bg-purple-950/40 px-1 rounded text-[10px] shrink-0">
                            @{l.target_host}
                          </span>
                        )}

                        {/* Raw Output / Message */}
                        <span className="break-all flex-1">
                          {isSuccess && <span className="text-emerald-400 mr-1.5">✓</span>}
                          {isError && <span className="text-rose-400 mr-1.5">✗</span>}
                          {isWarn && <span className="text-amber-400 mr-1.5">▲</span>}
                          {l.raw_output || l.message}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={terminalBottomRef} />
              </div>

              {/* Interactive Terminal Command Prompt Line */}
              <div className="bg-[#0b101c] px-4 py-2.5 border-t border-slate-800">
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleDispatchCommand();
                  }}
                  className="flex items-center gap-2"
                >
                  <span className="text-emerald-400 font-mono font-bold text-xs shrink-0 select-none">
                    eph-node:~$
                  </span>
                  <input
                    type="text"
                    placeholder={
                      language === 'zh'
                        ? '输入命令发送至远端 eph-node 运行 (例如: kubeadm token list, ironic node-list, calicoctl node status)...'
                        : 'Type command to run on remote eph-node (e.g. kubeadm token list, ironic node-list, calicoctl node status)...'
                    }
                    value={terminalCommand}
                    onChange={e => setTerminalCommand(e.target.value)}
                    className="flex-1 bg-transparent border-none text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
                  />
                  <button
                    type="submit"
                    disabled={executingCmd || !terminalCommand.trim()}
                    className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {executingCmd ? <RotateCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    <span>{language === 'zh' ? '发送执行' : 'Execute'}</span>
                  </button>
                </form>

                {/* Command Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 font-mono">
                  <span className="text-slate-500">{language === 'zh' ? '快捷指令:' : 'Quick Presets:'}</span>
                  <button
                    type="button"
                    onClick={() => handleDispatchCommand('kubeadm token list && kubectl get nodes -o wide')}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                  >
                    kubeadm token list
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDispatchCommand('ironic node-list --fields name,power_state,provision_state')}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                  >
                    ironic node-list
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDispatchCommand('calicoctl node status && ovs-vsctl show && dpdk-devbind.py --status')}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                  >
                    multi-cni status
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDispatchCommand('nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv')}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                  >
                    nvidia-smi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDispatchCommand(t.commandInspectPreset)}
                    className="px-2 py-0.5 rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 cursor-pointer font-sans"
                  >
                    {t.aiAutoInspect}
                  </button>
                </div>
              </div>
            </div>

            {/* Command Feedback Dialog if any */}
            {commandFeedback && (
              <div className="mt-4 bg-emerald-950/40 border border-emerald-800 rounded-lg p-3 text-xs">
                <div className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    {language === 'zh' ? '远端智能体决策与执行完毕' : 'Remote Agent Decision Completed'}:
                  </span>
                </div>
                <div className="text-slate-300 mb-2 font-mono">{commandFeedback.decision}</div>
                <div className="space-y-1">
                  {commandFeedback.actions_taken?.map((act: string, idx: number) => (
                    <div key={idx} className="text-slate-400 text-[11px] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- SUBTAB 3: TARGET CLUSTER PIPELINE & ELASTIC SCALE / UPGRADE --- */}
      {/* ========================================================================= */}
      {activeSubTab === 'cluster' && (
        <div className="space-y-6">
          {activeCluster ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-bold text-white font-mono">{activeCluster.name}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-mono">
                      Kubernetes {activeCluster.k8s_version}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-950 border border-cyan-700/60 text-cyan-300">
                      {activeCluster.cni}
                    </span>
                    {activeCluster.status === 'SCALING_UP' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700 animate-pulse">
                        SCALING UP (+{scaleTargetWorkers})
                      </span>
                    )}
                    {activeCluster.status === 'SCALING_DOWN' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-950 text-amber-300 border border-amber-700 animate-pulse">
                        SCALING DOWN
                      </span>
                    )}
                    {activeCluster.status === 'UPGRADING_VERSION' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-950 text-purple-300 border border-purple-700 animate-pulse">
                        UPGRADING TO {activeCluster.k8s_version}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    API Endpoint:{' '}
                    <span className="text-slate-200 font-mono font-medium">{activeCluster.api_endpoint}</span> |{' '}
                    {language === 'zh' ? '由 eph-node 智能体自动拉起并管控' : 'Orchestrated via Eph-Node Agent'}
                  </p>
                </div>

                {/* Operations Bar: Elastic Scaling, Rolling Upgrade, CAPI Pivot */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setShowScaleModal(true)}
                    className="px-3.5 py-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-700/60 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Scale Up or Down baremetal nodes"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>{t.btnScaleCluster}</span>
                  </button>

                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="px-3.5 py-2 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-700/60 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="In-place rolling upgrade of Kubernetes version"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{t.btnUpgradeCluster}</span>
                  </button>

                  <button
                    onClick={() => handleTriggerPivot(activeCluster.id)}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>{t.btnTriggerPivot}</span>
                  </button>
                </div>
              </div>

              {/* Progress and Current Stage */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-xs font-semibold text-slate-200">{activeCluster.current_stage}</span>
                  </div>
                  <span className="text-sm font-bold font-mono text-cyan-400">{activeCluster.progress_percent}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-700"
                    style={{ width: `${activeCluster.progress_percent}%` }}
                  />
                </div>
              </div>

              {/* Pipeline Stages Stepper */}
              <div className="mt-8 space-y-3">
                <div className="text-xs font-semibold text-slate-300">
                  {language === 'zh' ? '大规模交付流水线推进细节' : 'Pipeline Execution Stages'}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {activeCluster.stages.map((stage, idx) => {
                    const isCompleted = stage.status === 'COMPLETED';
                    const isRunning = stage.status === 'RUNNING';

                    return (
                      <div
                        key={stage.id}
                        className={`p-3.5 rounded-lg border flex flex-col justify-between ${
                          isCompleted
                            ? 'bg-emerald-950/20 border-emerald-800/60 text-slate-300'
                            : isRunning
                              ? 'bg-cyan-950/30 border-cyan-700/80 text-white shadow-md shadow-cyan-950/40'
                              : 'bg-slate-950/60 border-slate-800 text-slate-500'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40">
                              STEP {idx + 1}
                            </span>
                            {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                            {isRunning && <RotateCw className="w-4 h-4 text-cyan-400 animate-spin" />}
                          </div>
                          <div className="text-xs font-bold leading-snug">{stage.name}</div>
                          <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{stage.description}</div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] font-mono uppercase">
                          Status: {stage.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
              <Boxes className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <div className="text-sm font-semibold text-slate-300">{t.noRunningPipeline}</div>
              <p className="text-xs text-slate-500 mt-1">
                {t.noRunningPipelineDesc}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- SUBTAB 4: BMH FLEET SPECS --- */}
      {/* ========================================================================= */}
      {activeSubTab === 'fleet' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">{t.bmhFleetTitle}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t.bmhFleetDesc}
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold font-mono">
                  <tr>
                    <th className="py-3 px-4">HOST NAME & RACK</th>
                    <th className="py-3 px-3">BMC REDFISH ENDPOINT</th>
                    <th className="py-3 px-3">BOOT MAC</th>
                    <th className="py-3 px-3">POWER</th>
                    <th className="py-3 px-3">PROVISION STATUS</th>
                    <th className="py-3 px-3">HARDWARE SPECS</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {hosts.map(host => (
                    <tr key={host.name} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{host.name}</div>
                        <div className="text-[10px] text-slate-400 font-sans">{host.rack_location}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="text-slate-300 truncate max-w-xs">{host.bmc_address}</div>
                        <span className="text-[10px] text-indigo-400 font-sans">{host.bmc_protocol}</span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-300">{host.boot_mac_address}</td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            host.power_status === 'ON'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {host.power_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-200">
                          {host.provisioning_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="text-slate-300">
                          {host.hardware.cores} Cores • {host.hardware.ram_gb} GB
                        </div>
                        <div className="text-[10px] text-emerald-400 font-sans">{host.hardware.gpus}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedHost(host)}
                          className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[11px] font-sans transition cursor-pointer"
                        >
                          {language === 'zh' ? '控制台/传感器' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- SUBTAB 5: EPHEMERAL NODE ARCHITECTURE --- */}
      {/* ========================================================================= */}
      {activeSubTab === 'ephnode' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="pb-6 border-b border-slate-800">
              <h2 className="text-base font-bold text-white tracking-tight">{t.ephNodeTitle}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{t.ephNodeDesc}</p>
            </div>

            {/* Eph-Node Specs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span>{t.hardwareSpecs}</span>
                </div>
                <div className="space-y-1.5 text-xs font-mono text-slate-400">
                  <div>CPU: {ephNode?.host_specs?.cpu}</div>
                  <div>RAM: {ephNode?.host_specs?.memory_gb} GB ECC DDR4</div>
                  <div>Storage: {ephNode?.host_specs?.storage}</div>
                  <div>OS: {ephNode?.host_specs?.os}</div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2">
                  <Network className="w-4 h-4 text-cyan-400" />
                  <span>{t.networkIsolation}</span>
                </div>
                <div className="space-y-1.5 text-xs font-mono text-slate-400">
                  <div>PXE: {ephNode?.networks?.pxe_provisioning_cidr}</div>
                  <div>BMC OOB: {ephNode?.networks?.bmc_oob_cidr}</div>
                  <div>Uplink: {ephNode?.networks?.control_plane_uplink}</div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{t.aiAgentCapabilities}</span>
                </div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  {t.aiAgentCapabilitiesDesc}
                </div>
              </div>
            </div>

            {/* Components Table */}
            <div className="mt-6">
              <div className="text-xs font-semibold text-slate-300 mb-3">
                {t.coreControllersList}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ephNode?.components?.map((c, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">{c.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                          {c.version}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{c.details}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- SUBTAB: DUAL-AGENT ORCHESTRATION HUB (EPH-NODE & TARGET CLUSTER) --- */}
      {/* ========================================================================= */}
      {activeSubTab === 'dualagent' && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-indigo-950/40 border border-cyan-800/60 rounded-2xl p-6 relative overflow-hidden shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded bg-cyan-950 border border-cyan-600 text-cyan-300 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    METAL3 DUAL-AGENT CONTROLLER ACTIVE
                  </span>
                  <span className="text-slate-500 text-xs">|</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700 text-indigo-300 text-[10px] font-mono">
                    Phase: {dualAgent?.current_phase || 'CLUSTER_HEALTHY'}
                  </span>
                  <span className="text-slate-500 text-xs">|</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-mono font-bold">
                    Pivot: {dualAgent?.pivot_status || 'SELF_HOSTED'}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">{t.dualAgentTitle}</h2>
                <p className="text-xs text-slate-300 max-w-3xl mt-1 leading-relaxed">{t.dualAgentSubtitle}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={() => handleTriggerDualRun()}
                  disabled={triggeringDualRun}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition cursor-pointer"
                >
                  <Play className={`w-3.5 h-3.5 ${triggeringDualRun ? 'animate-spin' : ''}`} />
                  <span>{triggeringDualRun ? '...' : t.btnTriggerDualRun}</span>
                </button>
                <button
                  onClick={handleSyncHeartbeats}
                  disabled={syncingHeartbeats}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingHeartbeats ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>{t.btnSyncHeartbeats}</span>
                </button>
                <button
                  onClick={handlePivotHandover}
                  disabled={pivotingHandover}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${pivotingHandover ? 'animate-spin' : ''}`} />
                  <span>{pivotingHandover ? '...' : t.btnPivotHandover}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Side-by-Side Dual Agent Topology Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Agent 1: Eph-Node Bootstrap Agent */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white font-mono">
                        {dualAgent?.bootstrap_agent?.name || 'Eph-Node Bootstrap Controller Agent'}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 text-[10px] font-mono">
                        Agent 1 (Bootstrap)
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {dualAgent?.bootstrap_agent?.location || 'eph-bootstrap-node-01 (Minikube / Kind)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-emerald-400">ACTIVE</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">
                    {language === 'zh' ? 'Ironic 装机引擎状态' : 'Ironic Conductor Engine'}
                  </span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {dualAgent?.bootstrap_agent?.metrics?.ironic_state || 'HEALTHY (Port 6385)'}
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">
                    {language === 'zh' ? 'Dnsmasq TFTP 租约' : 'PXE DHCP Leases'}
                  </span>
                  <span className="text-cyan-300 font-bold">
                    {dualAgent?.bootstrap_agent?.metrics?.dhcp_leases_active ?? 15} Hosts Assigned
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-2">
                  {language === 'zh' ? '正在执行的自主装机任务:' : 'Active Autonomous Provisioning Tasks:'}
                </span>
                <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                  {(dualAgent?.bootstrap_agent?.active_tasks || [
                    'Ironic Conductor Watchdog',
                    'Dnsmasq TFTP Lease Monitor',
                    'BareMetalHost Inventory Inspection',
                    'Target CP01 VirtualMedia Staging',
                  ]).map((task: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                      <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{task}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Pod: {dualAgent?.bootstrap_agent?.pod_name || 'metal3-eph-agent-daemon-7b89f4'}</span>
                <span>Namespace: {dualAgent?.bootstrap_agent?.namespace || 'metal3-system'}</span>
              </div>
            </div>

            {/* Agent 2: Target Cluster Lifecycle Agent */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white font-mono">
                        {dualAgent?.target_agent?.name || 'Target Cluster Lifecycle & Convergence Agent'}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-700 text-indigo-300 text-[10px] font-mono">
                        Agent 2 (Target)
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {dualAgent?.target_agent?.location || 'cluster-prod-gpu-k8s (Target Production K8s)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-emerald-400">ACTIVE</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">
                    {language === 'zh' ? 'CAPI 节点健康托管' : 'CAPI Machines Healthy'}
                  </span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {dualAgent?.target_agent?.metrics?.capi_machines_healthy ?? 10} / 10 Nodes Ready
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">
                    {language === 'zh' ? 'etcd 3 节点法定仲裁' : 'etcd Quorum Status'}
                  </span>
                  <span className="text-cyan-300 font-bold">
                    {dualAgent?.target_agent?.metrics?.etcd_quorum_status || 'HEALTHY_3_MEMBERS'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-2">
                  {language === 'zh' ? '目标集群生命周期管控与自愈:' : 'Target Cluster Lifecycle & Self-Healing:'}
                </span>
                <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                  {(dualAgent?.target_agent?.active_tasks || [
                    'CAPI MachinePool Reconciler',
                    'Pivot CRD Custodian',
                    'Multus/OVS/Calico/SRIOV Mesh Orchestrator',
                    'Worker Auto-Join Barrier',
                  ]).map((task: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{task}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Pod: {dualAgent?.target_agent?.pod_name || 'capm3-target-agent-operator-9c41a2'}</span>
                <span>Namespace: {dualAgent?.target_agent?.namespace || 'capi-system'}</span>
              </div>
            </div>
          </div>

          {/* Dual-Agent Pipeline Stepper */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>
                {language === 'zh'
                  ? '双 Agent 协同自举与 Pivot 移交全流程状态流水线'
                  : 'Dual-Agent Coordination & Pivot Handover Pipeline'}
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2">
              {[
                { id: 'EPH_BOOTSTRAP', name: '1. Eph-Node Boot', zh: '1. Eph-Node 引导', agent: 'Agent 1' },
                { id: 'BMH_INSPECTION', name: '2. BMH Inspect', zh: '2. 带外巡检', agent: 'Agent 1' },
                { id: 'TARGET_CP_PROVISION', name: '3. VirtualMedia CP', zh: '3. Master01 镜像', agent: 'Agent 1' },
                { id: 'K8S_INITIALIZATION', name: '4. Target K8s Init', zh: '4. 目标控制面', agent: 'Agent 2' },
                { id: 'PIVOT_TRANSFER', name: '5. Pivot Handover', zh: '5. Pivot 移交', agent: 'Dual' },
                { id: 'MULTI_CNI_CONVERGE', name: '6. Multi-CNI Mesh', zh: '6. 多 CNI 点火', agent: 'Agent 2' },
                { id: 'CLUSTER_HEALTHY', name: '7. Fleet Ready', zh: '7. 全机群就绪', agent: 'Self-Hosted' },
              ].map((step, idx) => {
                const isCurrent = dualAgent?.current_phase === step.id;
                return (
                  <div
                    key={idx}
                    onClick={() => handleTriggerDualRun(step.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-cyan-950/60 border-cyan-500 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                        <span>{step.agent}</span>
                        {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                      </div>
                      <div className="text-xs font-bold text-white">
                        {language === 'zh' ? step.zh : step.name}
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] text-cyan-300 font-mono flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>{language === 'zh' ? '点击推进' : 'Advance'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unified Forensic Event Stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>
                {language === 'zh'
                  ? '双 Agent 协同审计事件与状态机日志流'
                  : 'Dual-Agent Coordinated Event Audit Log Stream'}
              </span>
            </h3>

            <div className="space-y-2">
              {(dualAgent?.events || []).map((evt: any) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs font-mono"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.source === 'EPH_AGENT'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          : evt.source === 'TARGET_AGENT'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {evt.source}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[10px]">
                      {evt.phase}
                    </span>
                    <span className="text-slate-200">
                      {language === 'zh' && evt.message_zh ? evt.message_zh : evt.message}
                    </span>
                  </div>

                  <span className="text-slate-500 text-[11px] shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pod-Resident Pure Go Dual-Agent Workbench & Runtime Code */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    100% PURE GOLANG 1.22+ POD DAEMONS
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 text-[10px] font-mono">
                    Dual Kubernetes Pod Daemons
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700 text-indigo-300 text-[10px] font-mono">
                    Zero Node/Python in Pods
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  <span>{t.podWorkbenchTitle}</span>
                </h3>
                <p className="text-xs text-slate-300 max-w-3xl mt-1 leading-relaxed">
                  {t.podWorkbenchSubtitle}
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  Coordinator: <strong className="text-cyan-400">http://10.240.10.1:9090</strong>
                </span>
              </div>
            </div>

            {/* Live Pod Status & Real-Time Go Telemetry */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pod 1: Eph-Node Bootstrap Daemon */}
              <div className="bg-slate-950 border border-cyan-900/60 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">
                          Agent 1: Eph-Node Bootstrap Daemon
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 text-[10px] font-mono">
                          Go 1.22
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Pod: {podDaemons?.agent_1_eph_node?.pod_name || 'metal3-eph-agent-daemon-7b89f4'}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-400 text-[10px] font-mono font-bold">
                    {podDaemons?.agent_1_eph_node?.status || 'ONLINE'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Namespace / Node</span>
                    <span className="text-cyan-300 text-[11px] font-bold">metal3-system / eph-node</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Go Memory (RSS)</span>
                    <span className="text-emerald-400 text-[11px] font-bold">28 MB</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">CPU & Heartbeat</span>
                    <span className="text-indigo-300 text-[11px] font-bold">1.4% (1.2s ago)</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    {language === 'zh' ? '⚡ 快速指令下发 (通过 Go HTTP 通信):' : '⚡ Quick Command Dispatch (via Go IPC):'}
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => handleDispatchPodCommand('eph', 'INSPECT_INVENTORY')}
                      disabled={dispatchingPodCmd}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-cyan-400" />
                      <span>{t.cmdQuickInspect}</span>
                    </button>
                    <button
                      onClick={() => handleDispatchPodCommand('eph', 'TRIGGER_CP01_BOOT')}
                      disabled={dispatchingPodCmd}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-indigo-400" />
                      <span>{t.cmdQuickBoot}</span>
                    </button>
                    <button
                      onClick={() => handleDispatchPodCommand('eph', 'PREPARE_PIVOT')}
                      disabled={dispatchingPodCmd}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3 text-amber-400" />
                      <span>{t.cmdQuickPreparePivot}</span>
                    </button>
                    <button
                      onClick={() => handleDispatchPodCommand('eph', 'COMPLETE_PIVOT')}
                      disabled={dispatchingPodCmd}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-300 text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Pivot 完成移交</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pod 2: Target Cluster Lifecycle Daemon */}
              <div className="bg-slate-950 border border-indigo-900/60 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-400">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">
                          Agent 2: Target Cluster Lifecycle Daemon
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-700 text-indigo-300 text-[10px] font-mono">
                          Go 1.22
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Pod: {podDaemons?.agent_2_target_capi?.pod_name || 'capm3-target-agent-operator-9c41a2'}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-400 text-[10px] font-mono font-bold">
                    {podDaemons?.agent_2_target_capi?.status || 'ACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Namespace / Cluster</span>
                    <span className="text-indigo-300 text-[11px] font-bold">capi-system / prod-gpu</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Go Memory (RSS)</span>
                    <span className="text-emerald-400 text-[11px] font-bold">34 MB</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">CPU & Heartbeat</span>
                    <span className="text-cyan-300 text-[11px] font-bold">2.1% (0.8s ago)</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    {language === 'zh' ? '⚡ 快速指令下发 (通过 Go HTTP 通信):' : '⚡ Quick Command Dispatch (via Go IPC):'}
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => handleDispatchPodCommand('target', 'VERIFY_ETCD_QUORUM')}
                      disabled={dispatchingPodCmd}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-300 text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>{t.cmdQuickEtcd}</span>
                    </button>
                    <button
                      onClick={() => handleDispatchPodCommand('target', 'ACCEPT_PIVOT_CRD')}
                      disabled={dispatchingPodCmd}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Boxes className="w-3 h-3 text-cyan-400" />
                      <span>{t.cmdQuickAcceptPivot}</span>
                    </button>
                    <button
                      onClick={() => handleDispatchPodCommand('target', 'IGNITE_MULTI_CNI')}
                      disabled={dispatchingPodCmd}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Network className="w-3 h-3 text-indigo-400" />
                      <span>{t.cmdQuickIgniteCNI}</span>
                    </button>
                    <button
                      onClick={() => handleDispatchPodCommand('target', 'AUDIT_GPU_RDMA')}
                      disabled={dispatchingPodCmd}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Cpu className="w-3 h-3 text-amber-400" />
                      <span>{t.cmdQuickAuditGpu}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Pod Command Dispatch Console */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-300">
                    {language === 'zh' ? '目标 Pod Agent:' : 'Target Pod Agent:'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPodCommandTarget('eph')}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                        podCommandTarget === 'eph'
                          ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/40'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Agent 1 (Eph-Node Pod)
                    </button>
                    <button
                      onClick={() => setPodCommandTarget('target')}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                        podCommandTarget === 'target'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Agent 2 (Target CAPI Pod)
                    </button>
                  </div>
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  Runtime: 100% Pure Go Binary via IPC
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={podCommandInput}
                  onChange={(e) => setPodCommandInput(e.target.value)}
                  placeholder="Enter instruction (e.g. INSPECT_INVENTORY, VERIFY_ETCD_QUORUM, IGNITE_MULTI_CNI)..."
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => handleDispatchPodCommand()}
                  disabled={dispatchingPodCmd || !podCommandInput}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-indigo-600/30"
                >
                  <Send className={`w-3.5 h-3.5 ${dispatchingPodCmd ? 'animate-spin' : ''}`} />
                  <span>{dispatchingPodCmd ? '...' : t.btnDispatchPodCommand}</span>
                </button>
              </div>

              {podCommandOutput && (
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400 space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold">
                    {language === 'zh' ? 'Go 容器内守护进程实时执行结果:' : 'Go Pod Daemon Real-Time Execution Output:'}
                  </div>
                  <div>{podCommandOutput}</div>
                </div>
              )}
            </div>

            {/* Tabbed Pure Go Pod Source Code & YAML Manifest Viewer */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-cyan-400" />
                  <span>{t.podCodeInspectTitle}</span>
                </h4>

                <button
                  onClick={() => {
                    const content = podFiles?.[activePodCodeKey]?.content || '';
                    handleCopyPodCode(content);
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-mono flex items-center gap-1 transition cursor-pointer self-start sm:self-auto"
                >
                  <Copy className="w-3 h-3 text-cyan-400" />
                  <span>{copiedPodCode ? t.copiedNotice : t.btnCopyPodCode}</span>
                </button>
              </div>

              {/* Subtabs for Go files and YAML manifests */}
              <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2">
                {[
                  { key: 'eph_main_go', label: 'cmd/eph-agent/main.go', badge: 'Go', role: 'Agent 1 Pod 入口' },
                  { key: 'eph_pkg_go', label: 'pkg/agent/ephnode/agent.go', badge: 'Go', role: 'Agent 1 守护核心' },
                  { key: 'eph_dhcp_go', label: 'pkg/agent/ephnode/dhcp_monitor.go', badge: 'Go', role: 'Agent 1 DHCP 监控' },
                  { key: 'eph_probe_go', label: 'pkg/agent/ephnode/probe_server.go', badge: 'Go', role: 'Agent 1 Pod 探针' },
                  { key: 'target_main_go', label: 'cmd/target-agent/main.go', badge: 'Go', role: 'Agent 2 Pod 入口' },
                  { key: 'target_pkg_go', label: 'pkg/agent/target/agent.go', badge: 'Go', role: 'Agent 2 守护核心' },
                  { key: 'target_cni_go', label: 'pkg/agent/target/cni_mesh.go', badge: 'Go', role: 'Agent 2 Multi-CNI 网状' },
                  { key: 'target_etcd_go', label: 'pkg/agent/target/etcd_verifier.go', badge: 'Go', role: 'Agent 2 Etcd 仲裁' },
                  { key: 'target_probe_go', label: 'pkg/agent/target/probe_server.go', badge: 'Go', role: 'Agent 2 Pod 探针' },
                  { key: 'proto_handshake_go', label: 'pkg/agent/protocol/handshake.go', badge: 'Go', role: '双 Agent 握手协议' },
                  { key: 'eph_pod_yaml', label: 'deploy/eph-agent-pod.yaml', badge: 'YAML', role: 'Agent 1 Pod 清单' },
                  { key: 'target_ds_yaml', label: 'deploy/target-agent-daemonset.yaml', badge: 'YAML', role: 'Agent 2 DaemonSet' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActivePodCodeKey(item.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-2 transition cursor-pointer ${
                      activePodCodeKey === item.key
                        ? 'bg-slate-800 text-cyan-300 border border-cyan-700/80 shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${item.badge === 'Go' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-indigo-950 text-indigo-400 border border-indigo-800'}`}>
                      {item.badge}
                    </span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Source Code Container */}
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs overflow-x-auto max-h-96 text-slate-300 relative shadow-inner">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-[11px] text-slate-400">
                  <span>File: <strong className="text-cyan-400">{podFiles?.[activePodCodeKey]?.path || activePodCodeKey}</strong></span>
                  <span>Role: {podFiles?.[activePodCodeKey]?.role || 'Go Daemon'}</span>
                </div>
                <pre className="whitespace-pre leading-relaxed text-[11.5px] font-mono text-cyan-100">
                  {podFiles?.[activePodCodeKey]?.content || `// Loading pure Go source code for ${activePodCodeKey}...`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* --- SUBTAB: DUAL-NETWORK & MULTI-CNI COEXISTENCE (MULTUS/CALICO/OVS/SR-IOV) --- */}
      {/* ========================================================================= */}
      {activeSubTab === 'multicni' && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-800/60 rounded-2xl p-6 relative overflow-hidden shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    DUAL-NETWORK & MULTI-CNI MESH OPERATIONAL
                  </span>
                  <span className="text-slate-500 text-xs">|</span>
                  <span className="text-xs text-emerald-300 font-mono">
                    Multus v4.1 + Calico v3.28 + OVS-DPDK v2.17 + Multi-DPDK/SR-IOV
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">{t.multiCNITitle}</h2>
                <p className="text-xs text-slate-300 max-w-3xl mt-1 leading-relaxed">{t.multiCNISubtitle}</p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={handleTestCNIPackets}
                  disabled={testingCNI}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-600/30 transition cursor-pointer"
                >
                  <Zap className={`w-4 h-4 ${testingCNI ? 'animate-spin' : ''}`} />
                  <span>{testingCNI ? 'Testing Packets...' : t.btnTestCNIPackets}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Dual Physical Network Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Control Network Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {dualNetwork?.control_network?.purpose_zh && language === 'zh'
                        ? '管理与控制平面专网 (Control Network)'
                        : 'Control-Plane Management Network'}
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      VLAN {dualNetwork?.control_network?.vlan || 100} • MTU {dualNetwork?.control_network?.mtu || 1500}
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-mono font-bold">
                  ONLINE
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">Subnet CIDR</span>
                  <span className="text-indigo-300 font-bold">{dualNetwork?.control_network?.cidr || '10.240.10.0/24'}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">Gateway</span>
                  <span className="text-white font-bold">{dualNetwork?.control_network?.gateway || '10.240.10.1'}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                {language === 'zh'
                  ? dualNetwork?.control_network?.purpose_zh ||
                    '管理控制面专网：承载 Kube-apiserver、etcd 仲裁、Ironic 裸机装机 PXE/DHCP/VirtualMedia 镜像注入与 BMC 带外控制。'
                  : dualNetwork?.control_network?.purpose}
              </p>

              <div className="pt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                <span>Interfaces: {(dualNetwork?.control_network?.interfaces || ['eno1', 'eno2']).join(', ')}</span>
                <span className="text-indigo-400">{dualNetwork?.control_network?.bandwidth || '2x 10Gbps Bonded'}</span>
              </div>
            </div>

            {/* 2. Data Network Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {dualNetwork?.data_network?.purpose_zh && language === 'zh'
                        ? '超高速业务数据专网 (Data Network)'
                        : 'High-Throughput Data Network'}
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      VLAN {dualNetwork?.data_network?.vlan || 200} • MTU {dualNetwork?.data_network?.mtu || 9000} (Jumbo)
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-mono font-bold">
                  200G RoCEv2
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">Subnet CIDR</span>
                  <span className="text-cyan-300 font-bold">{dualNetwork?.data_network?.cidr || '10.250.0.0/16'}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">Gateway</span>
                  <span className="text-white font-bold">{dualNetwork?.data_network?.gateway || '10.250.0.1'}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                {language === 'zh'
                  ? dualNetwork?.data_network?.purpose_zh ||
                    '超高速数据专网：承载 Pod 东西向流量、GPU Direct RDMA、NCCL 分布式并行训练、超高带宽微秒级超低时延。'
                  : dualNetwork?.data_network?.purpose}
              </p>

              <div className="pt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                <span>Interfaces: {(dualNetwork?.data_network?.interfaces || ['ens1f0', 'ens1f1']).join(', ')}</span>
                <span className="text-cyan-400">{dualNetwork?.data_network?.bandwidth || '2x 200Gbps Dual-Port RoCEv2'}</span>
              </div>
            </div>
          </div>

          {/* 4-CNI Coexistence Architecture Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Network className="w-4 h-4 text-emerald-400" />
                <span>
                  {language === 'zh'
                    ? '多 CNI 融合协同工作矩阵 (Multus + Calico + OVS-DPDK + 多路 DPDK / SR-IOV)'
                    : 'Multi-CNI Coexistence Operational Matrix (Multus + Calico + OVS-DPDK + Multi-DPDK/SR-IOV)'}
                </span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {multiCNI?.multus?.config?.delegates?.length || 4} Delegates Running Simultaneously
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* 1. Multus */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold font-mono text-purple-300 px-2 py-0.5 rounded bg-purple-950 border border-purple-800">
                      MULTUS CNI
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {multiCNI?.multus?.version || 'v4.1.0'} ACTIVE
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">Meta-Plugin Multi-NIC</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {language === 'zh'
                      ? '多网卡附着调度器，为单 Pod 同步注入 Calico 主网卡、OVS-DPDK 与多路 DPDK/SR-IOV 网卡'
                      : 'Meta-plugin attaching primary Calico eth0 plus OVS-DPDK & multiple DPDK/SR-IOV NICs'}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <div>Delegates: {(multiCNI?.multus?.config?.delegates || ['calico', 'ovs-dpdk', 'dpdk-sriov-pf0', 'sriov-rocev2-pf1']).join(', ')}</div>
                  <div className="text-purple-300">CRD: NetworkAttachmentDefinition</div>
                </div>
              </div>

              {/* 2. Calico */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold font-mono text-indigo-300 px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800">
                      CALICO CNI
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      eth0 (Default)
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">Default Primary Network</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {language === 'zh'
                      ? '默认主网络平面 (BGP 路由反射 + Calico IPAM + K8s NetworkPolicy 零信任隔离)'
                      : 'Default Pod eth0 handling BGP routing, Service ClusterIP & NetworkPolicy'}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <div>Version: {multiCNI?.calico?.version || 'v3.28.1'} • Latency {multiCNI?.calico?.latency || '~12µs'}</div>
                  <div className="text-indigo-300">IP Pool: {multiCNI?.calico?.config?.ipPools?.[0] || '172.16.0.0/16'}</div>
                </div>
              </div>

              {/* 3. OVS-DPDK */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold font-mono text-cyan-300 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                      OVS-DPDK CNI
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400">
                      net1 ({multiCNI?.ovs?.config?.bridge || 'br-data'})
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">Userspace netdev + vhost-user</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {language === 'zh'
                      ? '基于 DPDK 轮询态 Open vSwitch 二层网桥，支持 VLAN 200 隔离与零内核拷贝交换'
                      : 'Open vSwitch netdev DPDK vhost-user L2 bridge with VLAN 200 trunking & QoS'}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <div>Datapath: {multiCNI?.ovs?.config?.datapath_type || 'netdev'} (DPDK PMD)</div>
                  <div className="text-cyan-300">Mode: {multiCNI?.ovs?.config?.vhost_mode || 'dpdkvhostuserclient'}</div>
                </div>
              </div>

              {/* 4. Multi-DPDK & SR-IOV */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold font-mono text-amber-300 px-2 py-0.5 rounded bg-amber-950 border border-amber-800">
                      MULTI-DPDK / SR-IOV
                    </span>
                    <span className="text-[10px] font-mono text-amber-400">net2 + net3 (VF)</span>
                  </div>
                  <div className="text-xs font-bold text-white">vfio-pci PMD + ConnectX-7 RDMA</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {language === 'zh'
                      ? '多路物理 VF 并行绑定：net2 跑 vfio-pci DPDK 1Gi 巨页池，net3 跑 CX-7 RoCEv2 直通'
                      : 'Dual VF planes: net2 vfio-pci DPDK 1Gi HugePages PMD & net3 ConnectX-7 RoCEv2 RDMA'}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <div>VF Pool: {multiCNI?.sriov?.config?.vfCount || 32} VFs ({multiCNI?.sriov?.config?.dpdk_driver || 'vfio-pci'} + mlx5)</div>
                  <div className="text-amber-300">Line-Rate: 100G PMD + 200G RoCEv2</div>
                </div>
              </div>
            </div>

            {/* Multi-DPDK & SR-IOV Plane Breakdown + Multus NADs */}
            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 space-y-2">
                <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>
                    {language === 'zh'
                      ? '多路 DPDK / SR-IOV 高速用户态数据平面'
                      : 'Active Multi-DPDK & SR-IOV High-Speed Planes'}
                  </span>
                  <span className="text-[10px] font-mono text-amber-300">HugePages 1Gi Enabled</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(multiCNI?.dpdk_planes || [
                    { name: 'Plane 1: OVS-DPDK vhost-user Bridge', version: 'OVS 2.17 + DPDK 24.11', interface: 'net1 (br-data / vhost-user0)', latency: '3.2µs', throughput: '100Gbps Userspace Switch', config: { driver: 'dpdkvhostuserclient' }, status: 'ACTIVE' },
                    { name: 'Plane 2: SR-IOV DPDK vfio-pci PF0', version: 'DPDK 24.11 LTS', interface: 'net2 (dpdk0 / 0000:4b:02.0)', latency: '1.8µs', throughput: '100Gbps Full-Duplex PMD', config: { driver: 'vfio-pci' }, status: 'ACTIVE' },
                    { name: 'Plane 3: Mellanox ConnectX-7 RoCEv2 PF1', version: 'mlx5_core / OFED 24.10', interface: 'net3 (mlx5_vf1 / 0000:98:04.0)', latency: '1.15µs', throughput: '200Gbps Line-Rate RDMA', config: { driver: 'mlx5_ib' }, status: 'ACTIVE' },
                  ]).map((plane: any, idx: number) => (
                    <div key={idx} className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-[11px] font-mono space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-amber-300 truncate">{plane.interface}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                          {plane.status || 'ACTIVE'}
                        </span>
                      </div>
                      <div className="text-white font-semibold truncate">{plane.name}</div>
                      <div className="text-slate-400 text-[10px]">Driver: {plane.config?.driver || plane.version}</div>
                      <div className="text-cyan-300 text-[10px] truncate">{plane.latency} • {plane.throughput}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 space-y-2">
                <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>Multus NetworkAttachmentDefinitions (CRDs)</span>
                  <span className="text-[10px] font-mono text-purple-300">k8s.cni.cncf.io/v1</span>
                </div>
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5 text-[11px] font-mono">
                  {(multiCNI?.network_attachment_definitions || [
                    { name: 'calico-primary', type: 'calico', cni: 'Default eth0 (BGP Routed + NetworkPolicy)' },
                    { name: 'ovs-dpdk-vlan200', type: 'ovs-dpdk', cni: 'Secondary net1 (OVS-DPDK br-data + vhost-user, VLAN 200)' },
                    { name: 'dpdk-sriov-vfio-pf0', type: 'sriov-dpdk', cni: 'DPDK Plane net2 (vfio-pci Userspace PMD + 1Gi HugePages)' },
                    { name: 'sriov-rocev2-mlx5-pf1', type: 'sriov-rdma', cni: 'RDMA Plane net3 (ConnectX-7 VF RoCEv2, GPU Direct)' },
                  ]).map((nad: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-slate-300">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                        <span className="text-purple-300 font-semibold shrink-0">{typeof nad === 'string' ? nad : nad.name}</span>
                        {typeof nad !== 'string' && nad.cni && (
                          <span className="text-slate-400 text-[10px] truncate">{nad.cni}</span>
                        )}
                      </div>
                      {typeof nad !== 'string' && nad.type && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[10px] text-cyan-300 shrink-0">
                          {nad.type}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live Packet Flow Test Feedback Card */}
          {cniTestResults && (
            <div className="bg-emerald-950/30 border border-emerald-800/80 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-white">
                    {language === 'zh'
                      ? '多 CNI 实时数据包连通性与时延基准测试报告'
                      : 'Multi-CNI Real-Time Packet Benchmark Report'}
                  </span>
                </div>
                <span className="text-xs text-emerald-300 font-mono">All 5 Planes Validated (Multus + Calico + OVS-DPDK + DPDK PMD + SR-IOV)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-slate-400 block mb-1">Multus Dispatch</span>
                  <span className="text-purple-300 font-bold">{cniTestResults.multus?.dispatch_time}</span>
                  <span className="text-[10px] text-slate-500 block mt-1">{cniTestResults.multus?.injected_nics} NICs Injected</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-slate-400 block mb-1">Calico Routing</span>
                  <span className="text-indigo-300 font-bold">{cniTestResults.calico?.latency_ms} ms</span>
                  <span className="text-[10px] text-emerald-400 block mt-1">{cniTestResults.calico?.bgp_peers}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-slate-400 block mb-1">OVS-DPDK Bridge</span>
                  <span className="text-cyan-300 font-bold">{cniTestResults.ovs?.throughput}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">VLAN {cniTestResults.ovs?.vlan_tag} • {cniTestResults.ovs?.datapath || 'netdev'}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-slate-400 block mb-1">DPDK Userspace PMD</span>
                  <span className="text-emerald-300 font-bold">{cniTestResults.dpdk?.throughput || '100 Gbps (148.8 Mpps)'}</span>
                  <span className="text-[10px] text-amber-300 block mt-1">{cniTestResults.dpdk?.pmd_driver || 'vfio-pci'} • {cniTestResults.dpdk?.hugepages || '1Gi HugePages'}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-slate-400 block mb-1">SR-IOV RoCEv2</span>
                  <span className="text-amber-300 font-bold">{cniTestResults.sriov?.latency_ms} ms (&lt;1.2µs)</span>
                  <span className="text-[10px] text-emerald-400 block mt-1">{cniTestResults.sriov?.gpu_direct}</span>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Packet Flow Simulator Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span>
                    {language === 'zh'
                      ? '双网络与多 CNI 数据包链路实时仿真探针 (Go 内核驱动)'
                      : 'Dual-Network & Multi-CNI Packet Flow Trace Engine (Go Powered)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'zh'
                    ? '选择不同业务网络协议，由 Go 控制面实时模拟从 Pod 容器到物理网络硬件的微秒级数据包封包与选路轨迹。'
                    : 'Select traffic profile to trace microsecond packet routing from container namespace down to physical fabric.'}
                </p>
              </div>

              <button
                onClick={() => handleSimulatePacketFlow()}
                disabled={simulatingPacket}
                className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-cyan-600/30 transition cursor-pointer shrink-0"
              >
                <Zap className={`w-3.5 h-3.5 ${simulatingPacket ? 'animate-spin' : ''}`} />
                <span>{simulatingPacket ? 'Simulating...' : (language === 'zh' ? '🛰️ 模拟数据包链路轨迹' : '🛰️ Trace Packet Path')}</span>
              </button>
            </div>

            {/* Protocol Selector Tabs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={() => handleSimulatePacketFlow('GPU_RDMA_ROCEV2')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                  packetTrafficType === 'GPU_RDMA_ROCEV2'
                    ? 'bg-amber-950/40 border-amber-600/80 shadow-md shadow-amber-900/20'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-amber-300 font-mono">1. SR-IOV RoCEv2</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-mono">1.15µs</span>
                </div>
                <div className="text-[11px] text-slate-300 font-medium">GPU Direct RDMA (net3)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">200G Wire-Rate • mlx5_core • MTU 9000</div>
              </button>

              <button
                onClick={() => handleSimulatePacketFlow('DPDK_USERSPACE_PMD')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                  packetTrafficType === 'DPDK_USERSPACE_PMD'
                    ? 'bg-emerald-950/40 border-emerald-600/80 shadow-md shadow-emerald-900/20'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-emerald-300 font-mono">2. DPDK Userspace PMD</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">1.8µs</span>
                </div>
                <div className="text-[11px] text-slate-300 font-medium">SR-IOV vfio-pci (net2)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">100G Zero-Copy PMD • 1Gi HugePages</div>
              </button>

              <button
                onClick={() => handleSimulatePacketFlow('POD_L2_VLAN200')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                  packetTrafficType === 'POD_L2_VLAN200'
                    ? 'bg-cyan-950/40 border-cyan-600/80 shadow-md shadow-cyan-900/20'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-cyan-300 font-mono">3. OVS-DPDK L2 Bridge</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">8.4µs</span>
                </div>
                <div className="text-[11px] text-slate-300 font-medium">OVS netdev vhost (net1)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">100G Wire-Rate • VLAN 200 • MTU 9000</div>
              </button>

              <button
                onClick={() => handleSimulatePacketFlow('APISERVER_MGMT')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                  packetTrafficType === 'APISERVER_MGMT'
                    ? 'bg-indigo-950/40 border-indigo-600/80 shadow-md shadow-indigo-900/20'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-indigo-300 font-mono">4. Calico Control Plane</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 font-mono">82µs</span>
                </div>
                <div className="text-[11px] text-slate-300 font-medium">Calico Primary (eth0)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">10G Bonded • VLAN 100 • K8s VIP</div>
              </button>
            </div>

            {/* Simulated Packet Hop Trace */}
            {packetSimResult && (
              <div className="space-y-4 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Selected Path:</span>
                    <span className="text-cyan-300 font-bold">{packetSimResult.selected_path}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400">
                      Total Latency: {packetSimResult.total_latency}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                      Wire: {packetSimResult.throughput_wire}
                    </span>
                    <span className={`px-2 py-0.5 rounded font-bold ${packetSimResult.jumbo_frames ? 'bg-amber-950 border border-amber-800 text-amber-300' : 'bg-slate-800 text-slate-300'}`}>
                      {packetSimResult.jumbo_frames ? 'Jumbo Frames MTU 9000' : 'Standard MTU 1500'}
                    </span>
                  </div>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                  {packetSimResult.hops?.map((hop: any) => (
                    <div key={hop.order} className="relative flex flex-col md:flex-row md:items-start justify-between gap-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 text-xs">
                      <div className="absolute -left-[27px] top-3.5 w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500 text-cyan-300 text-[10px] font-mono font-bold flex items-center justify-center">
                        {hop.order}
                      </div>

                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white font-mono">{hop.device}</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                            {hop.layer}
                          </span>
                          <span className="text-[10px] text-cyan-400 font-mono font-bold">
                            Hop Latency: {hop.latency}
                          </span>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          {language === 'zh' && hop.action_zh ? hop.action_zh : hop.action}
                        </p>
                        <div className="p-2 rounded-lg bg-black/50 border border-slate-800/70 text-[11px] font-mono text-slate-400">
                          {hop.headers}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Go pkg/cni Reconciled State Machine Fleet Provisioning */}
          {cniFleet && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 text-[10px] font-mono font-bold">
                      pkg/cni • RECONCILED STATE MACHINE
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Gen #{cniFleet.desired_generation} • Cycles {cniFleet.reconcile_cycles} • Loop {cniFleet.loop_running ? 'ACTIVE' : 'READY'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {language === 'zh'
                      ? 'Metal3 机群 CNI 声明式状态机与多网卡收敛监控 (Calico / Multus / SR-IOV)'
                      : 'Metal3 Fleet CNI Reconciled State Machine (Calico / Multus / SR-IOV)'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {language === 'zh'
                      ? `已收敛节点 ${cniFleet.converged_hosts}/${cniFleet.total_hosts}（漂移/降级 ${cniFleet.degraded_hosts} • 协调中 ${cniFleet.reconciling_hosts}），支持漂移检测与一步/全量收敛自愈。`
                      : `Converged ${cniFleet.converged_hosts}/${cniFleet.total_hosts} fleet hosts (Drifted/Degraded: ${cniFleet.degraded_hosts}, Reconciling: ${cniFleet.reconciling_hosts}).`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleInjectCNIDrift('bmh-worker-k8s-01', 'sriov-dpdk')}
                    disabled={reconcilingCNI}
                    className="px-3 py-2 rounded-xl bg-amber-950/70 hover:bg-amber-900/70 border border-amber-700/80 text-amber-300 text-xs font-semibold transition cursor-pointer"
                  >
                    {language === 'zh' ? '模拟 SR-IOV 接口漂移' : 'Inject SR-IOV Drift'}
                  </button>
                  <button
                    onClick={() => handleReconcileCNIFleet(false)}
                    disabled={reconcilingCNI}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                  >
                    {language === 'zh' ? '单步 Reconcile Tick' : 'Step State Machine'}
                  </button>
                  <button
                    onClick={() => handleReconcileCNIFleet(true)}
                    disabled={reconcilingCNI}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    {language === 'zh' ? '全机群收敛至 READY' : 'Converge Fleet'}
                  </button>
                </div>
              </div>

              {/* Host State Table */}
              <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="px-3 py-2.5">Host</th>
                      <th className="px-3 py-2.5">Role</th>
                      <th className="px-3 py-2.5">Phase</th>
                      <th className="px-3 py-2.5">Bound Interfaces (Calico / OVS-DPDK / SR-IOV)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {[...(cniFleet.hosts || [])]
                      .sort((a: any, b: any) => {
                        const rank = (p: string) =>
                          p === 'DRIFTED' || p === 'DEGRADED'
                            ? 0
                            : p === 'PENDING'
                              ? 3
                              : p === 'READY'
                                ? 2
                                : 1;
                        const diff = rank(a.overall_phase) - rank(b.overall_phase);
                        return diff !== 0 ? diff : String(a.host_name).localeCompare(String(b.host_name));
                      })
                      .map((hs: any) => {
                        const driftedPlugins = Object.values(hs.plugins || {}).filter(
                          (p: any) => p.drifted || p.phase === 'DRIFTED' || p.phase === 'DEGRADED'
                        );
                        return (
                          <tr key={hs.host_name} className="hover:bg-slate-900/50">
                            <td className="px-3 py-2 text-white font-semibold">{hs.host_name}</td>
                            <td className="px-3 py-2 text-slate-400">{hs.role}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  hs.overall_phase === 'READY'
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                    : hs.overall_phase === 'DRIFTED' || hs.overall_phase === 'DEGRADED'
                                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                                      : 'bg-slate-900 text-slate-300 border-slate-700'
                                }`}
                              >
                                {hs.overall_phase}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[11px] text-cyan-300">
                              <div>{(hs.interfaces || []).join(' • ') || 'Awaiting cluster assignment'}</div>
                              {driftedPlugins.length > 0 && (
                                <div className="text-[10px] text-amber-300 mt-0.5">
                                  {driftedPlugins.map((p: any) => `${p.plugin} (${p.interface}): ${p.message}`).join(' | ')}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Rendered Config Artifacts Viewer */}
              {cniFleet.rendered_artifacts && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {Object.keys(cniFleet.rendered_artifacts).sort().map(key => (
                      <button
                        key={key}
                        onClick={() => setActiveCniArtifact(key)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition cursor-pointer ${
                          activeCniArtifact === key
                            ? 'bg-cyan-600 text-white font-bold'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                  <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {cniFleet.rendered_artifacts[activeCniArtifact] || ''}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- SUBTAB: TALOS OMNI RAPID DEPLOYMENT WIZARD (120S BAREMETAL K8S) --- */}
      {/* ========================================================================= */}
      {activeSubTab === 'omni' && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-amber-800/60 rounded-2xl p-6 relative overflow-hidden shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded bg-amber-950 border border-amber-600 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    TALOS OMNI RAPID ENGINE READY
                  </span>
                  <span className="text-slate-500 text-xs">|</span>
                  <span className="text-xs text-amber-300 font-mono">
                    Zero-Touch Declarative Bare-Metal Automation
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">{t.omniTitle}</h2>
                <p className="text-xs text-slate-300 max-w-3xl mt-1 leading-relaxed">{t.omniSubtitle}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={handleStartOmni}
                  disabled={omniStepping}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Play className={`w-3.5 h-3.5 ${omniStepping ? 'animate-spin text-amber-400' : ''}`} />
                  <span>{language === 'zh' ? '🚀 启动单步演练' : '🚀 Start Stepper'}</span>
                </button>

                <button
                  onClick={handleNextOmniStep}
                  disabled={omniStepping}
                  className="px-3.5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-700/30 transition cursor-pointer"
                >
                  <ChevronRight className={`w-3.5 h-3.5 ${omniStepping ? 'animate-spin' : ''}`} />
                  <span>{language === 'zh' ? '⏭️ 下一步骤' : '⏭️ Next Step'}</span>
                </button>

                <button
                  onClick={handleResetOmni}
                  disabled={omniResetting}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${omniResetting ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>{language === 'zh' ? '🔄 重置' : '🔄 Reset'}</span>
                </button>

                <button
                  onClick={handleInstantOmniDeploy}
                  disabled={omniDeploying}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-600/30 transition cursor-pointer"
                >
                  <Zap className={`w-4 h-4 ${omniDeploying ? 'animate-spin' : ''}`} />
                  <span>{omniDeploying ? 'Deploying Fleet...' : t.btnInstantOmniDeploy}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Omni Machine Pools Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Control-Plane Pool</span>
              <div className="text-xl font-bold font-mono text-white">3 Nodes (HA Quorum)</div>
              <p className="text-xs text-slate-400">
                bmh-master-k8s-01 ~ 03 • 128 Cores • 512GB RAM • etcd Raft consensus
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <span className="text-xs text-slate-400 font-medium">GPU Superpod Pool</span>
              <div className="text-xl font-bold font-mono text-cyan-300">8 Nodes (64x H100)</div>
              <p className="text-xs text-slate-400">
                bmh-worker-k8s-01 ~ 08 • 8x H100 80GB SXM5 per node • Dual 200G RoCEv2
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Compute / Spare Pool</span>
              <div className="text-xl font-bold font-mono text-emerald-400">4 Nodes (Available)</div>
              <p className="text-xs text-slate-400">
                bmh-spare-pool-01 ~ 04 • Ready for autonomous elastic scaling
              </p>
            </div>
          </div>

          {/* Live Omni Rapid Deployment Timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-amber-400" />
                  <span>
                    {language === 'zh'
                      ? 'Talos Omni 级 120 秒极速自动装机流水线 (Live Timeline)'
                      : 'Talos Omni 120s Rapid Deployment Timeline'}
                  </span>
                </h3>
                <span className="text-xs text-slate-400">
                  Cluster: {omniProgress?.cluster_name || omniClusterName} • Target K8s: {omniK8sVersion}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono text-xs font-bold">
                  Total Time: {omniProgress?.elapsed_time_sec || 98}s (Sub-2-Minute Ready)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono text-xs">
                  {omniProgress?.progress_percent || 100}% Complete (Step {omniProgress?.current_step_index || 7}/7)
                </span>
              </div>
            </div>

            {/* Stepper Timeline List */}
            <div className="space-y-3">
              {(omniProgress?.steps || []).map((step: any, idx: number) => {
                const isRunning = step.status === 'RUNNING';
                const isCompleted = step.status === 'COMPLETED';

                return (
                  <div
                    key={step.id || idx}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition ${
                      isRunning
                        ? 'bg-amber-950/30 border-amber-500/80 shadow-md shadow-amber-900/30'
                        : isCompleted
                        ? 'bg-slate-950 border-slate-800/80'
                        : 'bg-slate-950/40 border-slate-800/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-1.5 rounded-full mt-0.5 ${
                          isRunning
                            ? 'bg-amber-900 text-amber-300 border border-amber-500 animate-pulse'
                            : isCompleted
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {isRunning ? (
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        ) : isCompleted ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className={`font-bold ${isRunning ? 'text-amber-300' : isCompleted ? 'text-white' : 'text-slate-400'}`}>
                            {language === 'zh' && step.name_zh ? step.name_zh : step.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            {step.agent_source}
                          </span>
                          {isRunning && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 font-bold animate-pulse">
                              RUNNING
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 mt-1 leading-relaxed">{step.detail}</p>
                      </div>
                    </div>

                    <div className="shrink-0 font-mono text-[11px] text-slate-400 flex md:flex-col items-end gap-1">
                      <span className={`${isRunning ? 'text-amber-400 font-bold' : isCompleted ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                        {((step.duration_ms || 10000) / 1000).toFixed(1)}s
                      </span>
                      <span className="text-[10px] text-slate-500">{step.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Declarative Manifests Suite with Pure Go Validator */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  {language === 'zh'
                    ? '生产级声明式 YAML 拓扑包 (CAPM3 / Multus / Calico / OVS / SRIOV / MachineConfig)'
                    : 'Declarative YAML Manifests Suite'}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleValidateYaml()}
                  disabled={validatingYaml}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition cursor-pointer"
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${validatingYaml ? 'animate-spin' : ''}`} />
                  <span>{validatingYaml ? 'Validating...' : (language === 'zh' ? '🛡️ Go 引擎深度语义校验' : '🛡️ Validate via Go')}</span>
                </button>
                <button
                  onClick={() => handleCopyManifest(manifestEditorText || omniManifests[activeManifestKey] || '')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedManifest ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedManifest ? 'Copied!' : 'Copy YAML'}</span>
                </button>
              </div>
            </div>

            {/* Manifest Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {Object.keys(omniManifests).map(key => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveManifestKey(key);
                    setManifestEditorText(omniManifests[key] || '');
                    setManifestValidation(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                    activeManifestKey === key
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Validation Feedback Banner */}
            {manifestValidation && (
              <div
                className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
                  manifestValidation.valid
                    ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-700 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    {manifestValidation.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                    <span>
                      {manifestValidation.valid
                        ? (language === 'zh' ? '✅ Go 核心语义校验通过 (Valid CRD Schema)' : '✅ Go Engine CRD Validation PASSED')
                        : (language === 'zh' ? '❌ Go 语义校验发现异常' : '❌ Validation Failed')}
                    </span>
                  </div>
                  <span className="text-[11px] opacity-80">
                    Kind: {manifestValidation.kind} • API: {manifestValidation.api_version}
                  </span>
                </div>

                {manifestValidation.checks_passed?.length > 0 && (
                  <div className="space-y-1 pt-1 text-[11px] text-emerald-400">
                    {manifestValidation.checks_passed.map((c: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}

                {manifestValidation.warnings?.length > 0 && (
                  <div className="space-y-1 pt-1 text-[11px] text-amber-300">
                    {manifestValidation.warnings.map((w: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {manifestValidation.errors?.length > 0 && (
                  <div className="space-y-1 pt-1 text-[11px] text-rose-300">
                    {manifestValidation.errors.map((e: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <X className="w-3 h-3 text-rose-400" />
                        <span>{e}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Editable Code Block */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-hidden">
              <textarea
                value={manifestEditorText || omniManifests[activeManifestKey] || ''}
                onChange={e => setManifestEditorText(e.target.value)}
                rows={16}
                className="w-full bg-transparent text-xs font-mono text-cyan-300 leading-relaxed outline-none resize-y"
                placeholder="# Declarative manifest..."
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- SUBTAB: KUBERNETES VERSION MATRIX & NODE UPGRADE SELECTOR (v1.33 ~ v1.36) --- */}
      {/* ========================================================================= */}
      {activeSubTab === 'versions' && (
        <div className="space-y-6">
          {/* Top Banner & Strategy Summary */}
          <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-800/60 rounded-2xl p-6 relative overflow-hidden shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    K8s Version Orchestration
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                    DRA & RoCEv2 Optimized
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Dual-Agent Handover
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Boxes className="w-6 h-6 text-purple-400" />
                  <span>{t.k8sVersionSelectorTitle || 'Kubernetes 多版本编排矩阵与节点升级中枢 (K8s Version Matrix)'}</span>
                </h2>
                <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                  {t.k8sVersionSelectorSubtitle || '支持从长期稳定版 (LTS) 到最新超前研发版 (v1.33 ~ v1.36) 的声明式平滑灰度升级，保障 RoCEv2 与 GPU 算力无损。'}
                </p>
              </div>

              {/* Current Fleet Quick Status & Action Pill */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0 font-mono text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 mb-0.5">{language === 'zh' ? '当前集群基线版本' : 'Current Fleet Baseline'}</div>
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{activeCluster?.k8s_version || 'v1.31.2'}</span>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-800 hidden sm:block" />
                <div>
                  <div className="text-[10px] text-slate-400 mb-0.5">{language === 'zh' ? '当前选中目标版本' : 'Selected Target Version'}</div>
                  <div className="text-sm font-bold text-purple-300 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                    <span>{selectedTargetVersion}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Version Feedback Alert if any */}
            {versionFeedback && (
              <div className={`mt-4 p-3 rounded-lg border flex items-center justify-between text-xs font-mono ${
                versionFeedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-800 text-rose-200'
              }`}>
                <div className="flex items-center gap-2">
                  {versionFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{versionFeedback.message}</span>
                </div>
                <button
                  onClick={() => setVersionFeedback(null)}
                  className="text-slate-400 hover:text-white ml-2 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Upgrade Controls & Policy Configurator Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold font-mono text-white tracking-wide uppercase">
                  {language === 'zh' ? '升级编排策略配置 (Upgrade Orchestration Policy)' : 'Upgrade Orchestration Policy'}
                </span>
              </div>

              {/* Version Category Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
                <button
                  onClick={() => setVersionFilterCategory('all')}
                  className={`px-3 py-1 rounded font-medium transition cursor-pointer ${
                    versionFilterCategory === 'all' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {language === 'zh' ? '全部版本 (7)' : 'All Versions (7)'}
                </button>
                <button
                  onClick={() => setVersionFilterCategory('stable')}
                  className={`px-3 py-1 rounded font-medium transition cursor-pointer ${
                    versionFilterCategory === 'stable' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {language === 'zh' ? '生产稳定版 (v1.33~v1.35)' : 'Production (v1.33~v1.35)'}
                </button>
                <button
                  onClick={() => setVersionFilterCategory('preview')}
                  className={`px-3 py-1 rounded font-medium transition cursor-pointer ${
                    versionFilterCategory === 'preview' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {language === 'zh' ? '超前尝鲜 (v1.36-dev)' : 'Bleeding-Edge (v1.36-dev)'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Scope Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>{t.lblUpgradeScope || '升级作用域 (Scope)'}</span>
                  <span className="text-[10px] font-mono text-purple-300">
                    {upgradeScope === 'all'
                      ? `${hosts.length} Nodes`
                      : upgradeScope === 'control-plane'
                        ? '3 Masters'
                        : upgradeScope === 'worker-gpu'
                          ? '8 Supernodes'
                          : `${selectedUpgradeNodes.length} Selected`}
                  </span>
                </label>
                <select
                  value={upgradeScope}
                  onChange={e => setUpgradeScope(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="all">{t.scopeAllNodes || '全量集群物理机 (全部 15 节点)'}</option>
                  <option value="control-plane">{t.scopeControlPlaneOnly || '仅控制面节点 (HA Master 01-03)'}</option>
                  <option value="worker-gpu">{t.scopeWorkerGPUOnly || '仅 GPU 超算工作节点 (8x H100 Supernodes)'}</option>
                  <option value="custom">{t.scopeSelectedNodes || '自定义勾选节点'}</option>
                </select>
              </div>

              {/* Policy Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {t.lblUpgradePolicy || '升级调度策略 (Upgrade Policy)'}
                </label>
                <select
                  value={upgradePolicy}
                  onChange={e => setUpgradePolicy(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="rolling">{t.policyRollingSafe || '安全无损滚动升级 (逐台 Cordon/Drain)'}</option>
                  <option value="canary">{t.policyCanary || '金丝雀灰度升级 (先升级 1 台验证 60s)'}</option>
                  <option value="batch">{t.policyBatchParallel || '并发批量升级 (每批次 2 台并行)'}</option>
                </select>
              </div>

              {/* Drain Timeout Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Drain 超时容忍</span>
                  <span className="text-[10px] font-mono text-cyan-400">{drainTimeout}s</span>
                </label>
                <select
                  value={drainTimeout}
                  onChange={e => setDrainTimeout(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value={180}>180 秒 (快速集群驱逐)</option>
                  <option value={300}>300 秒 (生产推荐: 5 分钟优雅驱逐)</option>
                  <option value={600}>600 秒 (超算大显存 GPU 任务排空)</option>
                </select>
              </div>
            </div>

            {/* Custom Nodes multi-select toggle if custom scope */}
            {upgradeScope === 'custom' && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{language === 'zh' ? '勾选需要升级的物理机节点:' : 'Select nodes to upgrade:'}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedUpgradeNodes(hosts.map(h => h.name))}
                      className="text-[11px] text-purple-400 hover:text-purple-300 underline cursor-pointer"
                    >
                      {language === 'zh' ? '全选' : 'Select All'}
                    </button>
                    <button
                      onClick={() => setSelectedUpgradeNodes([])}
                      className="text-[11px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
                    >
                      {language === 'zh' ? '清空' : 'Clear'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-40 overflow-y-auto pr-1">
                  {hosts.map(h => {
                    const isChecked = selectedUpgradeNodes.includes(h.name);
                    return (
                      <label
                        key={h.name}
                        className={`flex items-center gap-2 p-2 rounded border text-xs font-mono cursor-pointer transition ${
                          isChecked
                            ? 'bg-purple-950/60 border-purple-700 text-purple-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedUpgradeNodes([...selectedUpgradeNodes, h.name]);
                            } else {
                              setSelectedUpgradeNodes(selectedUpgradeNodes.filter(n => n !== h.name));
                            }
                          }}
                          className="accent-purple-500"
                        />
                        <span className="truncate">{h.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {language === 'zh'
                    ? 'AI Agent 将自动保障 Etcd 3/3 法定仲裁，RoCEv2 MTU 9000 专网链路热切无断流。'
                    : 'AI Agent guarantees Etcd 3/3 quorum and non-disruptive RoCEv2 MTU 9000 link state.'}
                </span>
              </div>

              <button
                onClick={() => handleApplyVersionToFleet()}
                disabled={isApplyingVersion}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                {isApplyingVersion ? (
                  <RotateCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 text-amber-300" />
                )}
                <span>{t.btnApplyK8sVersion || '🚀 立即应用版本升级 (Apply Version Upgrade)'}</span>
                <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-200 text-[10px] font-mono">
                  {selectedTargetVersion}
                </span>
              </button>
            </div>
          </div>

          {/* Live Upgrade Progress Drawer / Simulator */}
          {upgradeProgress && (
            <div className="bg-slate-900 border border-purple-800/80 rounded-2xl p-5 space-y-4 shadow-xl bg-gradient-to-b from-purple-950/20 via-slate-900 to-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white">
                    <TrendingUp className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                      <span>{t.upgradeModalTitle || 'Kubernetes 节点版本无损滚动升级中枢'}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900 text-purple-200 border border-purple-700">
                        Target: {upgradeProgress.target_version}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {upgradeProgress.message}
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-xs text-purple-300 font-bold block">
                    {Math.min(upgradeProgress.active_step || 1, 5)}/5 Steps
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Policy: {upgradeProgress.policy}
                  </span>
                </div>
              </div>

              {/* Progress Steps Flow */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
                {[
                  { step: 1, title: language === 'zh' ? 'Etcd 法定仲裁检查' : 'Etcd Quorum Check', desc: 'Pre-flight' },
                  { step: 2, title: language === 'zh' ? 'Cordon & Drain 驱逐' : 'Cordon & Pod Drain', desc: 'Pod Eviction' },
                  { step: 3, title: language === 'zh' ? 'Talos 内核与 K8s 镜像流' : 'Stream Kernel & K8s', desc: 'Talos Pivot' },
                  { step: 4, title: language === 'zh' ? 'Kubelet 启动与 RoCEv2' : 'Kubelet & RoCEv2 Check', desc: 'Fabric Handshake' },
                  { step: 5, title: language === 'zh' ? 'Uncordon 恢复流量' : 'Uncordon Traffic', desc: 'Ready & Healthy' },
                ].map(s => {
                  const isCurrent = upgradeProgress.active_step === s.step;
                  const isDone = upgradeProgress.active_step > s.step;
                  return (
                    <div
                      key={s.step}
                      className={`p-2.5 rounded-xl border text-xs transition ${
                        isCurrent
                          ? 'bg-purple-950/80 border-purple-500 shadow-md shadow-purple-950/40 text-purple-200'
                          : isDone
                            ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold">STEP 0{s.step}</span>
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : isCurrent ? (
                          <RotateCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </div>
                      <div className="font-semibold text-[11px] truncate">{s.title}</div>
                      <div className="text-[10px] text-slate-400">{s.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Upgraded nodes summary pill list */}
              {upgradeProgress.target_nodes && upgradeProgress.target_nodes.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">Upgraded Nodes:</span>
                  {upgradeProgress.target_nodes.map((nodeName: string) => (
                    <span
                      key={nodeName}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-200 border border-purple-800 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      {nodeName} ({upgradeProgress.target_version})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Supported Kubernetes Versions Matrix (v1.33 ~ v1.36) Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                  {language === 'zh' ? '支持的 Kubernetes 版本列表 (点击卡片即可设为目标升级版本)' : 'Supported Kubernetes Versions (Click Card to Select)'}
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {k8sVersions.length} Versions Matrix
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {k8sVersions
                .filter(ver => {
                  if (versionFilterCategory === 'stable') return ver.channel === 'STABLE' || ver.channel === 'LATEST' || ver.channel === 'LTS';
                  if (versionFilterCategory === 'preview') return ver.channel === 'PREVIEW';
                  return true;
                })
                .map(ver => {
                  const isSelected = selectedTargetVersion === ver.version;
                  const isCurrentBaseline = activeCluster?.k8s_version === ver.version;

                  const badgeColor =
                    ver.badge_color === 'purple'
                      ? 'bg-purple-950 text-purple-300 border-purple-700'
                      : ver.badge_color === 'emerald'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : ver.badge_color === 'blue'
                          ? 'bg-blue-950 text-blue-300 border-blue-700'
                          : ver.badge_color === 'cyan'
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                            : 'bg-amber-950 text-amber-300 border-amber-700';

                  const featuresList = language === 'zh' ? (ver.features_zh || ver.features_en || []) : (ver.features_en || ver.features_zh || []);

                  return (
                    <div
                      key={ver.version}
                      onClick={() => setSelectedTargetVersion(ver.version)}
                      className={`border rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                        isSelected
                          ? 'bg-slate-900 border-purple-500 shadow-xl shadow-purple-950/40 ring-2 ring-purple-500/50'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      {/* Top selection indicator */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold font-mono text-white tracking-tight">
                              {ver.version}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badgeColor}`}>
                              {language === 'zh' ? ver.status_zh : ver.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Release: <span className="text-slate-300 font-mono">{ver.release_date}</span>
                          </div>
                        </div>

                        {/* Radio selection check */}
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-700 bg-slate-950'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>

                      {/* Hardware / Runtime Compatibility Details */}
                      <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 mb-3 space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">{t.lblDRAEngine || 'DRA 动态分配:'}</span>
                          <span className="text-cyan-300 font-bold truncate max-w-[160px] text-right">{ver.dra_version}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">{t.lblRoCEOptimization || 'RoCEv2 优化:'}</span>
                          <span className="text-emerald-400 font-bold">
                            {ver.roce_optimized ? (language === 'zh' ? '已优化 (200G RDMA)' : 'Optimized (200G RDMA)') : 'Standard TCP'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">{t.lblTalosBase || '最低 Talos:'}</span>
                          <span className="text-purple-300 font-bold">{ver.talos_linux}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">{t.lblContainerRuntime || 'Containerd:'}</span>
                          <span className="text-slate-300">{ver.containerd_version}</span>
                        </div>
                      </div>

                      {/* Feature Highlights */}
                      <div className="space-y-1.5 mb-4">
                        <span className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase block">
                          {t.versionFeaturesTitle || '关键特性与超算优化'}
                        </span>
                        <ul className="space-y-1 text-[11px] text-slate-300">
                          {featuresList.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-purple-400 font-bold">›</span>
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Bottom Quick Apply Action */}
                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                        {isCurrentBaseline ? (
                          <span className="text-xs text-emerald-400 font-mono font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {language === 'zh' ? '当前集群基线版本' : 'Current Baseline'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {ver.recommended_for}
                          </span>
                        )}

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedTargetVersion(ver.version);
                            handleApplyVersionToFleet(ver.version);
                          }}
                          disabled={isApplyingVersion}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          }`}
                        >
                          <Zap className="w-3 h-3 text-amber-300" />
                          <span>{language === 'zh' ? '立即应用此版本' : 'Apply Version'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Fleet Node Matrix Table (Every Node's Current Version & Quick Apply) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden space-y-0">
            <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold font-mono text-white tracking-wide uppercase">
                  {language === 'zh' ? '物理机节点版本状态明细矩阵 (Fleet Node Version Status)' : 'Fleet Node Version Status Matrix'}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {hosts.length} BareMetal Nodes
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2.5 px-4">NODE NAME</th>
                    <th className="py-2.5 px-3">ROLE</th>
                    <th className="py-2.5 px-3">CURRENT K8S</th>
                    <th className="py-2.5 px-3">DRA / ROCEV2</th>
                    <th className="py-2.5 px-3">UPGRADE STATUS</th>
                    <th className="py-2.5 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {hosts.map(h => {
                    const isGpu = h.assigned_role === 'worker-gpu';
                    const isMaster = h.assigned_role === 'control-plane';
                    return (
                      <tr key={h.name} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-white block">{h.name}</span>
                          <span className="text-[10px] text-slate-400 font-sans">{h.rack_location}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium border ${
                            isMaster
                              ? 'bg-purple-950 text-purple-300 border-purple-800'
                              : isGpu
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-blue-950 text-blue-300 border-blue-800'
                          }`}>
                            {h.assigned_role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                            {h.k8s_version || 'v1.31.2'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {isGpu ? (
                            <span className="text-emerald-400 font-medium">8x H100 (RoCEv2 200G)</span>
                          ) : (
                            <span className="text-slate-500">Standard CPU (100G)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            h.upgrade_status === 'HEALTHY_VERIFIED'
                              ? 'bg-emerald-950 text-emerald-300'
                              : h.upgrade_status && h.upgrade_status !== 'IDLE'
                                ? 'bg-amber-950 text-amber-300 animate-pulse'
                                : 'bg-slate-800 text-slate-400'
                          }`}>
                            {h.upgrade_status || 'IDLE'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleApplyVersionToSingleNode(h.name)}
                            disabled={isApplyingVersion}
                            className="px-2.5 py-1 rounded bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 text-xs font-sans transition cursor-pointer"
                            title={`Apply ${selectedTargetVersion} to ${h.name}`}
                          >
                            {language === 'zh' ? `应用 ${selectedTargetVersion}` : `Apply ${selectedTargetVersion}`}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- NODE DETAILS & SERIAL-OVER-LAN (SOL) MODAL DRAWER --- */}
      {/* ========================================================================= */}
      {selectedHost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold font-mono text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-400" />
                    {selectedHost.name}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {selectedHost.rack_location}
                  </span>
                  <span className="text-xs text-indigo-300 font-medium">
                    ({language === 'zh' ? '节点详情与带外控制台' : 'Node Details & OOB Console'})
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      selectedHost.power_status === 'ON'
                        ? 'bg-emerald-950 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedHost.power_status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  BMC: <span className="font-mono text-slate-200">{selectedHost.bmc_address}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedHost(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Sensors Bar */}
              {selectedHost.sensors && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    {language === 'zh' ? 'Redfish 带外传感器与健康度遥测' : 'Redfish OOB Sensors Telemetry'}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="text-[10px] text-slate-500 block">{t.sensorCpuTemp}</span>
                      <span className="text-lg font-bold text-amber-400 flex items-center gap-1.5 mt-1">
                        <Flame className="w-4 h-4" />
                        {selectedHost.sensors.cpu_temp_c}°C
                      </span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="text-[10px] text-slate-500 block">{t.sensorFanSpeed}</span>
                      <span className="text-lg font-bold text-cyan-400 flex items-center gap-1.5 mt-1">
                        <Activity className="w-4 h-4" />
                        {selectedHost.sensors.fan_speed_rpm.toLocaleString()} RPM
                      </span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="text-[10px] text-slate-500 block">{t.sensorPsuPower}</span>
                      <span className="text-lg font-bold text-yellow-400 flex items-center gap-1.5 mt-1">
                        <Zap className="w-4 h-4" />
                        {selectedHost.sensors.power_watts} W
                      </span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="text-[10px] text-slate-500 block">{t.sensorSystemHealth}</span>
                      <span className="text-lg font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
                        <CheckCircle2 className="w-4 h-4" />
                        {selectedHost.sensors.system_health}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 font-mono space-y-1">
                    <div>DIMM Status: {selectedHost.sensors.dimm_status}</div>
                    <div>NVMe Health: {selectedHost.sensors.nvme_smart_health}</div>
                  </div>
                </div>
              )}

              {/* IP Addresses */}
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {language === 'zh' ? '网络接口与 IP 分配' : 'Network Interfaces & IP Configuration'}
                </h3>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">BMC Out-of-Band (VLAN 100):</span>
                    <span className="text-white font-bold">{selectedHost.ip_addresses?.bmc_ip}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">iPXE Provisioning (VLAN 101):</span>
                    <span className="text-cyan-400 font-bold">{selectedHost.ip_addresses?.provisioning_ip}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Target Kubernetes Node IP:</span>
                    <span className="text-emerald-400 font-bold">
                      {selectedHost.ip_addresses?.target_ip || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Boot MAC:</span>
                    <span className="text-slate-300">{selectedHost.boot_mac_address}</span>
                  </div>
                </div>
              </div>

              {/* Serial-Over-LAN Console (SOL) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>
                      {language === 'zh'
                        ? '重定向裸机串口日志 (Serial-Over-LAN /dev/ttyS0)'
                        : 'Redirected Serial Console (SOL /dev/ttyS0)'}
                    </span>
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Baud: 115200 8N1</span>
                </div>

                <div className="bg-[#080c14] border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-400 space-y-1.5 max-h-56 overflow-y-auto">
                  {selectedHost.serial_console_recent?.map((line, i) => (
                    <div key={i} className="leading-relaxed">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
              {/* Real-time Redfish Telemetry Panel (Pure Go Engine) */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold font-mono text-white">
                      {language === 'zh' ? 'Redfish 深度物理硬件遥测 (Go 控制面直通)' : 'Redfish Deep Hardware Telemetry (Go Direct)'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleFetchHostTelemetry(selectedHost.name)}
                    disabled={fetchingTelemetry}
                    className="px-2.5 py-1 rounded bg-cyan-950 border border-cyan-800 hover:bg-cyan-900 text-cyan-300 text-[11px] font-mono flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${fetchingTelemetry ? 'animate-spin' : ''}`} />
                    <span>{fetchingTelemetry ? 'Querying...' : (language === 'zh' ? '探针轮询' : 'Probe')}</span>
                  </button>
                </div>

                {hostTelemetry ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono pt-1">
                    <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block">PCIe Link Speed</span>
                      <span className="text-cyan-300 font-bold">{hostTelemetry.pcie_link_speed}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block">PSU Efficiency</span>
                      <span className="text-emerald-400 font-bold">{hostTelemetry.psu_efficiency}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block">NVLink Bandwidth</span>
                      <span className="text-amber-300 font-bold">{hostTelemetry.nvlink_bandwidth}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block">RoCEv2 GID</span>
                      <span className="text-indigo-300 font-bold text-[10px] truncate block">{hostTelemetry.roce_gid}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 font-mono py-1">
                    {language === 'zh' ? '点击“探针轮询”获取实时 PCIe Gen5、PSU 钛金能效与 NVLink 带宽状态。' : 'Click "Probe" to query live PCIe Gen5, 80 PLUS Titanium PSU, and NVLink bus status.'}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    handlePowerAction(selectedHost.name, selectedHost.power_status === 'ON' ? 'off' : 'on');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium cursor-pointer"
                >
                  {selectedHost.power_status === 'ON' ? 'Power OFF' : 'Power ON'}
                </button>
                <button
                  onClick={() => handlePowerAction(selectedHost.name, 'reboot')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium cursor-pointer"
                >
                  Reboot
                </button>
                <button
                  onClick={() => handleInspectHost(selectedHost.name)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium cursor-pointer"
                >
                  Trigger Inspection
                </button>
                <button
                  onClick={() => handleReprovisionHost(selectedHost.name)}
                  disabled={reprovisioningHost}
                  className="px-3 py-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 text-xs font-semibold cursor-pointer"
                >
                  {reprovisioningHost ? 'Provisioning...' : (language === 'zh' ? '🔄 触发带外重镜像' : '🔄 Reprovision Host')}
                </button>
                {selectedHost.provisioning_status === 'ActiveInCluster' && selectedHost.assigned_role !== 'control-plane' && (
                  <button
                    onClick={() => {
                      const name = selectedHost.name;
                      setSelectedHost(null);
                      handleDrainNode(name);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 text-xs font-semibold cursor-pointer"
                  >
                    {t.btnDrainNode}
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedHost(null);
                  setHostTelemetry(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold cursor-pointer"
              >
                {t.btnClose}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- ELASTIC SCALING MODAL (SCALE UP / SCALE DOWN) --- */}
      {/* ========================================================================= */}
      {showScaleModal && activeCluster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setShowScaleModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{t.modalScaleTitle}</h3>
                <p className="text-xs text-slate-400">
                  {language === 'zh'
                    ? '由引导节点 AI Agent 编排裸机 iPXE 镜像装机 (扩容) 或 Cordon & Drain (缩容)'
                    : 'AI Agent orchestrates baremetal iPXE imaging (scale-up) or safe cordon & drain (scale-down)'}
                </p>
              </div>
            </div>

            <form onSubmit={handleScaleCluster} className="space-y-4 mt-5">
              {/* Current cluster scale summary */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono flex items-center justify-between">
                <span className="text-slate-400">{language === 'zh' ? '当前运行规模:' : 'Current Scale:'}</span>
                <span className="text-white font-bold">
                  {activeCluster?.scale?.control_plane_nodes ?? activeCluster?.control_plane_nodes ?? 3} Masters + {activeCluster?.scale?.worker_nodes ?? activeCluster?.worker_nodes ?? 7} Workers ({activeCluster?.scale?.gpu_nodes ?? activeCluster?.worker_nodes ?? 7} GPUs)
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    {language === 'zh' ? '目标 Worker 计算节点数' : 'Target Worker Nodes'}
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-400">{scaleTargetWorkers} Nodes</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="128"
                  value={scaleTargetWorkers}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setScaleTargetWorkers(val);
                    if (val < scaleTargetGpuNodes) setScaleTargetGpuNodes(val);
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                  <span>Min: 4 Nodes</span>
                  <span>Max: 128 Nodes</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    {language === 'zh' ? '其中 NVIDIA H100 GPU 节点数' : 'Of which NVIDIA H100 Supernodes'}
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {scaleTargetGpuNodes} Nodes ({scaleTargetGpuNodes * 8} GPUs)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.min(scaleTargetWorkers, 64)}
                  value={scaleTargetGpuNodes}
                  onChange={e => setScaleTargetGpuNodes(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Delta Preview */}
              <div className="p-3 rounded-lg border bg-slate-950/70 border-slate-800 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400">{language === 'zh' ? '扩缩容变动:' : 'Scale Delta:'}</span>
                  {scaleTargetWorkers > (activeCluster?.scale?.worker_nodes ?? activeCluster?.worker_nodes ?? 7) ? (
                    <span className="font-mono font-bold text-cyan-400 flex items-center gap-1">
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      +{scaleTargetWorkers - (activeCluster?.scale?.worker_nodes ?? activeCluster?.worker_nodes ?? 7)} Workers (Scale-Up)
                    </span>
                  ) : scaleTargetWorkers < (activeCluster?.scale?.worker_nodes ?? activeCluster?.worker_nodes ?? 7) ? (
                    <span className="font-mono font-bold text-amber-400 flex items-center gap-1">
                      <ArrowDownCircle className="w-3.5 h-3.5" />
                      -{(activeCluster?.scale?.worker_nodes ?? activeCluster?.worker_nodes ?? 7) - scaleTargetWorkers} Workers (Scale-Down)
                    </span>
                  ) : (
                    <span className="font-mono text-slate-400">No Scale Change</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-2 space-y-1">
                  <div className="font-semibold text-slate-300">
                    {t.scaleFlowTitle}
                  </div>
                  {scaleTargetWorkers >= (activeCluster?.scale?.worker_nodes ?? activeCluster?.worker_nodes ?? 7) ? (
                    <>
                      <div>{t.scaleUpStep1}</div>
                      <div>{t.scaleUpStep2}</div>
                      <div>{t.scaleUpStep3}</div>
                    </>
                  ) : (
                    <>
                      <div>{t.scaleDownStep1}</div>
                      <div>{t.scaleDownStep2}</div>
                      <div>{t.scaleDownStep3}</div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowScaleModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={scalingCluster}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
                >
                  {scalingCluster ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{scalingCluster ? t.scalingUp : t.btnConfirmScale}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- IN-PLACE ROLLING UPGRADE MODAL --- */}
      {/* ========================================================================= */}
      {showUpgradeModal && activeCluster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center text-white">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{t.modalUpgradeTitle}</h3>
                <p className="text-xs text-slate-400">
                  {language === 'zh'
                    ? '由引导节点 AI Agent 编排无中断热升级，保障 stacked etcd 仲裁与 GPU 业务零掉线'
                    : 'AI Agent orchestrates in-place rolling upgrade preserving etcd quorum & GPU workloads'}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpgradeCluster} className="space-y-4 mt-5">
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] text-slate-500 block mb-1">
                    {language === 'zh' ? '当前运行版本' : 'Current Version'}
                  </span>
                  <span className="text-base font-bold text-slate-300">{activeCluster.k8s_version}</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] text-slate-500 block mb-1">
                    {language === 'zh' ? '目标升级版本' : 'Target Version'}
                  </span>
                  <select
                    value={upgradeTargetVersion}
                    onChange={e => setUpgradeTargetVersion(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-purple-300 focus:outline-none font-mono"
                  >
                    {k8sVersions.map(v => (
                      <option key={v.version} value={v.version}>
                        {v.version} ({language === 'zh' ? v.status_zh : v.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Policy Selector in Modal */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] text-slate-500 block mb-1">
                    {t.lblUpgradePolicy || '升级策略'}
                  </span>
                  <select
                    value={upgradePolicy}
                    onChange={e => setUpgradePolicy(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-semibold text-slate-200 focus:outline-none"
                  >
                    <option value="rolling">Safe Rolling (逐台)</option>
                    <option value="canary">Canary Rollout (金丝雀)</option>
                    <option value="batch">Batch Parallel (并发2台)</option>
                  </select>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 block mb-1">
                    {language === 'zh' ? '全矩阵编排' : 'Full Matrix'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUpgradeModal(false);
                      setActiveSubTab('versions');
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 underline text-left font-sans cursor-pointer"
                  >
                    {language === 'zh' ? '打开多版本编排矩阵 ↗' : 'Open Matrix Hub ↗'}
                  </button>
                </div>
              </div>

              {/* Pre-flight Checks */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-2">
                <div className="font-semibold text-slate-300">
                  {language === 'zh' ? 'AI Agent 自动化前置预检 (Pre-Flight Checks):' : 'Pre-Flight Health Checks:'}
                </div>
                <div className="space-y-1 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Stacked etcd 3.5.x raft quorum: 3/3 Masters healthy (RTT &lt; 1ms)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Multus v4.1 + Calico v3.28 + OVS-DPDK + Multi-SR-IOV/DPDK CNI compatible with target API server</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>NVIDIA FabricManager & CUDA 12.4 daemonset validated</span>
                  </div>
                </div>
              </div>

              {/* Rolling Sequence Plan */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">
                  {t.upgradePlanTitle}
                </div>
                <div>{t.upgradeStep1}</div>
                <div>{t.upgradeStep2}</div>
                <div>{t.upgradeStep3}</div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={upgradingCluster}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30"
                >
                  {upgradingCluster ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{upgradingCluster ? t.upgrading : t.btnConfirmUpgrade}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- NEW CLUSTER DEPLOYMENT MODAL --- */}
      {/* ========================================================================= */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowDeployModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{t.btnDeployCluster}</h3>
                <p className="text-xs text-slate-400">
                  {t.modalDeployDesc}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateCluster} className="space-y-4 mt-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {language === 'zh' ? '目标集群名称' : 'Target Cluster Name'}
                </label>
                <input
                  type="text"
                  required
                  value={newClusterName}
                  onChange={e => setNewClusterName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {language === 'zh' ? 'Kubernetes 版本' : 'K8s Version'}
                  </label>
                  <select
                    value={newClusterK8sVer}
                    onChange={e => setNewClusterK8sVer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    {k8sVersions.map(v => (
                      <option key={v.version} value={v.version}>
                        {v.version} ({language === 'zh' ? v.status_zh : v.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {language === 'zh' ? '容器网络 CNI' : 'CNI Network Fabric'}
                  </label>
                  <select
                    value={newClusterCNI}
                    onChange={e => setNewClusterCNI(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Multus + Calico + OVS-DPDK + Multi-SR-IOV/DPDK">Multus + Calico + OVS-DPDK + Multi-SR-IOV/DPDK</option>
                    <option value="Multus + Calico + OVS-DPDK">Multus + Calico + OVS-DPDK</option>
                    <option value="Multus + Calico + Dual-SR-IOV (PF0 DPDK + PF1 RoCEv2)">Multus + Calico + Dual-SR-IOV (PF0 DPDK + PF1 RoCEv2)</option>
                    <option value="Calico BGP Overlay">Calico BGP Overlay</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t.haControlPlane}</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newClusterMasters}
                    onChange={e => setNewClusterMasters(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500">{t.etcdQuorumHint}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t.workerComputeNodes}</label>
                  <input
                    type="number"
                    min="1"
                    max="512"
                    value={newClusterWorkers}
                    onChange={e => setNewClusterWorkers(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500">{t.scaleUpToHint}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">GPU Supernodes</label>
                  <input
                    type="number"
                    min="0"
                    max="64"
                    value={newClusterGpuNodes}
                    onChange={e => setNewClusterGpuNodes(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-emerald-400 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-500">8x H100 SXM5 / Node</span>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">{t.pipelineAutomationDesc}</div>
                <div>{t.pipelineStep1}</div>
                <div>{t.pipelineStep2}</div>
                <div>{t.pipelineStep3}</div>
                <div>{t.pipelineStep4}</div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDeployModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={deployingCluster}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
                >
                  {deployingCluster ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{deployingCluster ? (language === 'zh' ? '部署流水线执行中...' : 'Deploying Pipeline...') : t.btnConfirmDeploy}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
