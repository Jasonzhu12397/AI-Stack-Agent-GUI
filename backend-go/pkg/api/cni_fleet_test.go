package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/cni"
)

func TestMetal3CNIFleetZeroTrustRBACAndReconciliation(t *testing.T) {
	srv := newTestServer()

	// 1. Public read of CNI fleet summary returns all 15 seeded hosts & 4 rendered interface artifacts
	rrFleet := doJSONReq(srv, "GET", "/api/v1/metal3/cni/fleet", "usr_elena_admin", nil)
	if rrFleet.Code != http.StatusOK {
		t.Fatalf("expected 200 for GET /metal3/cni/fleet, got %d body=%s", rrFleet.Code, rrFleet.Body.String())
	}
	var fleetWrap struct {
		Success bool             `json:"success"`
		Data    cni.FleetSummary `json:"data"`
	}
	if err := json.Unmarshal(rrFleet.Body.Bytes(), &fleetWrap); err != nil {
		t.Fatalf("failed decoding CNI fleet response: %v", err)
	}
	if fleetWrap.Data.TotalHosts != 15 || fleetWrap.Data.ConvergedHosts != 10 {
		t.Fatalf("expected 15 total and 10 active converged hosts, got total=%d converged=%d",
			fleetWrap.Data.TotalHosts, fleetWrap.Data.ConvergedHosts)
	}
	for _, artifactName := range []string{"00-multus.conf", "01-calico-bgp.yaml", "02-multus-nads.yaml", "03-sriov-node-policies.yaml"} {
		if fleetWrap.Data.RenderedArtifacts[artifactName] == "" {
			t.Fatalf("expected non-empty rendered artifact %s", artifactName)
		}
	}

	// 2. APP_DEVELOPER lacks CLUSTER_MANAGE/HOST_MANAGE -> zero-trust blocks CNI mutations
	rrDenyRec := doJSONReq(srv, "POST", "/api/v1/metal3/cni/reconcile", "usr_alex_dev", map[string]interface{}{"converge_all": true})
	if rrDenyRec.Code != http.StatusForbidden || !strings.Contains(rrDenyRec.Body.String(), "PERMISSION_DENIED") {
		t.Fatalf("expected APP_DEVELOPER denied on CNI reconcile, got %d body=%s", rrDenyRec.Code, rrDenyRec.Body.String())
	}
	rrDenyCfg := doJSONReq(srv, "POST", "/api/v1/metal3/cni/config", "usr_alex_dev", fleetWrap.Data.Config)
	if rrDenyCfg.Code != http.StatusForbidden {
		t.Fatalf("expected APP_DEVELOPER denied on CNI config, got %d", rrDenyCfg.Code)
	}

	// 3. Inject SR-IOV drift on GPU worker as Elena -> host transitions to DRIFTED
	rrDrift := doJSONReq(srv, "POST", "/api/v1/metal3/cni/drift", "usr_elena_admin", map[string]interface{}{
		"host_name": "bmh-worker-k8s-01",
		"plugin":    "sriov-dpdk",
		"degraded":  false,
	})
	if rrDrift.Code != http.StatusOK {
		t.Fatalf("expected drift injection 200 OK, got %d body=%s", rrDrift.Code, rrDrift.Body.String())
	}
	if !strings.Contains(rrDrift.Body.String(), `"DRIFTED"`) {
		t.Fatalf("expected DRIFTED phase after drift injection, got %s", rrDrift.Body.String())
	}

	// 4. Reconcile fleet cleanly recovers drifted host back to READY
	rrRec := doJSONReq(srv, "POST", "/api/v1/metal3/cni/reconcile", "usr_elena_admin", map[string]interface{}{
		"host_names":   []string{"bmh-worker-k8s-01"},
		"converge_all": true,
	})
	if rrRec.Code != http.StatusOK {
		t.Fatalf("expected CNI reconcile 200 OK, got %d body=%s", rrRec.Code, rrRec.Body.String())
	}
	var recWrap struct {
		Data cni.FleetSummary `json:"data"`
	}
	_ = json.Unmarshal(rrRec.Body.Bytes(), &recWrap)
	if recWrap.Data.ConvergedHosts != 10 || recWrap.Data.DegradedHosts != 0 {
		t.Fatalf("expected 10 converged and 0 degraded after reconcile, got converged=%d degraded=%d",
			recWrap.Data.ConvergedHosts, recWrap.Data.DegradedHosts)
	}

	// 5. Invalid CNI config rejected with 400 INVALID_CNI_CONFIG
	badCfg := fleetWrap.Data.Config
	badCfg.Calico.IPPoolCIDR = "invalid-cidr"
	rrBadCfg := doJSONReq(srv, "POST", "/api/v1/metal3/cni/config", "usr_elena_admin", badCfg)
	if rrBadCfg.Code != http.StatusBadRequest || !strings.Contains(rrBadCfg.Body.String(), "INVALID_CNI_CONFIG") {
		t.Fatalf("expected 400 INVALID_CNI_CONFIG, got %d body=%s", rrBadCfg.Code, rrBadCfg.Body.String())
	}

	// 6. Valid CNI config bumps generation -> triggers drift -> reconcile converges all active nodes to gen 2
	goodCfg := fleetWrap.Data.Config
	goodCfg.Calico.BGPASNumber = 65022
	rrGoodCfg := doJSONReq(srv, "POST", "/api/v1/metal3/cni/config", "usr_elena_admin", goodCfg)
	if rrGoodCfg.Code != http.StatusOK {
		t.Fatalf("expected valid config update 200 OK, got %d body=%s", rrGoodCfg.Code, rrGoodCfg.Body.String())
	}
	var cfgWrap struct {
		Data cni.FleetSummary `json:"data"`
	}
	_ = json.Unmarshal(rrGoodCfg.Body.Bytes(), &cfgWrap)
	if cfgWrap.Data.DesiredGeneration != 2 || cfgWrap.Data.DegradedHosts != 10 {
		t.Fatalf("expected generation=2 with 10 drifted cluster hosts prior to reconcile, got gen=%d degraded=%d",
			cfgWrap.Data.DesiredGeneration, cfgWrap.Data.DegradedHosts)
	}

	rrConvAll := doJSONReq(srv, "POST", "/api/v1/metal3/cni/reconcile", "usr_elena_admin", map[string]interface{}{
		"converge_all": true,
	})
	if rrConvAll.Code != http.StatusOK {
		t.Fatalf("expected fleet converge 200 OK, got %d", rrConvAll.Code)
	}
	var finalWrap struct {
		Data cni.FleetSummary `json:"data"`
	}
	_ = json.Unmarshal(rrConvAll.Body.Bytes(), &finalWrap)
	if finalWrap.Data.ConvergedHosts != 10 || finalWrap.Data.DegradedHosts != 0 {
		t.Fatalf("expected all 10 active hosts converged at generation 2, got converged=%d degraded=%d",
			finalWrap.Data.ConvergedHosts, finalWrap.Data.DegradedHosts)
	}
	if !strings.Contains(finalWrap.Data.RenderedArtifacts["01-calico-bgp.yaml"], "65022") {
		t.Fatalf("expected updated BGP AS 65022 in rendered Calico manifest")
	}
}
