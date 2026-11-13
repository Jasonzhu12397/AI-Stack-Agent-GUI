package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRateLimiterTokenBucketAndRefill(t *testing.T) {
	now := time.Date(2026, 11, 13, 12, 0, 0, 0, time.UTC)
	rl := NewRateLimiter(RateLimitConfig{
		RequestsPerMinute: 60, // 1 token/sec
		Burst:             3,
		AnonymousLimit:    2,
		RoleLimits: map[string]int{
			"PLATFORM_ADMIN": 120,
			"APP_DEVELOPER":  60,
		},
		ExemptPaths: []string{"/api/v1/health"},
	})
	rl.nowFn = func() time.Time { return now }

	// Consume full burst of 3 requests for usr_alex_dev
	for i := 0; i < 3; i++ {
		dec := rl.Allow("usr_alex_dev", "APP_DEVELOPER")
		if !dec.Allowed {
			t.Fatalf("expected request %d within burst=3 to be allowed, got blocked", i+1)
		}
		wantRem := 2 - i
		if dec.Remaining != wantRem {
			t.Fatalf("expected remaining=%d, got %d", wantRem, dec.Remaining)
		}
	}

	// 4th immediate request must be throttled
	blocked := rl.Allow("usr_alex_dev", "APP_DEVELOPER")
	if blocked.Allowed {
		t.Fatalf("expected 4th request after burst exhaustion to be blocked")
	}
	if blocked.Remaining != 0 || blocked.RetryAfterSec < 1 {
		t.Fatalf("unexpected blocked decision: %+v", blocked)
	}

	// Principal isolation: another principal must still have full capacity
	other := rl.Allow("usr_elena_admin", "PLATFORM_ADMIN")
	if !other.Allowed || other.Limit != 120 {
		t.Fatalf("expected usr_elena_admin isolated with limit=120, got %+v", other)
	}

	// Anonymous IP key obeys capped AnonymousLimit (2)
	for i := 0; i < 2; i++ {
		if d := rl.Allow("anon:10.0.0.5", "NONE"); !d.Allowed {
			t.Fatalf("expected anonymous req %d allowed", i+1)
		}
	}
	if d := rl.Allow("anon:10.0.0.5", "NONE"); d.Allowed || d.Limit != 2 {
		t.Fatalf("expected anonymous 3rd req blocked at limit=2, got %+v", d)
	}

	// Advance clock by 2 seconds -> 2 tokens refill for usr_alex_dev (60 rpm = 1/sec)
	now = now.Add(2 * time.Second)
	afterRefill := rl.Allow("usr_alex_dev", "APP_DEVELOPER")
	if !afterRefill.Allowed {
		t.Fatalf("expected usr_alex_dev allowed after 2s token refill, got %+v", afterRefill)
	}
}

func TestRateLimitMiddlewareHTTPHeaders429AndAuditTrail(t *testing.T) {
	srv := newTestServer()
	now := time.Date(2026, 11, 13, 12, 0, 0, 0, time.UTC)
	srv.RateLimiter = NewRateLimiter(RateLimitConfig{
		RequestsPerMinute: 60,
		Burst:             2,
		AnonymousLimit:    2,
		RoleLimits: map[string]int{
			"APP_DEVELOPER":  60,
			"PLATFORM_ADMIN": 600,
		},
		ExemptPaths: []string{"/api/v1/health"},
	})
	srv.RateLimiter.nowFn = func() time.Time { return now }

	handler := srv.Handler()

	sendReq := func(method, path, actorID string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		req.RemoteAddr = "192.168.10.22:54321"
		if actorID != "" {
			req.Header.Set("X-Actor-ID", actorID)
		}
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		return rr
	}

	// 1st request succeeds with standard X-RateLimit-* headers
	r1 := sendReq("GET", "/api/v1/agents", "usr_alex_dev")
	if r1.Code != http.StatusOK {
		t.Fatalf("expected 200 on first request, got %d body=%s", r1.Code, r1.Body.String())
	}
	if r1.Header().Get("X-RateLimit-Limit") != "60" ||
		r1.Header().Get("X-RateLimit-Remaining") != "1" ||
		r1.Header().Get("X-RateLimit-Principal") != "usr_alex_dev" ||
		r1.Header().Get("X-RateLimit-Reset") == "" {
		t.Fatalf("missing or invalid rate limit headers on r1: %+v", r1.Header())
	}

	// 2nd request drains remaining burst to 0
	r2 := sendReq("GET", "/api/v1/agents", "usr_alex_dev")
	if r2.Code != http.StatusOK || r2.Header().Get("X-RateLimit-Remaining") != "0" {
		t.Fatalf("expected 200 with remaining=0 on r2, got code=%d rem=%s", r2.Code, r2.Header().Get("X-RateLimit-Remaining"))
	}

	// 3rd request exceeds bucket -> 429 RATE_LIMIT_EXCEEDED + Retry-After + BLOCKED AuditEvent
	r3 := sendReq("GET", "/api/v1/agents", "usr_alex_dev")
	if r3.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 Too Many Requests on r3, got %d body=%s", r3.Code, r3.Body.String())
	}
	if r3.Header().Get("Retry-After") == "" {
		t.Fatalf("expected Retry-After header on 429 response")
	}
	var errPayload map[string]interface{}
	if err := json.Unmarshal(r3.Body.Bytes(), &errPayload); err != nil {
		t.Fatalf("expected JSON body on 429, got error: %v", err)
	}
	if !strings.Contains(r3.Body.String(), "RATE_LIMIT_EXCEEDED") {
		t.Fatalf("expected RATE_LIMIT_EXCEEDED error code, got %s", r3.Body.String())
	}

	// Verify BLOCKED audit event persisted in store
	srv.Store.RLock()
	foundBlockedAudit := false
	for _, a := range srv.Store.Audits {
		if a.Status == "BLOCKED" && a.ActorID == "usr_alex_dev" && strings.Contains(a.Summary, "RATE_LIMIT_EXCEEDED") {
			foundBlockedAudit = true
			break
		}
	}
	srv.Store.RUnlock()
	if !foundBlockedAudit {
		t.Fatalf("expected BLOCKED AuditEvent recorded for throttled principal")
	}

	// Exempt health endpoint and OPTIONS preflight must succeed even while throttled
	healthRes := sendReq("GET", "/api/v1/health", "usr_alex_dev")
	if healthRes.Code != http.StatusOK {
		t.Fatalf("expected /api/v1/health exempt from rate limit, got %d", healthRes.Code)
	}

	// Isolated principal usr_elena_admin is unaffected and can query /api/v1/system/ratelimit
	metricsRes := sendReq("GET", "/api/v1/system/ratelimit", "usr_elena_admin")
	if metricsRes.Code != http.StatusOK {
		t.Fatalf("expected usr_elena_admin allowed on /api/v1/system/ratelimit, got %d", metricsRes.Code)
	}
	if !strings.Contains(metricsRes.Body.String(), `"total_throttled":1`) {
		t.Fatalf("expected total_throttled=1 in metrics payload, got %s", metricsRes.Body.String())
	}
}
