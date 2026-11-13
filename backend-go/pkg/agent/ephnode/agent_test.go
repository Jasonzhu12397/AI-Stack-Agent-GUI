package ephnode

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestEphNodeAgentLifecycle(t *testing.T) {
	cfg := AgentConfig{
		AgentID:           "test-agent-eph-01",
		PodName:           "test-pod-eph",
		Namespace:         "metal3-test",
		NodeName:          "test-node-01",
		ProbePort:         18081,
		HeartbeatInterval: 100 * time.Millisecond,
	}

	agent := New(cfg)
	if agent == nil {
		t.Fatal("expected agent not to be nil")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	agent.Start(ctx)

	// Verify telemetry
	telem := agent.GetTelemetry()
	if telem["role"] != "EPH_BOOTSTRAP_AGENT" {
		t.Errorf("unexpected role: %v", telem["role"])
	}
	if telem["status"] != "ONLINE" {
		t.Errorf("expected status ONLINE, got: %v", telem["status"])
	}

	// Dispatch commands
	out, err := agent.DispatchCommand("INSPECT_INVENTORY")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "15 BareMetalHosts verified") {
		t.Errorf("unexpected command output: %s", out)
	}

	out, err = agent.DispatchCommand("TRIGGER_CP01_BOOT")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "VirtualMedia ISO attached") {
		t.Errorf("unexpected command output: %s", out)
	}

	agent.Stop()
	telem = agent.GetTelemetry()
	if telem["status"] != "STOPPED" {
		t.Errorf("expected status STOPPED, got: %v", telem["status"])
	}
}

func TestDHCPMonitorParser(t *testing.T) {
	monitor := NewDHCPMonitor("")
	line := "1731234567 b4:96:91:1a:00:01 10.240.10.10 bmh-master-k8s-01 id-01"
	lease, err := monitor.ParseLeaseLine(line)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if lease.MAC != "b4:96:91:1a:00:01" {
		t.Errorf("expected mac b4:96:91:1a:00:01, got %s", lease.MAC)
	}
	if lease.IP != "10.240.10.10" {
		t.Errorf("expected ip 10.240.10.10, got %s", lease.IP)
	}
	if lease.Hostname != "bmh-master-k8s-01" {
		t.Errorf("expected hostname bmh-master-k8s-01, got %s", lease.Hostname)
	}
}
