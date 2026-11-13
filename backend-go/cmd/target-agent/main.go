package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/agent/target"
)

func main() {
	log.Println("=================================================================")
	log.Println("  METAL3 TARGET CLUSTER LIFECYCLE AGENT (POD DAEMON - AGENT 2)")
	log.Println("  Version: v2.4.0-capm3-target (Pure Go 1.22+ Runtime)")
	log.Println("=================================================================")

	podName := os.Getenv("POD_NAME")
	if podName == "" {
		podName = "capm3-target-agent-pod-9c44ab"
	}
	namespace := os.Getenv("POD_NAMESPACE")
	if namespace == "" {
		namespace = "capi-system"
	}
	nodeName := os.Getenv("NODE_NAME")
	if nodeName == "" {
		nodeName = "edge-cp-01"
	}
	coordURL := os.Getenv("COORDINATOR_URL")
	if coordURL == "" {
		coordURL = "http://10.240.10.1:9090"
	}
	probePort := 8082

	cfg := target.AgentConfig{
		AgentID:           "agent-target-cluster-02",
		PodName:           podName,
		Namespace:         namespace,
		NodeName:          nodeName,
		KubeconfigPath:    "/etc/kubernetes/admin.conf",
		MultusConfigPath:  "/etc/cni/net.d/00-multus.conf",
		ProbePort:         probePort,
		HeartbeatInterval: 4 * time.Second,
		CoordinatorURL:    coordURL,
	}

	agent := target.New(cfg)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	agent.Start(ctx)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	log.Printf("[Target-Agent Pod %s] Daemon active in namespace %s. Orchestrating Multi-CNI mesh and CAPI MachinePool reconciler...", podName, namespace)

	select {
	case sig := <-sigChan:
		log.Printf("[Target-Agent Pod %s] Received termination signal: %v. Initiating graceful handover and checkpoint save...", podName, sig)
		agent.Stop()
	}

	fmt.Println("[Target-Agent Pod] Shutdown completed cleanly.")
}
