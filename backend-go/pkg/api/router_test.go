package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/connectors"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/dag"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/metal3"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/policy"
	"github.com/enterprise/ai-agent-studio-backend-go/pkg/store"
)

func setupTestServer() *Server {
	s := store.NewStore()
	m := metal3.NewEngine()
	c := connectors.NewRegistry()
	return NewServer(s, m, c)
}

func TestHealthEndpoint(t *testing.T) {
	srv := setupTestServer()
	req := httptest.NewRequest("GET", "/api/v1/health", nil)
	rec := httptest.NewRecorder()

	srv.Mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", rec.Code)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("Failed to decode json: %v", err)
	}

	if body["status"] != "HEALTHY" {
		t.Errorf("Expected status HEALTHY, got %v", body["status"])
	}
}

func TestZeroTrustPolicyEngine(t *testing.T) {
	pe := policy.NewPolicyEngine()

	principal := &models.Principal{
		ActorID:     "usr_dev",
		Permissions: []string{"RUN_EXECUTE"},
	}

	agent := &models.AgentDefinition{
		Name:        "Test Agent",
		ToolIDs:     []string{"tool_read"},
		RequiredPermissions: []string{"READ"},
	}

	tool := &models.ToolDefinition{
		ID:          "tool_read",
		Name:        "read_tool",
		Permissions: []string{"READ"},
		Risk:        "LOW",
	}

	// Principal lacks "READ" permission
	dec := pe.EvaluateToolCall(principal, agent, tool, nil)
	if dec.Allowed {
		t.Errorf("Expected access denied due to missing permission, but was allowed")
	}

	// Grant permission
	principal.Permissions = append(principal.Permissions, "READ")
	dec2 := pe.EvaluateToolCall(principal, agent, tool, nil)
	if !dec2.Allowed {
		t.Errorf("Expected access allowed, but got: %s", dec2.Reason)
	}
}

func TestDAGValidationAcyclicity(t *testing.T) {
	// Acyclic DAG
	nodes := []map[string]interface{}{
		{"id": "A"}, {"id": "B"}, {"id": "C"},
	}
	edges := []map[string]string{
		{"source": "A", "target": "B"},
		{"source": "B", "target": "C"},
	}
	res := dag.ValidateDAG(nodes, edges)
	if !res.Valid || !res.Acyclic {
		t.Errorf("Expected valid acyclic DAG, got error: %s", res.Error)
	}

	// Cyclic DAG
	cyclicEdges := []map[string]string{
		{"source": "A", "target": "B"},
		{"source": "B", "target": "C"},
		{"source": "C", "target": "A"}, // cycle
	}
	res2 := dag.ValidateDAG(nodes, cyclicEdges)
	if res2.Valid || res2.Acyclic {
		t.Errorf("Expected cycle detection failure, but was marked valid")
	}
}

func TestMetal3PowerControl(t *testing.T) {
	srv := setupTestServer()
	body := strings.NewReader(`{"action":"power-off"}`)
	req := httptest.NewRequest("POST", "/api/v1/metal3/bmh/bmh-master-k8s-01/power", body)
	rec := httptest.NewRecorder()

	srv.Mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", rec.Code)
	}

	var res map[string]interface{}
	json.NewDecoder(rec.Body).Decode(&res)
	data, _ := res["data"].(map[string]interface{})
	if data["power_status"] != "OFF" {
		t.Errorf("Expected power_status OFF, got %v", data["power_status"])
	}
}

func TestDualAgentEndpoints(t *testing.T) {
	srv := setupTestServer()

	// 1. Get Status
	req := httptest.NewRequest("GET", "/api/v1/metal3/dual-agent/status", nil)
	rec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", rec.Code)
	}

	var statusRes map[string]interface{}
	json.NewDecoder(rec.Body).Decode(&statusRes)
	data, ok := statusRes["data"].(map[string]interface{})
	if !ok || data["current_phase"] == "" {
		t.Errorf("Expected current_phase in response, got %v", statusRes)
	}

	// 2. Trigger Phase
	trigBody := strings.NewReader(`{"phase":"MULTI_CNI_CONVERGE"}`)
	trigReq := httptest.NewRequest("POST", "/api/v1/metal3/dual-agent/trigger", trigBody)
	trigRec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(trigRec, trigReq)

	if trigRec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", trigRec.Code)
	}

	// 3. Test Pivot
	pivReq := httptest.NewRequest("POST", "/api/v1/metal3/dual-agent/pivot", nil)
	pivRec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(pivRec, pivReq)

	if pivRec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for pivot handover, got %d", pivRec.Code)
	}
}

func TestMultiCNISpecAndTesting(t *testing.T) {
	srv := setupTestServer()

	// 1. Get Spec
	req := httptest.NewRequest("GET", "/api/v1/metal3/cni/spec", nil)
	rec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", rec.Code)
	}

	var cniRes map[string]interface{}
	json.NewDecoder(rec.Body).Decode(&cniRes)
	data, _ := cniRes["data"].(map[string]interface{})
	if data["multus"] == nil || data["calico"] == nil || data["ovs"] == nil || data["sriov"] == nil {
		t.Errorf("Expected all 4 CNIs present, got %v", data)
	}

	// 2. Test live packet connectivity across all 4 CNIs
	testReq := httptest.NewRequest("POST", "/api/v1/metal3/cni/test", nil)
	testRec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(testRec, testReq)

	if testRec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", testRec.Code)
	}

	var testRes map[string]interface{}
	json.NewDecoder(testRec.Body).Decode(&testRes)
	if testRes["success"] != true {
		t.Errorf("Expected success true, got %v", testRes)
	}
}

func TestOmniDeployAndManifests(t *testing.T) {
	srv := setupTestServer()

	// 1. Omni Deploy
	deployPayload := strings.NewReader(`{
		"cluster_name": "test-omni-cluster",
		"k8s_version": "v1.31.2",
		"control_plane_nodes": 3,
		"worker_gpu_nodes": 8,
		"selected_host_names": ["bmh-master-k8s-01", "bmh-worker-k8s-01"]
	}`)
	req := httptest.NewRequest("POST", "/api/v1/metal3/omni/deploy", deployPayload)
	rec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for Omni deploy, got %d", rec.Code)
	}

	var deployRes map[string]interface{}
	json.NewDecoder(rec.Body).Decode(&deployRes)
	prog, _ := deployRes["data"].(map[string]interface{})
	if prog["status"] != "READY" || prog["progress_percent"] != float64(100) {
		t.Errorf("Expected READY and 100%% progress, got %v", prog)
	}

	// 2. Declarative manifests
	manReq := httptest.NewRequest("GET", "/api/v1/metal3/omni/manifests?cluster_name=test-omni-cluster&k8s_version=v1.31.2", nil)
	manRec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(manRec, manReq)

	if manRec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for manifests, got %d", manRec.Code)
	}

	var manRes map[string]interface{}
	json.NewDecoder(manRec.Body).Decode(&manRes)
	manifests, _ := manRes["manifests"].(map[string]interface{})
	if manifests["01-cluster-metal3-capi.yaml"] == nil || manifests["02-multus-cni-daemonset.yaml"] == nil {
		t.Errorf("Expected YAML manifests generated, got %v", manifests)
	}
}



func TestMetal3KubernetesVersionUpgradeValidation(t *testing.T) {
	srv := setupTestServer()
	clusterID := "cluster-prod-gpu-k8s"

	for _, version := range []string{"v1.33.0", "v1.35.0", "v1.36.0"} {
		body := strings.NewReader(`{"target_k8s_version":"` + version + `"}`)
		req := httptest.NewRequest("POST", "/api/v1/metal3/clusters/"+clusterID+"/upgrade", body)
		rec := httptest.NewRecorder()
		srv.Mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("Expected 200 for supported version %s, got %d: %s", version, rec.Code, rec.Body.String())
		}
	}

	unsupportedBody := strings.NewReader(`{"target_k8s_version":"v1.34.0"}`)
	unsupportedReq := httptest.NewRequest("POST", "/api/v1/metal3/clusters/"+clusterID+"/upgrade", unsupportedBody)
	unsupportedRec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(unsupportedRec, unsupportedReq)
	if unsupportedRec.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 for unsupported version, got %d", unsupportedRec.Code)
	}

	downgradeBody := strings.NewReader(`{"target_k8s_version":"v1.33.0"}`)
	downgradeReq := httptest.NewRequest("POST", "/api/v1/metal3/clusters/"+clusterID+"/upgrade", downgradeBody)
	downgradeRec := httptest.NewRecorder()
	srv.Mux.ServeHTTP(downgradeRec, downgradeReq)
	if downgradeRec.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 for downgrade, got %d", downgradeRec.Code)
	}
}
