import type { WorkflowMeta } from "../flow/types";

/**
 * Event names emitted during Workflow execution.
 */
export type WorkflowEventType =
  | "workflow:start"
  | "workflow:meta"
  | "workflow:end"
  | "workflow:error"
  | "workflow:phase:start"
  | "workflow:phase:end"
  | "log";

/**
 * Workflow identity fields included in every event.
 */
export interface WorkflowEventContext {
  /** Unique Workflow invocation identifier. */
  readonly workflowId: string;

  /** Parent invocation identifier for a nested Workflow. */
  readonly parentWorkflowId?: string;

  /** Workflow nesting depth. */
  readonly depth: number;

  /** Absolute path of the Workflow module. */
  readonly scriptPath: string;
}

/**
 * Metadata assigned by {@link WorkflowEventEmitter}.
 */
export interface WorkflowEventEnvelope {
  /** Monotonically increasing sequence number within one Emitter. */
  readonly sequence: number;

  /** ISO-8601 timestamp recorded when the event is emitted. */
  readonly timestamp: string;
}

/**
 * Event emitted immediately before a Workflow module is loaded.
 */
export interface WorkflowStartEventInput extends WorkflowEventContext {
  readonly type: "workflow:start";
}

/**
 * Event emitted after a Workflow module's optional metadata is loaded.
 */
export interface WorkflowMetaEventInput extends WorkflowEventContext {
  readonly type: "workflow:meta";

  /** Validated static identity and ordered phase plan. */
  readonly meta: WorkflowMeta;
}

/**
 * Event emitted after a Workflow finishes successfully.
 */
export interface WorkflowEndEventInput extends WorkflowEventContext {
  readonly type: "workflow:end";

  /** Total Workflow runtime in milliseconds. */
  readonly durationMs: number;
}

/**
 * JSON-safe representation of an execution error.
 */
export interface SerializedWorkflowError {
  /** Error class or constructor name. */
  readonly name: string;

  /** Human-readable error message. */
  readonly message: string;

  /** Stack trace when one is available. */
  readonly stack?: string;
}

/**
 * Event emitted when a Workflow terminates with an error.
 */
export interface WorkflowErrorEventInput extends WorkflowEventContext {
  readonly type: "workflow:error";

  /** Total Workflow runtime before failure, in milliseconds. */
  readonly durationMs: number;

  /** JSON-safe failure details. */
  readonly error: SerializedWorkflowError;
}

/**
 * Event emitted when a Workflow enters a named phase.
 */
export interface WorkflowPhaseStartEventInput extends WorkflowEventContext {
  readonly type: "workflow:phase:start";

  /** Phase title supplied to `phase()`. */
  readonly phase: string;
}

/**
 * Event emitted when a Workflow leaves a named phase.
 */
export interface WorkflowPhaseEndEventInput extends WorkflowEventContext {
  readonly type: "workflow:phase:end";

  /** Phase that has just completed. */
  readonly phase: string;

  /** Time spent in the phase, in milliseconds. */
  readonly durationMs: number;
}

/**
 * Event emitted by `log()` while a Workflow Runner is active.
 */
export interface WorkflowLogEventInput extends WorkflowEventContext {
  readonly type: "log";

  /** Human-readable progress message, optionally formatted as Markdown. */
  readonly message: string;

  /** Active phase when the message was emitted. */
  readonly phase?: string;
}

/**
 * Event payload accepted by {@link WorkflowEventEmitter.emit}.
 */
export type WorkflowEventInput =
  | WorkflowStartEventInput
  | WorkflowMetaEventInput
  | WorkflowEndEventInput
  | WorkflowErrorEventInput
  | WorkflowPhaseStartEventInput
  | WorkflowPhaseEndEventInput
  | WorkflowLogEventInput;

/**
 * Complete JSON event delivered to listeners and writers.
 */
export type WorkflowEvent = WorkflowEventInput & WorkflowEventEnvelope;

/**
 * Receives one complete Workflow event.
 *
 * @param event - Immutable event envelope and payload.
 */
export type WorkflowEventListener = (event: WorkflowEvent) => void;

/**
 * Receives one serialized JSON event line.
 *
 * @param line - Compact JSON without a trailing newline.
 */
export type LogWriter = (line: string) => void;
