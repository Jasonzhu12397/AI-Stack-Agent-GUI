import test from 'node:test';
import assert from 'node:assert/strict';
import { DAGValidator } from './dagValidator';
import { WorkflowNode, WorkflowEdge } from '../contracts/types';

test('DAGValidator approves valid DAG and computes topological layers', () => {
  const nodes: WorkflowNode[] = [
    { id: 'start_1', name: 'Start', type: 'START', config: {}, position: { x: 0, y: 0 } },
    { id: 'llm_1', name: 'Plan', type: 'LLM', config: {}, position: { x: 100, y: 0 } },
    { id: 'tool_1', name: 'Execute', type: 'TOOL', config: {}, position: { x: 200, y: 0 } },
    { id: 'end_1', name: 'End', type: 'END', config: {}, position: { x: 300, y: 0 } },
  ];

  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'start_1', target: 'llm_1' },
    { id: 'e2', source: 'llm_1', target: 'tool_1' },
    { id: 'e3', source: 'tool_1', target: 'end_1' },
  ];

  const result = DAGValidator.validate(nodes, edges);
  assert.equal(result.is_valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.execution_layers?.length, 4);
});

test('DAGValidator detects cycle in graph', () => {
  const nodes: WorkflowNode[] = [
    { id: 'start_1', name: 'Start', type: 'START', config: {}, position: { x: 0, y: 0 } },
    { id: 'node_a', name: 'A', type: 'TOOL', config: {}, position: { x: 100, y: 0 } },
    { id: 'node_b', name: 'B', type: 'TOOL', config: {}, position: { x: 200, y: 0 } },
  ];

  // Cycle: A -> B -> A
  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'start_1', target: 'node_a' },
    { id: 'e2', source: 'node_a', target: 'node_b' },
    { id: 'e3', source: 'node_b', target: 'node_a' },
  ];

  const result = DAGValidator.validate(nodes, edges);
  assert.equal(result.is_valid, false);
  assert.match(result.errors[0], /cycle detected/i);
});

test('DAGValidator flags missing START node', () => {
  const nodes: WorkflowNode[] = [
    { id: 'node_a', name: 'A', type: 'TOOL', config: {}, position: { x: 0, y: 0 } },
  ];
  const edges: WorkflowEdge[] = [];

  const result = DAGValidator.validate(nodes, edges);
  assert.equal(result.is_valid, false);
  assert.match(result.errors[0], /must contain at least one start/i);
});
