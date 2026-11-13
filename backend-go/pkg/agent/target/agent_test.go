package target

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestTargetClusterAgentLifecycle(t *testing.T) {
	cfg := AgentConfig{
		AgentID:           "test-agent-target-01",
		PodName:           "test-pod-target",
		Namespace:         "capi-test",
		ClusterID:         "test-cluster",
		ProbePort:         18082,
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
	if telem["role"] != "TARGET_CLUSTER_LIFECYCLE_AGENT" {
		t.Errorf("unexpected role: %v", telem["role"])
	}
	if telem["status"] != "ACTIVE" {
		t.Errorf("expected status ACTIVE, got: %v", telem["status"])
	}

	// Dispatch commands
	out, err := agent.DispatchCommand("VERIFY_ETCD_QUORUM")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "HEALTHY") {
		t.Errorf("expected healthy etcd quorum, got: %s", out)
	}

	out, err = agent.DispatchCommand("IGNITE_MULTI_CNI")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "Multi-CNI mesh converged") {
		t.Errorf("unexpected cni output: %s", out)
	}

	agent.Stop()
	telem = agent.GetTelemetry()
	if telem["status"] != "STOPPED" {
		t.Errorf("expected status STOPPED, got: %v", telem["status"])
	}
}

func TestEtcdVerifier(t *testing.T) {
	verifier := NewEtcdVerifier()
	report, err := verifier.VerifyQuorum(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !report.QuorumHealthy {
		t.Errorf("expected quorum to be healthy")
	}
	if report.ActiveMembers < 2 {
		t.Errorf("expected at least 2 active members, got %d", report.ActiveMembers)
	}
}
