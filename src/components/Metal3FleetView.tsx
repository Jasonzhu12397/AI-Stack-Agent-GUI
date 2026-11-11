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
  SUPPORTED_KUBERNETES_VERSIONS,
  isKubernetesVersionUpgrade,
  EphemeralBootstrapNode,
  TargetCluster,
  Metal3LogEvent,
  PowerStatus,
  ProvisioningStatus,
  LogStreamType,
  EphAgentTelemetry,
  HostAlert,
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
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'dualagent' | 'multicni' | 'omni' | 'terminal' | 'cluster' | 'fleet' | 'ephnode'>('dashboard');

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
  const [newClusterCNI, setNewClusterCNI] = useState<'Cilium eBPF (RoCEv2 + BGP mesh)' | 'Calico BGP'>('Cilium eBPF (RoCEv2 + BGP mesh)');
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
  const [upgradeTargetVersion, setUpgradeTargetVersion] = useState<string>(SUPPORTED_KUBERNETES_VERSIONS[0]);
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
      setRefreshing(true);
      const [ephRes, bmhRes, clRes, logsRes, agentRes, alertsRes, daRes, netRes, cniRes, omniRes, manRes] = await Promise.all([
        safeJsonFetch('/api/v1/metal3/eph-node'),
        safeJsonFetch('/api/v1/metal3/bmh'),
        safeJsonFetch('/api/v1/metal3/clusters'),
        safeJsonFetch('/api/v1/metal3/logs'),
        safeJsonFetch('/api/v1/metal3/agent/status'),
        safeJsonFetch('/api/v1/metal3/alerts'),
        safeJsonFetch('/api/v1/metal3/dual-agent/status'),
        safeJsonFetch('/api/v1/metal3/network/spec'),
        safeJsonFetch('/api/v1/metal3/cni/spec'),
        safeJsonFetch('/api/v1/metal3/omni/status'),
        safeJsonFetch('/api/v1/metal3/omni/manifests'),
      ]);

      if (ephRes?.data) setEphNode(ephRes.data);
      if (bmhRes?.data) {
        setHosts(bmhRes.data);
        if (selectedHost) {
          const updated = bmhRes.data.find((h: BareMetalHost) => h.name === selectedHost.name);
          if (updated) setSelectedHost(updated);
        }
      }
      if (clRes?.data) {
        setClusters(clRes.data);
        if (clRes.data[0]) {
          setScaleTargetWorkers(clRes.data[0].scale.worker_nodes);
          setScaleTargetGpuNodes(clRes.data[0].scale.gpu_nodes);
        }
      }
      if (logsRes?.data) setLogs(logsRes.data);
      if (agentRes?.data) setAgentTelemetry(agentRes.data);
      if (alertsRes?.data) setAlerts(alertsRes.data);
      if (daRes?.data) setDualAgent(daRes.data);
      if (netRes?.data) setDualNetwork(netRes.data);
      if (cniRes?.data) setMultiCNI(cniRes.data);
      if (omniRes?.data) setOmniProgress(omniRes.data);
      if (manRes?.manifests) {
        setOmniManifests(manRes.manifests);
        const keys = Object.keys(manRes.manifests);
        if (keys.length > 0 && !activeManifestKey) setActiveManifestKey(keys[0]);
      }
    } catch (err) {
      console.error('Failed to fetch metal3 data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
        'Autonomous Policy Check: Cilium BGP spine-leaf peering established with Top-of-Rack switch',
      ];

      const sampleK8sEvents = [
        'kubelet[2104]: [cgroup] cgroup v2 memory & pids limits synchronized across all pods',
        'stacked-etcd: raft leader heartbeat round-trip 0.8ms across 3 control plane masters',
        'cilium-agent: eBPF sockops program active; bypassing TCP/IP stack overhead for pod traffic',
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
        }),
      });

      if (res?.success) {
        setShowUpgradeModal(false);
        fetchMetal3Data();
      }
    } catch (err) {
      console.error('Upgrade failed:', err);
    } finally {
      setUpgradingCluster(false);
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
  const availableUpgradeVersions = activeCluster
    ? SUPPORTED_KUBERNETES_VERSIONS.filter(version =>
        isKubernetesVersionUpgrade(version, activeCluster.k8s_version)
      )
    : [];

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
              {ephNode?.ip_address} | {ephNode?.host_specs?.cpu.split(' ')[0]} Cores
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
              {activeCluster.scale.total_nodes} Nodes
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
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-white tracking-tight">{host.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {host.rack_location}
                            </span>
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
                          <span>Image: {host.boot_image.split('.')[0]}</span>
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
                              {host.rack_location} • {host.hardware.model.split(' ')[0]}
                            </div>
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
                'Cilium eBPF BGP Peer Mesh Verification',
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
                        ? '输入命令发送至远端 eph-node 运行 (例如: kubeadm token list, ironic node-list, cilium status)...'
                        : 'Type command to run on remote eph-node (e.g. kubeadm token list, ironic node-list, cilium status)...'
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
                    onClick={() => handleDispatchCommand('cilium status && cilium bpf tunnel list')}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                  >
                    cilium status
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
                    onClick={() => {
                      setUpgradeTargetVersion(availableUpgradeVersions[0] || '');
                      setShowUpgradeModal(true);
                    }}
                    disabled={availableUpgradeVersions.length === 0}
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
                    Multus v4.1 + Calico v3.28 + OVS v2.17 + SR-IOV v1.4
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
                    ? '4 种 CNI 融合协同工作矩阵 (Multus + Calico + OVS + SR-IOV)'
                    : '4-CNI Coexistence Operational Matrix'}
                </span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">All 4 Running Simultaneously</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* 1. Multus */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold font-mono text-purple-300 px-2 py-0.5 rounded bg-purple-950 border border-purple-800">
                      MULTUS CNI
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">ACTIVE</span>
                  </div>
                  <div className="text-xs font-bold text-white">Meta-Plugin Multi-NIC</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {language === 'zh'
                      ? '多网卡附着驱动，向每个 Pod 同时挂载主网卡与附加加速网卡'
                      : 'Meta-plugin attaching multiple NIC interfaces to single Pod container'}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <div>Dispatch: &lt; 0.1µs</div>
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
                    <span className="text-[10px] font-mono text-emerald-400">eth0 (Default)</span>
                  </div>
                  <div className="text-xs font-bold text-white">Default Primary Network</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {language === 'zh'
                      ? '默认主网络接口，处理 Pod-to-Pod 路由、BGP 对等与 NetworkPolicy'
                      : 'Default primary interface, handling BGP routing, Services, & NetworkPolicy'}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <div>Latency: ~12µs</div>
                  <div className="text-indigo-300">BGP Peering: 4/4 Connected</div>
                </div>
              </div>

              {/* 3. OVS */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold font-mono text-cyan-300 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                      OVS CNI
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400">net1 (br-data)</span>
                  </div>
                  <div className="text-xs font-bold text-white">Open vSwitch L2 Bridge</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {language === 'zh'
                      ? '二层虚拟交换网桥，支持动态 802.1Q VLAN 隔离与高速二层广播域'
                      : 'Layer 2 virtual switching bridge with dynamic VLAN trunking and isolation'}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <div>Latency: ~8µs</div>
                  <div className="text-cyan-300">Throughput: 98.4 Gbps</div>
                </div>
              </div>

              {/* 4. SR-IOV */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold font-mono text-amber-300 px-2 py-0.5 rounded bg-amber-950 border border-amber-800">
                      SR-IOV CNI
                    </span>
                    <span className="text-[10px] font-mono text-amber-400">net2 (Direct VF)</span>
                  </div>
                  <div className="text-xs font-bold text-white">Hardware VF + GPU RDMA</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {language === 'zh'
                      ? '物理网卡 Virtual Function 直通，GPU Direct RDMA 零内核拷贝'
                      : 'Mellanox ConnectX VF passthrough, kernel bypass, GPU Direct RDMA'}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <div>Latency: &lt; 1.2µs</div>
                  <div className="text-amber-300">Throughput: 198.7 Gbps Line-Rate</div>
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
                <span className="text-xs text-emerald-300 font-mono">All 4 Protocols Validated</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
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
                  <span className="text-slate-400 block mb-1">OVS L2 Bridge</span>
                  <span className="text-cyan-300 font-bold">{cniTestResults.ovs?.throughput}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">VLAN {cniTestResults.ovs?.vlan_tag} Tagged</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-slate-400 block mb-1">SR-IOV RoCEv2</span>
                  <span className="text-amber-300 font-bold">{cniTestResults.sriov?.latency_ms} ms (&lt;1.2µs)</span>
                  <span className="text-[10px] text-emerald-400 block mt-1">{cniTestResults.sriov?.gpu_direct}</span>
                </div>
              </div>
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

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={handleInstantOmniDeploy}
                  disabled={omniDeploying}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-600/30 transition cursor-pointer"
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
                  {omniProgress?.progress_percent || 100}% Complete
                </span>
              </div>
            </div>

            {/* Stepper Timeline List */}
            <div className="space-y-3">
              {(omniProgress?.steps || []).map((step: any, idx: number) => (
                <div
                  key={step.id || idx}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-white">
                          {language === 'zh' && step.name_zh ? step.name_zh : step.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {step.agent_source}
                        </span>
                      </div>
                      <p className="text-slate-400 mt-1 leading-relaxed">{step.detail}</p>
                    </div>
                  </div>

                  <div className="shrink-0 font-mono text-[11px] text-slate-400 flex md:flex-col items-end gap-1">
                    <span className="text-emerald-400 font-bold">{((step.duration_ms || 10000) / 1000).toFixed(1)}s</span>
                    <span className="text-[10px] text-slate-500">COMPLETED</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Declarative Manifests Suite */}
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyManifest(omniManifests[activeManifestKey] || '')}
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
                  onClick={() => setActiveManifestKey(key)}
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

            {/* Code Output Block */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-cyan-300 leading-relaxed">
                {omniManifests[activeManifestKey] || '# Select a manifest above to view YAML'}
              </pre>
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
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
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
                onClick={() => setSelectedHost(null)}
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
                  {activeCluster.scale.control_plane_nodes} Masters + {activeCluster.scale.worker_nodes} Workers ({activeCluster.scale.gpu_nodes} GPUs)
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
                  {scaleTargetWorkers > activeCluster.scale.worker_nodes ? (
                    <span className="font-mono font-bold text-cyan-400 flex items-center gap-1">
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      +{scaleTargetWorkers - activeCluster.scale.worker_nodes} Workers (Scale-Up)
                    </span>
                  ) : scaleTargetWorkers < activeCluster.scale.worker_nodes ? (
                    <span className="font-mono font-bold text-amber-400 flex items-center gap-1">
                      <ArrowDownCircle className="w-3.5 h-3.5" />
                      -{activeCluster.scale.worker_nodes - scaleTargetWorkers} Workers (Scale-Down)
                    </span>
                  ) : (
                    <span className="font-mono text-slate-400">No Scale Change</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-2 space-y-1">
                  <div className="font-semibold text-slate-300">
                    {t.scaleFlowTitle}
                  </div>
                  {scaleTargetWorkers >= activeCluster.scale.worker_nodes ? (
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
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-purple-300 focus:outline-none"
                  >
                    {availableUpgradeVersions.map(version => (
                      <option key={version} value={version}>
                        {version.replace(/\.0$/, '')} ({language === 'zh' ? '支持版本' : 'Supported'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {availableUpgradeVersions.length === 0 && (
                <p className="text-xs text-amber-400">
                  {language === 'zh'
                    ? '当前集群已处于最高支持版本，没有可用的升级目标。'
                    : 'The cluster is already at the highest supported version. No upgrade target is available.'}
                </p>
              )}

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
                    <span>Cilium eBPF CNI v1.16 host-routing compatible with target API server</span>
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
                  disabled={upgradingCluster || !availableUpgradeVersions.includes(upgradeTargetVersion as typeof SUPPORTED_KUBERNETES_VERSIONS[number])}
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
                    <option value="v1.31.2">v1.31.2 (Stable Production)</option>
                    <option value="v1.30.5">v1.30.5 (Enterprise LTS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {language === 'zh' ? '容器网络 CNI' : 'CNI Network Fabric'}
                  </label>
                  <select
                    value={newClusterCNI}
                    onChange={e => setNewClusterCNI(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Cilium eBPF (RoCEv2 + BGP mesh)">Cilium eBPF (RoCEv2 + BGP mesh)</option>
                    <option value="Calico BGP">Calico BGP Overlay</option>
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
