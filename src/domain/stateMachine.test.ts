import test from 'node:test';
import assert from 'node:assert/strict';
import { RunStateMachine } from './stateMachine';

test('RunStateMachine allows valid transitions according to contract', () => {
  assert.equal(RunStateMachine.canTransition('PENDING', 'PLANNING'), true);
  assert.equal(RunStateMachine.canTransition('PLANNING', 'QUEUED'), true);
  assert.equal(RunStateMachine.canTransition('QUEUED', 'RUNNING'), true);
  assert.equal(RunStateMachine.canTransition('RUNNING', 'WAITING_APPROVAL'), true);
  assert.equal(RunStateMachine.canTransition('WAITING_APPROVAL', 'QUEUED'), true);
  assert.equal(RunStateMachine.canTransition('RUNNING', 'SUCCEEDED'), true);
  assert.equal(RunStateMachine.canTransition('RUNNING', 'CANCEL_REQUESTED'), true);
  assert.equal(RunStateMachine.canTransition('CANCEL_REQUESTED', 'CANCELLED'), true);
});

test('RunStateMachine forbids invalid transitions', () => {
  assert.equal(RunStateMachine.canTransition('PENDING', 'SUCCEEDED'), false);
  assert.equal(RunStateMachine.canTransition('QUEUED', 'WAITING_APPROVAL'), false);
  assert.equal(RunStateMachine.canTransition('PLANNING', 'RUNNING'), false);
});

test('RunStateMachine enforces terminal state immutability', () => {
  // SUCCEEDED is terminal and cannot transition to anything
  assert.equal(RunStateMachine.isTerminal('SUCCEEDED'), true);
  assert.equal(RunStateMachine.canTransition('SUCCEEDED', 'RUNNING'), false);
  assert.equal(RunStateMachine.canTransition('SUCCEEDED', 'FAILED'), false);

  const res = RunStateMachine.transition('SUCCEEDED', 'RUNNING');
  assert.equal(res.ok, false);
  assert.match(res.reason || '', /immutable/i);
});

test('RunStateMachine returns correct transition result', () => {
  const valid = RunStateMachine.transition('PENDING', 'PLANNING');
  assert.equal(valid.ok, true);
  assert.equal(valid.next_state, 'PLANNING');

  const invalid = RunStateMachine.transition('PENDING', 'SUCCEEDED');
  assert.equal(invalid.ok, false);
  assert.equal(invalid.next_state, 'PENDING');
});
