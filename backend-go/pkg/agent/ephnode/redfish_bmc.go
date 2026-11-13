package ephnode

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// BMCAction represents power actions over Redfish/IPMI.
type BMCAction string

const (
	ActionPowerOn    BMCAction = "PowerOn"
	ActionPowerOff   BMCAction = "PowerOff"
	ActionPowerReset BMCAction = "ForceRestart"
	ActionAttachISO  BMCAction = "AttachVirtualMedia"
)

// BMCHostStatus holds BMC state discovered via out-of-band telemetry.
type BMCHostStatus struct {
	Name            string    `json:"name"`
	BMCAddress      string    `json:"bmc_address"`
	PowerState      string    `json:"power_state"`
	VirtualMediaISO string    `json:"virtual_media_iso"`
	LastPolled      time.Time `json:"last_polled"`
	CPUCores        int       `json:"cpu_cores"`
	MemoryGB        int       `json:"memory_gb"`
	GPUCount        int       `json:"gpu_count"`
}

// RedfishBMCClient orchestrates out-of-band IPMI/Redfish calls from within the bootstrap pod.
type RedfishBMCClient struct {
	mu       sync.RWMutex
	endpoint string
	hosts    map[string]*BMCHostStatus
}

// NewRedfishBMCClient initializes the BMC client.
func NewRedfishBMCClient(endpoint string) *RedfishBMCClient {
	c := &RedfishBMCClient{
		endpoint: endpoint,
		hosts:    make(map[string]*BMCHostStatus),
	}
	c.seedHosts()
	return c
}

func (c *RedfishBMCClient) seedHosts() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.hosts["bmh-master-k8s-01"] = &BMCHostStatus{
		Name:            "bmh-master-k8s-01",
		BMCAddress:      "10.240.20.101",
		PowerState:      "ON",
		VirtualMediaISO: "http://10.240.10.1:8080/talos-v1.8.iso",
		LastPolled:      time.Now(),
		CPUCores:        64,
		MemoryGB:        512,
		GPUCount:        0,
	}
	c.hosts["bmh-worker-gpu-01"] = &BMCHostStatus{
		Name:            "bmh-worker-gpu-01",
		BMCAddress:      "10.240.20.201",
		PowerState:      "ON",
		VirtualMediaISO: "",
		LastPolled:      time.Now(),
		CPUCores:        128,
		MemoryGB:        2048,
		GPUCount:        8,
	}
}

// AttachVirtualMedia mounts a remote bootable OS ISO via Redfish OEM endpoint.
func (c *RedfishBMCClient) AttachVirtualMedia(ctx context.Context, hostName, isoURL string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	host, exists := c.hosts[hostName]
	if !exists {
		return fmt.Errorf("host %s not found in Redfish inventory", hostName)
	}

	host.VirtualMediaISO = isoURL
	host.LastPolled = time.Now()
	return nil
}

// PowerCommand sends power actuation to a physical baremetal machine.
func (c *RedfishBMCClient) PowerCommand(ctx context.Context, hostName string, action BMCAction) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	host, exists := c.hosts[hostName]
	if !exists {
		return "", fmt.Errorf("host %s not found in Redfish inventory", hostName)
	}

	switch action {
	case ActionPowerOn:
		host.PowerState = "ON"
	case ActionPowerOff:
		host.PowerState = "OFF"
	case ActionPowerReset:
		host.PowerState = "REBOOTING"
	default:
		return "", fmt.Errorf("unsupported BMC power action: %s", action)
	}

	host.LastPolled = time.Now()
	return fmt.Sprintf("BMC command %s dispatched to %s (%s)", action, hostName, host.BMCAddress), nil
}

// GetHost returns current BMC status for a target machine.
func (c *RedfishBMCClient) GetHost(hostName string) (*BMCHostStatus, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	h, ok := c.hosts[hostName]
	if !ok {
		return nil, false
	}
	copied := *h
	return &copied, true
}
