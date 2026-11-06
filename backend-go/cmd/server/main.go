package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/api"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/connectors"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/metal3"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/store"
)

// CORS & Security Headers Middleware
func securityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Actor-ID")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Server", "AI-Agent-Studio-Go-Control-Plane")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("[AI AGENT STUDIO] Initializing 100%% Golang Production Backend...")
	log.Printf("[AI AGENT STUDIO] Go Runtime: %s on %s/%s (GOMAXPROCS=%d)", runtime.Version(), runtime.GOOS, runtime.GOARCH, runtime.GOMAXPROCS(0))

	// 1. Initialize Domain Singletons
	memStore := store.NewStore()
	m3Engine := metal3.NewEngine()
	connRegistry := connectors.NewRegistry()

	// 2. Build Server and Register All 48+ RESTful Endpoints
	srv := api.NewServer(memStore, m3Engine, connRegistry)

	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      securityMiddleware(srv.Mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 3. Graceful Shutdown listener
	shutdownChan := make(chan os.Signal, 1)
	signal.Notify(shutdownChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[AI AGENT STUDIO GO CONTROL PLANE] Listening and serving at http://0.0.0.0:%s", port)
		log.Printf("[AI AGENT STUDIO GO CONTROL PLANE] Health check: http://0.0.0.0:%s/api/v1/health", port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Fatal server error: %v", err)
		}
	}()

	<-shutdownChan
	log.Println("[AI AGENT STUDIO] Gracefully shutting down Go backend...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	fmt.Println("[AI AGENT STUDIO] Go backend daemon stopped cleanly.")
}
