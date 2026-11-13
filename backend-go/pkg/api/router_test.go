package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/connectors"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/metal3"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/store"
)

func newTestServer() *Server {
	s := store.NewStore()
	m3 := metal3.NewEngine()
	conn := connectors.NewRegistry()
	return NewServer(s, m3, conn)
}

func doJSONReq(srv *Server, method, path, actorID string, body interface{}) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if actorID != "" {
		req.Header.Set("X-Actor-ID", actorID)
	}
	rr := httptest.NewRecorder()
	srv.Mux.ServeHTTP(rr, req)
	return rr
}

func TestZeroTrustRBACAndRevocationBarrier(t *testing.T) {
	srv := newTestServer()

	// 1. Seeded REVOKED user Devon Lee must be blocked with 403 ROLE_REVOKED
	rr := doJSONReq(srv, "POST", "/api/v1/agents/agt_infra_helper/run", "usr_devon_revoked", map[string]string{"input_query": "Check fleet"})
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for revoked principal, got %d body=%s", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), "ROLE_REVOKED") {
		t.Fatalf("expected ROLE_REVOKED error code, got %s", rr.Body.String())
	}

	// 2. APP_DEVELOPER Alex Chen lacks CLUSTER_MANAGE, USER_MANAGE, and APPROVE_HIGH_RISK
	rrUpgrade := doJSONReq(srv, "POST", "/api/v1/metal3/clusters/cluster-prod-gpu-k8s/upgrade", "usr_alex_dev", map[string]interface{}{
		"target_k8s_version": "v1.35.0",
		"policy":             "rolling",
	})
	if rrUpgrade.Code != http.StatusForbidden || !strings.Contains(rrUpgrade.Body.String(), "PERMISSION_DENIED") {
		t.Fatalf("expected APP_DEVELOPER denied CLUSTER_MANAGE upgrade, got %d body=%s", rrUpgrade.Code, rrUpgrade.Body.String())
	}

	rrApprove := doJSONReq(srv, "POST", "/api/v1/approvals/appr_seed_01/decide", "usr_alex_dev", map[string]string{"decision": "APPROVE"})
	if rrApprove.Code != http.StatusForbidden || !strings.Contains(rrApprove.Body.String(), "PERMISSION_DENIED") {
		t.Fatalf("expected APP_DEVELOPER denied approval decision, got %d body=%s", rrApprove.Code, rrApprove.Body.String())
	}

	// 3. PLATFORM_ADMIN Elena revokes Alex dynamically -> Alex immediately blocked with ROLE_REVOKED
	rrRevoke := doJSONReq(srv, "POST", "/api/v1/members/usr_alex_dev/revoke", "usr_elena_admin", nil)
	if rrRevoke.Code != http.StatusOK {
		t.Fatalf("expected admin revoke to succeed, got %d body=%s", rrRevoke.Code, rrRevoke.Body.String())
	}
	rrAlexAfter := doJSONReq(srv, "POST", "/api/v1/agents/agt_infra_helper/run", "usr_alex_dev", map[string]string{"input_query": "Check"})
	if rrAlexAfter.Code != http.StatusForbidden || !strings.Contains(rrAlexAfter.Body.String(), "ROLE_REVOKED") {
		t.Fatalf("expected newly revoked Alex blocked with ROLE_REVOKED, got %d body=%s", rrAlexAfter.Code, rrAlexAfter.Body.String())
	}
}

func TestHighRiskApprovalAndPlanHashAntiTamper(t *testing.T) {
	srv := newTestServer()

	// Trigger high-risk deploy run as PLATFORM_ADMIN Elena
	rrRun := doJSONReq(srv, "POST", "/api/v1/agents/agt_infra_helper/run", "usr_elena_admin", map[string]string{
		"input_query": "Deploy canary ingress rollout to prod cluster",
	})
	if rrRun.Code != http.StatusOK {
		t.Fatalf("expected run trigger 200, got %d body=%s", rrRun.Code, rrRun.Body.String())
	}
	var runResp struct {
		Success bool `json:"success"`
		Data    struct {
			ID    string `json:"id"`
			State string `json:"state"`
			Steps []struct {
				ApprovalID string `json:"approval_id"`
				Policy     struct {
					RequiredPlanHash string `json:"required_plan_hash"`
				} `json:"policy_decision"`
			} `json:"steps"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rrRun.Body.Bytes(), &runResp); err != nil {
		t.Fatalf("failed decoding run response: %v", err)
	}
	if runResp.Data.State != "WAITING_APPROVAL" {
		t.Fatalf("expected WAITING_APPROVAL for deploy prompt, got %s", runResp.Data.State)
	}

	var apprID, planHash string
	for _, st := range runResp.Data.Steps {
		if st.ApprovalID != "" {
			apprID = st.ApprovalID
			planHash = st.Policy.RequiredPlanHash
		}
	}
	if apprID == "" || len(planHash) != 64 {
		t.Fatalf("expected approval_id + 64-char SHA-256 plan_hash, got apprID=%q planHash=%q", apprID, planHash)
	}

	// Tampered override args must return 409 PLAN_HASH_TAMPERED on seed approval
	rrTamper := doJSONReq(srv, "POST", "/api/v1/approvals/appr_seed_01/decide", "usr_marcus_approver", map[string]interface{}{
		"decision": "APPROVE",
		"args":     map[string]interface{}{"replicas": 999},
	})
	if rrTamper.Code != http.StatusConflict || !strings.Contains(rrTamper.Body.String(), "PLAN_HASH_TAMPERED") {
		t.Fatalf("expected 409 PLAN_HASH_TAMPERED, got %d body=%s", rrTamper.Code, rrTamper.Body.String())
	}

	// Valid approval by APPROVER Marcus must transition linked ExecutionRun to SUCCEEDED
	rrValid := doJSONReq(srv, "POST", "/api/v1/approvals/"+apprID+"/decide", "usr_marcus_approver", map[string]interface{}{
		"decision":           "APPROVE",
		"expected_plan_hash": planHash,
	})
	if rrValid.Code != http.StatusOK {
		t.Fatalf("expected valid approval to return 200, got %d body=%s", rrValid.Code, rrValid.Body.String())
	}

	rrGetRun := doJSONReq(srv, "GET", "/api/v1/runs/"+runResp.Data.ID, "usr_elena_admin", nil)
	if !strings.Contains(rrGetRun.Body.String(), `"state":"SUCCEEDED"`) {
		t.Fatalf("expected approved run to transition to SUCCEEDED, got %s", rrGetRun.Body.String())
	}
}

func TestMetal3VersionControllerHTTPRoundTrip(t *testing.T) {
	srv := newTestServer()

	// Unsupported version rejected
	rrBad := doJSONReq(srv, "POST", "/api/v1/metal3/clusters/cluster-prod-gpu-k8s/upgrade", "usr_elena_admin", map[string]interface{}{
		"target_k8s_version": "v1.99.9",
		"policy":             "rolling",
	})
	if rrBad.Code != http.StatusBadRequest || !strings.Contains(rrBad.Body.String(), "INVALID_UPGRADE_SPEC") {
		t.Fatalf("expected 400 INVALID_UPGRADE_SPEC, got %d body=%s", rrBad.Code, rrBad.Body.String())
	}

	// Valid rolling upgrade triggered by Elena
	rrStart := doJSONReq(srv, "POST", "/api/v1/metal3/clusters/cluster-prod-gpu-k8s/upgrade", "usr_elena_admin", map[string]interface{}{
		"target_k8s_version": "v1.35.0",
		"policy":             "batch",
		"target_nodes":       []string{"bmh-master-k8s-01", "bmh-worker-k8s-01"},
	})
	if rrStart.Code != http.StatusOK {
		t.Fatalf("expected upgrade trigger 200, got %d body=%s", rrStart.Code, rrStart.Body.String())
	}

	// Step reconcile until converged
	for i := 0; i < 6; i++ {
		rrRec := doJSONReq(srv, "POST", "/api/v1/metal3/clusters/cluster-prod-gpu-k8s/reconcile", "usr_elena_admin", nil)
		if rrRec.Code != http.StatusOK {
			t.Fatalf("reconcile step %d failed: %d %s", i, rrRec.Code, rrRec.Body.String())
		}
	}

	rrStatus := doJSONReq(srv, "GET", "/api/v1/metal3/clusters/cluster-prod-gpu-k8s/upgrade-status", "usr_elena_admin", nil)
	if !strings.Contains(rrStatus.Body.String(), `"is_upgrading":false`) || !strings.Contains(rrStatus.Body.String(), `"status":"READY"`) {
		t.Fatalf("expected converged READY upgrade status, got %s", rrStatus.Body.String())
	}
}

func TestOIDCProdGuardMetricsAndWorkflowDAG(t *testing.T) {
	srv := newTestServer()

	// OIDC Guard
	rrOIDC := doJSONReq(srv, "POST", "/api/v1/auth/oidc/verify", "", map[string]string{
		"env":      "production",
		"provider": "LOCAL_DEV_IDENTITY",
	})
	if rrOIDC.Code != http.StatusForbidden || !strings.Contains(rrOIDC.Body.String(), "OIDC_CONFIG_INVALID") {
		t.Fatalf("expected 403 OIDC_CONFIG_INVALID, got %d body=%s", rrOIDC.Code, rrOIDC.Body.String())
	}

	// Metrics includes "data" envelope expected by App.tsx
	rrMetrics := doJSONReq(srv, "GET", "/api/v1/metrics", "", nil)
	if rrMetrics.Code != http.StatusOK || !strings.Contains(rrMetrics.Body.String(), `"data":{`) || !strings.Contains(rrMetrics.Body.String(), `"total_runs":`) {
		t.Fatalf("expected /api/v1/metrics data payload, got %d body=%s", rrMetrics.Code, rrMetrics.Body.String())
	}

	// Workflow DAG cycle detection
	rrCycle := doJSONReq(srv, "POST", "/api/v1/workflows/validate", "", map[string]interface{}{
		"nodes": []map[string]interface{}{
			{"id": "a", "name": "A", "type": "START"},
			{"id": "b", "name": "B", "type": "LLM"},
		},
		"edges": []map[string]string{
			{"source": "a", "target": "b"},
			{"source": "b", "target": "a"},
		},
	})
	if rrCycle.Code != http.StatusOK || !strings.Contains(rrCycle.Body.String(), `"is_valid":false`) {
		t.Fatalf("expected cyclic workflow validation is_valid=false, got %d body=%s", rrCycle.Code, rrCycle.Body.String())
	}
}
