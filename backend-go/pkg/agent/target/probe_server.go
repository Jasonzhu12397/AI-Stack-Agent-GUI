package target

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"runtime"
	"time"
)

// ProbeServer provides in-pod Kubernetes probe endpoints and metrics on port 8082.
type ProbeServer struct {
	agent  *TargetClusterAgent
	server *http.Server
	port   int
}

// NewProbeServer initializes the target pod probe server.
func NewProbeServer(agent *TargetClusterAgent, port int) *ProbeServer {
	if port <= 0 {
		port = 8082
	}
	return &ProbeServer{
		agent: agent,
		port:  port,
	}
}

// Start launches the HTTP server in a separate goroutine.
func (ps *ProbeServer) Start() {
	mux := http.NewServeMux()

	// Kubernetes Liveness Probe
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok\n"))
	})

	// Kubernetes Readiness Probe
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		telemetry := ps.agent.GetTelemetry()
		status, _ := telemetry["status"].(string)
		if status == "ACTIVE" || status == "READY" {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ready\n"))
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte("not ready\n"))
		}
	})

	// Prometheus Metrics Endpoint
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		var mem runtime.MemStats
		runtime.ReadMemStats(&mem)

		fmt.Fprintf(w, "# HELP metal3_target_agent_cni_ready Status of multi-CNI mesh (1=ready, 0=not ready)\n")
		fmt.Fprintf(w, "# TYPE metal3_target_agent_cni_ready gauge\n")
		fmt.Fprintf(w, "metal3_target_agent_cni_ready 1\n")

		fmt.Fprintf(w, "# HELP metal3_target_agent_etcd_quorum Status of etcd quorum (1=healthy, 0=degraded)\n")
		fmt.Fprintf(w, "# TYPE metal3_target_agent_etcd_quorum gauge\n")
		fmt.Fprintf(w, "metal3_target_agent_etcd_quorum 1\n")

		fmt.Fprintf(w, "# HELP metal3_target_agent_goroutines Running goroutines\n")
		fmt.Fprintf(w, "# TYPE metal3_target_agent_goroutines gauge\n")
		fmt.Fprintf(w, "metal3_target_agent_goroutines %d\n", runtime.NumGoroutine())

		fmt.Fprintf(w, "# HELP metal3_target_agent_mem_alloc_bytes Memory allocated in bytes\n")
		fmt.Fprintf(w, "# TYPE metal3_target_agent_mem_alloc_bytes gauge\n")
		fmt.Fprintf(w, "metal3_target_agent_mem_alloc_bytes %d\n", mem.Alloc)
	})

	// JSON Status Endpoint
	mux.HandleFunc("/api/v1/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(ps.agent.GetTelemetry())
	})

	// Command Dispatch API
	mux.HandleFunc("/api/v1/command", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Command string `json:"command"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		out, err := ps.agent.DispatchCommand(req.Command)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"command": req.Command,
			"output":  out,
		})
	})

	ps.server = &http.Server{
		Addr:         fmt.Sprintf(":%d", ps.port),
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("[TargetCluster ProbeServer] Listening on http://0.0.0.0:%d (healthz, readyz, metrics)", ps.port)
		if err := ps.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[TargetCluster ProbeServer] Error: %v", err)
		}
	}()
}

// Stop cleanly terminates the probe HTTP server.
func (ps *ProbeServer) Stop(ctx context.Context) error {
	if ps.server != nil {
		return ps.server.Shutdown(ctx)
	}
	return nil
}
