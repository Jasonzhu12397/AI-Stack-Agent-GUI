package metal3

import (
	"context"
	"strings"
	"testing"
)

func TestValidateK8sVersionMatrix(t *testing.T) {
	eng := NewEngine()

	validVersions := []string{"v1.31.4", "v1.32.3", "v1.33.2", "v1.34.1", "v1.35.0", "v1.36.0-dev"}
	for _, v := range validVersions {
		meta, err := eng.ValidateK8sVersion(v)
		if err != nil || meta == nil {
			t.Fatalf("expected version %s to be supported, got err=%v", v, err)
		}
	}

	if _, err := eng.ValidateK8sVersion("v1.99.0"); err == nil {
		t.Fatalf("expected unsupported version v1.99.0 to be rejected")
	}
	if _, err := eng.ValidateK8sVersion("  "); err == nil {
		t.Fatalf("expected empty version to be rejected")
	}
}

func TestVersionControllerRollingCanaryAndBatchConvergence(t *testing.T) {
	policies := []string{"rolling", "canary", "batch"}

	for _, pol := range policies {
		t.Run("policy_"+pol, func(t *testing.T) {
			eng := NewEngine()
			targetNodes := []string{"bmh-master-k8s-01", "bmh-worker-k8s-01", "bmh-worker-k8s-02"}
			targetVer := "v1.35.0"

			job, err := eng.TriggerClusterUpgrade("cluster-prod-gpu-k8s", targetVer, pol, targetNodes, 120, "Elena Rostova")
			if err != nil {
				t.Fatalf("TriggerClusterUpgrade(%s) failed: %v", pol, err)
			}
			if !job.IsUpgrading || job.TotalNodes != 3 || job.Policy != pol {
				t.Fatalf("unexpected initial job state: %+v", job)
			}

			// Step reconcile ticks deterministically until completion
			var latest = job
			for step := 0; step < 15 && latest.IsUpgrading; step++ {
				latest, err = eng.ReconcileVersionUpgrade("cluster-prod-gpu-k8s")
				if err != nil {
					t.Fatalf("ReconcileVersionUpgrade tick %d failed: %v", step+1, err)
				}
			}

			if latest.IsUpgrading || latest.Status != "READY" || latest.UpgradedNodesCount != 3 {
				t.Fatalf("expected job to converge cleanly to READY, got %+v", latest)
			}
			for _, st := range latest.Steps {
				if st.Status != "COMPLETED" {
					t.Fatalf("expected all 5 upgrade steps COMPLETED, got %+v", st)
				}
			}
			for _, name := range targetNodes {
				h, err := eng.GetHost(name)
				if err != nil {
					t.Fatalf("GetHost(%s) failed: %v", name, err)
				}
				if h.K8sVersion != targetVer || h.UpgradeStatus != "HEALTHY_VERIFIED" {
					t.Fatalf("expected host %s converged to %s HEALTHY_VERIFIED, got version=%s status=%s", name, targetVer, h.K8sVersion, h.UpgradeStatus)
				}
				if !strings.Contains(h.BootImage, targetVer) {
					t.Fatalf("expected host %s boot image updated with %s, got %s", name, targetVer, h.BootImage)
				}
				if len(h.SerialConsoleRecent) == 0 || !strings.Contains(h.SerialConsoleRecent[0], "VersionController") {
					t.Fatalf("expected SOL console trace from VersionController on %s", name)
				}
			}

			statusMap := eng.GetUpgradeStatus("cluster-prod-gpu-k8s")
			if statusMap["status"] != "READY" || statusMap["is_upgrading"] != false || statusMap["upgraded_nodes_count"] != 3 || statusMap["active_step"] != 6 {
				t.Fatalf("unexpected GetUpgradeStatus payload after convergence: %+v", statusMap)
			}
			if msg, _ := statusMap["message"].(string); !strings.Contains(msg, targetVer) {
				t.Fatalf("expected upgrade status message to mention %s, got %q", targetVer, msg)
			}

			logs := eng.GetLogs("k8s-install")
			foundControllerLog := false
			for _, l := range logs {
				if l["source"] == "version-controller" && strings.Contains(l["message"].(string), targetVer) {
					foundControllerLog = true
					break
				}
			}
			if !foundControllerLog {
				t.Fatalf("expected dynamic version-controller log entries in GetLogs(k8s-install)")
			}
		})
	}
}

func TestApplyVersionToNodesAndStartControllerGracefulStop(t *testing.T) {
	eng := NewEngine()
	ctx, cancel := context.WithCancel(context.Background())
	eng.StartController(ctx)
	defer cancel()

	upgraded, err := eng.ApplyVersionToNodes([]string{"bmh-worker-k8s-02"}, "v1.36.0-dev")
	if err != nil || len(upgraded) != 1 || upgraded[0] != "bmh-worker-k8s-02" {
		t.Fatalf("expected targeted node upgrade to succeed, got upgraded=%v err=%v", upgraded, err)
	}
	h, err := eng.GetHost("bmh-worker-k8s-02")
	if err != nil || h.K8sVersion != "v1.36.0-dev" {
		t.Fatalf("expected bmh-worker-k8s-02 at v1.36.0-dev, got %v (err=%v)", h, err)
	}

	if _, err := eng.ApplyVersionToNodes([]string{"bmh-nonexistent"}, "v1.35.0"); err == nil {
		t.Fatalf("expected ApplyVersionToNodes on nonexistent node to fail")
	}
}
