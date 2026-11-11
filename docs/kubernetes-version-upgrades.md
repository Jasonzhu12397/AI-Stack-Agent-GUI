# Metal3 Kubernetes Version Upgrades

The Metal3 fleet upgrade workflow currently supports these target Kubernetes releases:

- `v1.33.0` (displayed as `v1.33`)
- `v1.35.0` (displayed as `v1.35`)
- `v1.36.0` (displayed as `v1.36`)

The fleet view filters the selector to versions newer than the active cluster version. Applying a target runs the existing rolling-upgrade workflow: control-plane nodes first, followed by worker nodes. Unsupported targets and same-version or downgrade requests are rejected by both the TypeScript and Go API implementations.

These repository Metal3 upgrade handlers are simulation implementations. They validate the request and update simulated cluster state and logs; they do not invoke real kubeadm, Cluster API, Metal3, Ironic, or bare-metal operations.
