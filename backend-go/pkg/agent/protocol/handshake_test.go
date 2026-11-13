package protocol

import (
	"testing"
)

func TestHandshakeValidation(t *testing.T) {
	payload := map[string]any{
		"cluster_id": "cluster-prod-gpu-k8s",
		"bmh_count":  15,
		"crd_digest": "sha256-abc123456",
	}

	msg, err := NewHandshakeMessage("tr-test-01", PhasePreflightPing, "agent-1", "agent-2", payload)
	if err != nil {
		t.Fatalf("failed to create handshake message: %v", err)
	}

	if err := ValidateMessage(msg); err != nil {
		t.Fatalf("validation failed on legitimate message: %v", err)
	}

	// Corrupt payload
	msg.Payload["tampered"] = true
	if err := ValidateMessage(msg); err == nil {
		t.Fatalf("expected validation error on tampered payload")
	}
}
