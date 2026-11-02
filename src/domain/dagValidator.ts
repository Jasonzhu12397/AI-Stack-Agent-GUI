import { WorkflowNode, WorkflowEdge } from '../contracts/types';

export interface DAGValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  execution_layers?: string[][]; // Topological layers
}

export class DAGValidator {
  public static validate(nodes: WorkflowNode[], edges: WorkflowEdge[]): DAGValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!nodes || nodes.length === 0) {
      return { is_valid: false, errors: ['Workflow has no nodes.'], warnings };
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    if (nodeIds.size !== nodes.length) {
      errors.push('Workflow contains duplicate node IDs.');
    }

    // 1. Entry node verification
    const startNodes = nodes.filter(n => n.type === 'START');
    if (startNodes.length === 0) {
      errors.push('Workflow must contain at least one START node.');
    } else if (startNodes.length > 1) {
      errors.push('Workflow currently supports only a single START node entry point.');
    }

    // 2. End node verification
    const endNodes = nodes.filter(n => n.type === 'END');
    if (endNodes.length === 0) {
      warnings.push('Workflow has no designated END node; will terminate when all branches exhaust.');
    }

    // 3. Dangling edges check
    for (const edge of edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(`Edge '${edge.id}' has dangling source node '${edge.source}'.`);
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge '${edge.id}' has dangling target node '${edge.target}'.`);
      }
    }

    if (errors.length > 0) {
      return { is_valid: false, errors, warnings };
    }

    // 4. Cycle Detection & Topological Sort (Kahn's Algorithm)
    const inDegree: Record<string, number> = {};
    const adjacency: Record<string, string[]> = {};

    for (const node of nodes) {
      inDegree[node.id] = 0;
      adjacency[node.id] = [];
    }

    for (const edge of edges) {
      adjacency[edge.source].push(edge.target);
      inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
    }

    const queue: string[] = [];
    for (const [id, deg] of Object.entries(inDegree)) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const sortedOrder: string[] = [];
    const layers: string[][] = [];

    let currentLayer = [...queue];
    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      const nextLayer: string[] = [];

      for (const nodeId of currentLayer) {
        sortedOrder.push(nodeId);
        for (const neighbor of adjacency[nodeId]) {
          inDegree[neighbor]--;
          if (inDegree[neighbor] === 0) {
            nextLayer.push(neighbor);
          }
        }
      }
      currentLayer = nextLayer;
    }

    if (sortedOrder.length !== nodes.length) {
      errors.push('Cycle detected in Workflow graph! Workflow must be a Directed Acyclic Graph (DAG).');
      return { is_valid: false, errors, warnings };
    }

    return {
      is_valid: true,
      errors: [],
      warnings,
      execution_layers: layers,
    };
  }
}
