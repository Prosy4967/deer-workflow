import type {
  LogWriter,
  WorkflowEventEmitter,
} from "../events";

/**
 * Configuration accepted by {@link WorkflowRunner}.
 */
export interface WorkflowRunnerOptions {
  /**
   * Receives one compact JSON event per call.
   *
   * @defaultValue A writer that calls `console.log(line)`.
   */
  readonly logWriter?: LogWriter;

  /**
   * Event Emitter used for this Runner's executions.
   *
   * @defaultValue A new {@link WorkflowEventEmitter}.
   */
  readonly emitter?: WorkflowEventEmitter;
}
