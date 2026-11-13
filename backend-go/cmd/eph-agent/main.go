package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/agent/ephnode"
)

func main() {
	log.Println("=================================================================")
	log.Println("  METAL3 EPH-NODE BOOTSTRAP AGENT (POD DAEMON - AGENT 1)")
	log.Println("  Version: v2.4.0-metal3-bmo (Pure Go 1.22+ Runtime)")
	log.Println("=================================================================")

	podName := os.Getenv("POD_NAME")
	if podName == "" {
		podName = "metal3-eph-agent-daemon-7b89f4"
	}
	namespace := os.Getenv("POD_NAMESPACE")
	if namespace == "" {
		namespace = "metal3-system"
	}
	nodeName := os.Getenv("NODE_NAME")
	if nodeName == "" {
		nodeName = "eph-bootstrap-node-01"
	}
	coordURL := os.Getenv("COORDINATOR_URL")
	if coordURL == "" {
		coordURL = "http://10.240.10.1:9090"
	}
	probePort := 8081

	cfg := ephnode.AgentConfig{
		AgentID:           "agent-bootstrap-eph-01",
		PodName:           podName,
		Namespace:         namespace,
		NodeName:          nodeName,
		IronicEndpoint:    "http://10.240.10.1:6385/v1",
		DnsmasqLeaseFile:  "/var/lib/dnsmasq/dnsmasq.leases",
		ProbePort:         probePort,
		HeartbeatInterval: 4 * time.Second,
		CoordinatorURL:    coordURL,
	}

	agent := ephnode.New(cfg)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	agent.Start(ctx)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	log.Printf("[Eph-Agent Pod %s] Daemon active. Running hardware inspection and Ironic watchdog...", podName)

	select {
	case sig := <-sigChan:
		log.Printf("[Eph-Agent Pod %s] Received termination signal: %v. Initiating graceful shutdown...", podName, sig)
		agent.Stop()
	}

	fmt.Println("[Eph-Agent Pod] Shutdown completed cleanly.")
}
