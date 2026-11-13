/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiRouter } from './api';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', apiRouter);
  return app;
}

test('Metal3 API: /metal3/status and /metal3/eph-node return bootstrap node and agent state', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    const statusRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.ok(statusBody.data);
    assert.equal(statusBody.data.eph_node.status, 'ONLINE');
    assert.equal(statusBody.data.eph_node.k8s_version, 'v1.31.2');
    assert.ok(statusBody.data.stats.total_bmh_hosts > 0);

    const ephRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/eph-node`);
    assert.equal(ephRes.status, 200);
    const ephBody = await ephRes.json();
    assert.equal(ephBody.data.role, 'SINGLE_NODE_BOOTSTRAP_K8S');
    assert.ok(ephBody.data.components.length >= 7);
    assert.equal(ephBody.data.agent_daemon.status, 'ACTIVE_AUTONOMOUS');
  } finally {
    server.close();
  }
});

test('Metal3 API: /metal3/bmh lists hosts and executes Redfish power actions', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    const bmhRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/bmh`);
    assert.equal(bmhRes.status, 200);
    const bmhBody = await bmhRes.json();
    assert.ok(Array.isArray(bmhBody.data));
    assert.ok(bmhBody.data.length >= 10);

    const targetHost = bmhBody.data[0];
    const pwrRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/bmh/${targetHost.name}/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reboot' }),
    });
    assert.equal(pwrRes.status, 200);
    const pwrBody = await pwrRes.json();
    assert.equal(pwrBody.success, true);
    assert.equal(pwrBody.data.power_status, 'REBOOTING');
  } finally {
    server.close();
  }
});

test('Metal3 API: creates target cluster and dispatches autonomous agent command', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    // 1. Dispatch custom command to eph-node agent
    const cmdRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/agent/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '巡检机房全部裸机 Redfish 带外硬件资产' }),
    });
    assert.equal(cmdRes.status, 200);
    const cmdBody = await cmdRes.json();
    assert.equal(cmdBody.success, true);
    assert.ok(cmdBody.data.decision);
    assert.ok(cmdBody.data.actions_taken.length > 0);

    // 2. Create target cluster
    const clRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/clusters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-h100-cluster-auto',
        k8s_version: 'v1.31.2',
        cni: 'Multus + Calico + OVS-DPDK + Multi-SR-IOV/DPDK',
        scale: {
          control_plane_nodes: 3,
          worker_nodes: 16,
          gpu_nodes: 16,
        },
      }),
    });
    assert.equal(clRes.status, 200);
    const clBody = await clRes.json();
    assert.equal(clBody.success, true);
    assert.equal(clBody.data.name, 'test-h100-cluster-auto');
    assert.equal(clBody.data.scale.total_nodes, 19);

    // 3. Trigger pivot
    const pivRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/clusters/${clBody.data.id}/pivot`, {
      method: 'POST',
    });
    assert.equal(pivRes.status, 200);
    const pivBody = await pivRes.json();
    assert.equal(pivBody.success, true);
  } finally {
    server.close();
  }
});

test('Metal3 API: provides agent live status, stream-filtered logs and baremetal host telemetry', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    // 1. Agent status endpoint
    const agRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/agent/status`);
    assert.equal(agRes.status, 200);
    const agBody = await agRes.json();
    assert.ok(agBody.data);
    assert.equal(agBody.data.status, 'ACTIVE_AUTONOMOUS');
    assert.ok(agBody.data.cpu_usage_percent > 0);
    assert.ok(agBody.data.memory_used_mb > 0);
    assert.equal(agBody.data.mtls_state, 'TLS_AES_256_GCM_SHA384_VERIFIED');

    // 2. Stream-filtered logs: agent, k8s-install, ironic-redirect
    const streamAgentRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/logs?stream=agent`);
    assert.equal(streamAgentRes.status, 200);
    const streamAgentBody = await streamAgentRes.json();
    assert.ok(Array.isArray(streamAgentBody.data));
    assert.ok(streamAgentBody.data.length > 0);
    assert.ok(streamAgentBody.data.every((l: any) => l.stream === 'agent'));

    const streamK8sRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/logs?stream=k8s-install`);
    assert.equal(streamK8sRes.status, 200);
    const streamK8sBody = await streamK8sRes.json();
    assert.ok(Array.isArray(streamK8sBody.data));
    assert.ok(streamK8sBody.data.length > 0);
    assert.ok(streamK8sBody.data.every((l: any) => l.stream === 'k8s-install'));

    const streamIroRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/logs?stream=ironic-redirect`);
    assert.equal(streamIroRes.status, 200);
    const streamIroBody = await streamIroRes.json();
    assert.ok(Array.isArray(streamIroBody.data));
    assert.ok(streamIroBody.data.length > 0);
    assert.ok(streamIroBody.data.every((l: any) => l.stream === 'ironic-redirect'));

    // 3. Single host details with IP addresses, sensors, and SOL console logs
    const hostRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/bmh/bmh-gpu-supernode-01`);
    assert.equal(hostRes.status, 200);
    const hostBody = await hostRes.json();
    assert.ok(hostBody.data);
    assert.ok(hostBody.data.ip_addresses.bmc_ip);
    assert.ok(hostBody.data.ip_addresses.provisioning_ip);
    assert.ok(hostBody.data.sensors.cpu_temp_c > 0);
    assert.ok(hostBody.data.sensors.fan_speed_rpm > 0);
    assert.ok(Array.isArray(hostBody.data.serial_console_recent));
    assert.ok(hostBody.data.serial_console_recent.length > 0);
  } finally {
    server.close();
  }
});

test('Metal3 API: AI Agent orchestrates cluster scale up, scale down, and rolling version upgrade', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    const clusterId = 'cluster_ai_superpod_01';

    // 1. Scale Up: Expand worker nodes
    const scaleUpRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/clusters/${clusterId}/scale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_nodes: 72, gpu_nodes: 64 }),
    });
    assert.equal(scaleUpRes.status, 200);
    const scaleUpBody = await scaleUpRes.json();
    assert.equal(scaleUpBody.success, true);
    assert.equal(scaleUpBody.data.scale.worker_nodes, 72);
    assert.equal(scaleUpBody.data.scale.gpu_nodes, 64);
    assert.equal(scaleUpBody.data.scale.total_nodes, 75);

    // 2. Scale Down Single Node: Cordon & Drain
    const drainRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/clusters/${clusterId}/scale-down-node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host_name: 'bmh-compute-worker-04' }),
    });
    assert.equal(drainRes.status, 200);
    const drainBody = await drainRes.json();
    assert.equal(drainBody.success, true);
    assert.equal(drainBody.data.host.provisioning_status, 'Available');
    assert.equal(drainBody.data.host.power_status, 'OFF');

    // 3. Cluster Version Rolling Upgrade
    const upgRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/clusters/${clusterId}/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_k8s_version: 'v1.33.0' }),
    });
    assert.equal(upgRes.status, 200);
    const upgBody = await upgRes.json();
    assert.equal(upgBody.success, true);
    assert.equal(upgBody.data.k8s_version, 'v1.33.0');
  } finally {
    server.close();
  }
});


test('Metal3 API: applies supported Kubernetes versions and rejects unsupported targets', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    const clusterId = 'cluster_ai_superpod_01';

    for (const targetVersion of ['v1.35.0', 'v1.36.0']) {
      const response = await fetch('http://127.0.0.1:' + port + '/api/v1/metal3/clusters/' + clusterId + '/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_k8s_version: targetVersion }),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.success, true);
      assert.equal(body.data.k8s_version, targetVersion);
    }

    const unsupportedResponse = await fetch(
      'http://127.0.0.1:' + port + '/api/v1/metal3/clusters/' + clusterId + '/upgrade',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_k8s_version: 'v1.34.0' }),
      }
    );
    assert.equal(unsupportedResponse.status, 400);
    const unsupportedBody = await unsupportedResponse.json();
    assert.equal(unsupportedBody.error.code, 'UNSUPPORTED_KUBERNETES_VERSION');

    const downgradeResponse = await fetch(
      'http://127.0.0.1:' + port + '/api/v1/metal3/clusters/' + clusterId + '/upgrade',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_k8s_version: 'v1.33.0' }),
      }
    );
    assert.equal(downgradeResponse.status, 400);
    const downgradeBody = await downgradeResponse.json();
    assert.equal(downgradeBody.error.code, 'INVALID_KUBERNETES_VERSION_TRANSITION');
  } finally {
    server.close();
  }
});

test('Metal3 API: Kubernetes Version Matrix & Fleet Node Version Selector (v1.33 ~ v1.36)', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    // 1. GET /api/v1/metal3/k8s-versions
    const verRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/k8s-versions`);
    assert.equal(verRes.status, 200);
    const verBody = await verRes.json();
    assert.equal(verBody.success, true);
    assert.ok(Array.isArray(verBody.data));
    assert.ok(verBody.data.length >= 7);

    // Verify presence of bleeding-edge v1.36.0-dev, production v1.35.0, enterprise v1.33.2
    const v136 = verBody.data.find((v: any) => v.version === 'v1.36.0-dev');
    const v135 = verBody.data.find((v: any) => v.version === 'v1.35.0');
    const v133 = verBody.data.find((v: any) => v.version === 'v1.33.2');
    assert.ok(v136, 'Must support v1.36.0-dev');
    assert.ok(v135, 'Must support v1.35.0');
    assert.ok(v136.dra_version);
    assert.ok(v135.roce_optimized);

    // 2. POST /api/v1/metal3/clusters/:id/upgrade to v1.35.0 with policy 'rolling'
    const clusterId = 'cluster_ai_superpod_01';
    const upgradeRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/clusters/${clusterId}/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_k8s_version: 'v1.35.0',
        policy: 'rolling',
        drain_timeout: 300,
      }),
    });
    assert.equal(upgradeRes.status, 200);
    const upgradeBody = await upgradeRes.json();
    assert.equal(upgradeBody.success, true);
    assert.equal(upgradeBody.data.k8s_version, 'v1.35.0');
    assert.equal(upgradeBody.policy, 'rolling');

    // 3. POST /api/v1/metal3/nodes/version-apply for single node v1.36.0-dev
    const nodeApplyRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/nodes/version-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_name: 'bmh-gpu-supernode-01',
        target_k8s_version: 'v1.36.0-dev',
        policy: 'canary',
        drain_timeout: 180,
      }),
    });
    assert.equal(nodeApplyRes.status, 200);
    const nodeApplyBody = await nodeApplyRes.json();
    assert.equal(nodeApplyBody.success, true);
    assert.equal(nodeApplyBody.data.host.name, 'bmh-gpu-supernode-01');
    assert.equal(nodeApplyBody.data.host.k8s_version, 'v1.36.0-dev');
    assert.equal(nodeApplyBody.data.host.upgrade_status, 'HEALTHY_VERIFIED');

    // 4. GET /api/v1/metal3/clusters/:id/upgrade-status
    const statusRes = await fetch(`http://127.0.0.1:${port}/api/v1/metal3/clusters/${clusterId}/upgrade-status`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.success, true);
    assert.equal(statusBody.data.steps.length, 5);
    assert.equal(statusBody.data.current_version, 'v1.35.0');
  } finally {
    server.close();
  }
});

