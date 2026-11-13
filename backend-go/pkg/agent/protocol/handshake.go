package protocol

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// HandshakePhase represents the stage in the Dual-Agent pivot lifecycle.
type HandshakePhase string

const (
	PhasePreflightPing        HandshakePhase = "PHASE_1_PREFLIGHT_PING"
	PhaseCRDDigestExchange    HandshakePhase = "PHASE_2_CRD_DIGEST_EXCHANGE"
	PhaseLeadershipTransfer   HandshakePhase = "PHASE_3_LEADERSHIP_TRANSFER"
	PhaseEphStandbyDecouple   HandshakePhase = "PHASE_4_EPH_STANDBY_DECOUPLE"
)

// HandshakeMessage encapsulates coordination payloads exchanged between
// Agent 1 (Eph-Node) and Agent 2 (Target Cluster).
type HandshakeMessage struct {
	TraceID     string         `json:"trace_id"`
	Phase       HandshakePhase `json:"phase"`
	SenderID    string         `json:"sender_id"`
	ReceiverID  string         `json:"receiver_id"`
	Timestamp   time.Time      `json:"timestamp"`
	PayloadHash string         `json:"payload_hash"`
	Payload     map[string]any `json:"payload"`
}

// ComputeDigest generates a SHA-256 fingerprint of the CRD state payload.
func ComputeDigest(data any) (string, error) {
	bytes, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(bytes)
	return hex.EncodeToString(hash[:]), nil
}

// ValidateMessage verifies payload integrity against the transmitted SHA-256 hash.
func ValidateMessage(msg *HandshakeMessage) error {
	if msg == nil {
		return errors.New("handshake message cannot be nil")
	}
	if msg.TraceID == "" {
		return errors.New("trace_id is required")
	}
	if msg.PayloadHash == "" {
		return errors.New("payload_hash is missing")
	}

	computed, err := ComputeDigest(msg.Payload)
	if err != nil {
		return fmt.Errorf("failed to compute payload hash: %w", err)
	}

	if computed != msg.PayloadHash {
		return fmt.Errorf("hash mismatch: expected %s, got %s", msg.PayloadHash, computed)
	}

	return nil
}

// NewHandshakeMessage constructs a cryptographically validated handshake package.
func NewHandshakeMessage(traceID string, phase HandshakePhase, sender, receiver string, payload map[string]any) (*HandshakeMessage, error) {
	hash, err := ComputeDigest(payload)
	if err != nil {
		return nil, err
	}

	return &HandshakeMessage{
		TraceID:     traceID,
		Phase:       phase,
		SenderID:    sender,
		ReceiverID:  receiver,
		Timestamp:   time.Now().UTC(),
		PayloadHash: hash,
		Payload:     payload,
	}, nil
}
