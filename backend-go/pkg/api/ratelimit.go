package api

import (
	"fmt"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
)

// RateLimitConfig configures per-principal token bucket API rate limiting.
type RateLimitConfig struct {
	RequestsPerMinute int
	Burst             int
	RoleLimits        map[string]int
	AnonymousLimit    int
	ExemptPaths       []string
}

// DefaultRateLimitConfig returns production-safe per-principal API rate limits.
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerMinute: 240,
		Burst:             120,
		AnonymousLimit:    60,
		RoleLimits: map[string]int{
			"PLATFORM_ADMIN":  600,
			"ORG_ADMIN":       420,
			"CONNECTOR_ADMIN": 300,
			"APP_DEVELOPER":   240,
			"OPERATOR":        240,
			"APPROVER":        180,
			"AUDITOR":         180,
		},
		ExemptPaths: []string{"/api/v1/health"},
	}
}

type tokenBucket struct {
	principalID   string
	role          string
	limitPerMin   int
	burst         float64
	tokens        float64
	refillPerSec  float64
	lastRefill    time.Time
	totalRequests int64
	blockedCount  int64
}

// RateLimiter enforces concurrency-safe per-principal API token-bucket rate limiting.
type RateLimiter struct {
	mu      sync.Mutex
	cfg     RateLimitConfig
	buckets map[string]*tokenBucket
	nowFn   func() time.Time
}

// NewRateLimiter creates a per-principal rate limiter with the provided config.
func NewRateLimiter(cfg RateLimitConfig) *RateLimiter {
	if cfg.RequestsPerMinute <= 0 {
		cfg.RequestsPerMinute = 240
	}
	if cfg.Burst <= 0 {
		cfg.Burst = cfg.RequestsPerMinute
	}
	if cfg.AnonymousLimit <= 0 {
		cfg.AnonymousLimit = 60
	}
	if cfg.RoleLimits == nil {
		cfg.RoleLimits = make(map[string]int)
	}
	return &RateLimiter{
		cfg:     cfg,
		buckets: make(map[string]*tokenBucket),
		nowFn:   time.Now,
	}
}

func (rl *RateLimiter) limitForRole(principalID, role string) (int, int) {
	if strings.HasPrefix(principalID, "anon:") {
		lim := rl.cfg.AnonymousLimit
		burst := rl.cfg.Burst
		if burst > lim {
			burst = lim
		}
		if burst < 1 {
			burst = 1
		}
		return lim, burst
	}
	lim := rl.cfg.RequestsPerMinute
	if roleLim, ok := rl.cfg.RoleLimits[strings.ToUpper(strings.TrimSpace(role))]; ok && roleLim > 0 {
		lim = roleLim
	}
	burst := rl.cfg.Burst
	if burst < lim/2 && lim > rl.cfg.RequestsPerMinute {
		burst = lim / 2
	}
	if burst < 1 {
		burst = 1
	}
	return lim, burst
}

// RateLimitDecision captures the token-bucket evaluation result for an incoming request.
type RateLimitDecision struct {
	Allowed       bool
	PrincipalKey  string
	Role          string
	Limit         int
	Remaining     int
	ResetUnix     int64
	RetryAfterSec int
}

// Allow checks and consumes 1 token from the principal's bucket.
func (rl *RateLimiter) Allow(principalID, role string) RateLimitDecision {
	now := rl.nowFn()
	if principalID == "" {
		principalID = "anon:unknown"
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()

	limitPerMin, burstCap := rl.limitForRole(principalID, role)
	refillRate := float64(limitPerMin) / 60.0

	b, exists := rl.buckets[principalID]
	if !exists {
		b = &tokenBucket{
			principalID:  principalID,
			role:         role,
			limitPerMin:  limitPerMin,
			burst:        float64(burstCap),
			tokens:       float64(burstCap),
			refillPerSec: refillRate,
			lastRefill:   now,
		}
		rl.buckets[principalID] = b
	} else {
		// Update role/limits dynamically if principal role changed
		b.role = role
		b.limitPerMin = limitPerMin
		b.burst = float64(burstCap)
		b.refillPerSec = refillRate
		elapsed := now.Sub(b.lastRefill).Seconds()
		if elapsed > 0 {
			b.tokens = math.Min(b.burst, b.tokens+elapsed*b.refillPerSec)
			b.lastRefill = now
		}
	}

	b.totalRequests++
	resetTime := now.Add(time.Duration(math.Ceil((b.burst-b.tokens)/b.refillPerSec)) * time.Second)

	if b.tokens < 1.0 {
		b.blockedCount++
		waitSec := int(math.Ceil((1.0 - b.tokens) / b.refillPerSec))
		if waitSec < 1 {
			waitSec = 1
		}
		return RateLimitDecision{
			Allowed:       false,
			PrincipalKey:  principalID,
			Role:          role,
			Limit:         limitPerMin,
			Remaining:     0,
			ResetUnix:     now.Add(time.Duration(waitSec) * time.Second).Unix(),
			RetryAfterSec: waitSec,
		}
	}

	b.tokens -= 1.0
	rem := int(math.Floor(b.tokens))
	if rem < 0 {
		rem = 0
	}
	return RateLimitDecision{
		Allowed:      true,
		PrincipalKey: principalID,
		Role:         role,
		Limit:        limitPerMin,
		Remaining:    rem,
		ResetUnix:    resetTime.Unix(),
	}
}

// Metrics returns real-time telemetry across all tracked principal buckets.
func (rl *RateLimiter) Metrics() map[string]interface{} {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	var totalReq, totalBlocked int64
	activeBuckets := make([]map[string]interface{}, 0, len(rl.buckets))
	for _, b := range rl.buckets {
		totalReq += b.totalRequests
		totalBlocked += b.blockedCount
		activeBuckets = append(activeBuckets, map[string]interface{}{
			"principal_id":   b.principalID,
			"role":           b.role,
			"limit_per_min":  b.limitPerMin,
			"tokens_left":    math.Floor(b.tokens*100) / 100,
			"total_requests": b.totalRequests,
			"blocked_count":  b.blockedCount,
		})
	}
	return map[string]interface{}{
		"enabled":            true,
		"algorithm":          "TokenBucket (Per-Principal Role-Aware)",
		"default_rpm":        rl.cfg.RequestsPerMinute,
		"burst_capacity":     rl.cfg.Burst,
		"tracked_principals": len(rl.buckets),
		"total_evaluated":    totalReq,
		"total_throttled":    totalBlocked,
		"role_limits":        rl.cfg.RoleLimits,
		"buckets":            activeBuckets,
	}
}

func (rl *RateLimiter) isExemptPath(path string) bool {
	for _, p := range rl.cfg.ExemptPaths {
		if path == p {
			return true
		}
	}
	return false
}

func resolveClientIP(r *http.Request) string {
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 && strings.TrimSpace(parts[0]) != "" {
			return strings.TrimSpace(parts[0])
		}
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	if strings.TrimSpace(r.RemoteAddr) != "" {
		return strings.TrimSpace(r.RemoteAddr)
	}
	return "127.0.0.1"
}

// resolveRateLimitPrincipal identifies the caller strictly using X-Actor-ID -> Store.CurrentActor -> Client IP.
func (s *Server) resolveRateLimitPrincipal(r *http.Request) (principalKey, actorID, actorName, actorRole, tenantID, projectID string) {
	s.Store.RLock()
	defer s.Store.RUnlock()

	if r != nil {
		if hdrID := strings.TrimSpace(r.Header.Get("X-Actor-ID")); hdrID != "" {
			if p, ok := s.Store.Principals[hdrID]; ok && p != nil {
				return p.ActorID, p.ActorID, p.ActorName, p.Role, p.TenantID, p.ActiveProjectID
			}
			// Explicit unknown actor still isolated under its own rate bucket
			return "actor:" + hdrID, hdrID, "Unknown Actor", "NONE", "tenant_acme_corp", "proj_infra_ops"
		}
	}
	if s.Store.CurrentActor != nil {
		p := s.Store.CurrentActor
		return p.ActorID, p.ActorID, p.ActorName, p.Role, p.TenantID, p.ActiveProjectID
	}
	ip := resolveClientIP(r)
	return "anon:" + ip, "anonymous", "Anonymous (" + ip + ")", "NONE", "tenant_acme_corp", "proj_infra_ops"
}

// RateLimitMiddleware enforces per-principal API rate limits across all control-plane endpoints.
func (s *Server) RateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions || s.RateLimiter == nil || s.RateLimiter.isExemptPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		pKey, actorID, actorName, actorRole, tenantID, projID := s.resolveRateLimitPrincipal(r)
		dec := s.RateLimiter.Allow(pKey, actorRole)

		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(dec.Limit))
		w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(dec.Remaining))
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(dec.ResetUnix, 10))
		w.Header().Set("X-RateLimit-Principal", dec.PrincipalKey)

		if !dec.Allowed {
			w.Header().Set("Retry-After", strconv.Itoa(dec.RetryAfterSec))
			msg := fmt.Sprintf(
				"RATE_LIMIT_EXCEEDED: Principal '%s' (%s) exceeded API rate limit of %d req/min. Retry after %ds.",
				actorName, dec.PrincipalKey, dec.Limit, dec.RetryAfterSec,
			)
			s.Store.RecordAudit(&models.AuditEvent{
				TenantID:       tenantID,
				ProjectID:      projID,
				ActorID:        actorID,
				ActorName:      actorName,
				ActorRole:      actorRole,
				EventType:      "POLICY_EVALUATION",
				TargetResource: r.Method + " " + r.URL.Path,
				Summary:        msg,
				PayloadRedacted: map[string]interface{}{
					"rate_limit_principal": dec.PrincipalKey,
					"limit_per_min":        dec.Limit,
					"retry_after_sec":      dec.RetryAfterSec,
					"path":                 r.URL.Path,
				},
				Status: "BLOCKED",
			})
			writeAPIError(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", msg)
			return
		}

		next.ServeHTTP(w, r)
	})
}
