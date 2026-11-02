import { RunState } from '../contracts/types';

export const VALID_TRANSITIONS: Record<RunState, RunState[]> = {
  PENDING: ['PLANNING', 'FAILED', 'CANCEL_REQUESTED'],
  PLANNING: ['QUEUED', 'WAITING_APPROVAL', 'FAILED', 'CANCEL_REQUESTED'],
  QUEUED: ['RUNNING', 'CANCEL_REQUESTED', 'FAILED'],
  RUNNING: ['SUCCEEDED', 'FAILED', 'WAITING_APPROVAL', 'CANCEL_REQUESTED', 'PARTIALLY_SUCCEEDED', 'COMPENSATING'],
  WAITING_APPROVAL: ['QUEUED', 'FAILED', 'CANCEL_REQUESTED'],
  CANCEL_REQUESTED: ['CANCELLED', 'FAILED', 'PARTIALLY_SUCCEEDED'],
  COMPENSATING: ['FAILED', 'PARTIALLY_SUCCEEDED'],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
  PARTIALLY_SUCCEEDED: [],
};

export const TERMINAL_STATES: Set<RunState> = new Set([
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'PARTIALLY_SUCCEEDED',
]);

export interface TransitionResult {
  ok: boolean;
  previous_state: RunState;
  next_state: RunState;
  reason?: string;
}

export class RunStateMachine {
  /**
   * Evaluates if a state transition is legal according to the architecture state graph.
   * Enforces compare-and-swap semantics: terminal states can NEVER be overwritten.
   */
  public static canTransition(from: RunState, to: RunState): boolean {
    if (TERMINAL_STATES.has(from)) {
      return false;
    }
    const allowed = VALID_TRANSITIONS[from];
    return Array.isArray(allowed) && allowed.includes(to);
  }

  /**
   * Applies transition with error message
   */
  public static transition(currentState: RunState, targetState: RunState): TransitionResult {
    if (TERMINAL_STATES.has(currentState)) {
      return {
        ok: false,
        previous_state: currentState,
        next_state: currentState,
        reason: `Cannot transition from terminal state ${currentState} to ${targetState}. Terminal states are immutable.`,
      };
    }

    if (!this.canTransition(currentState, targetState)) {
      return {
        ok: false,
        previous_state: currentState,
        next_state: currentState,
        reason: `Illegal state transition from ${currentState} to ${targetState}. Allowed: [${(VALID_TRANSITIONS[currentState] || []).join(', ')}]`,
      };
    }

    return {
      ok: true,
      previous_state: currentState,
      next_state: targetState,
    };
  }

  public static isTerminal(state: RunState): boolean {
    return TERMINAL_STATES.has(state);
  }
}
