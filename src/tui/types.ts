import type { WorkflowEvent } from "../events";

/**
 * Writable terminal-like destination used by the TUI layer.
 *
 * @internal
 */
export interface TuiStream {
  /** Whether the destination is attached to an interactive terminal. */
  readonly isTTY?: boolean;
  /** Current terminal width when the destination exposes it. */
  readonly columns?: number;
  /** Current terminal height when the destination exposes it. */
  readonly rows?: number;

  /**
   * Writes one chunk.
   *
   * @param chunk - Text and optional terminal control sequences to write.
   * @returns The destination-specific write result.
   */
  write(chunk: string): unknown;
}

/**
 * A command suggested after a task completes.
 *
 * @internal
 */
export interface TuiNextStep {
  /** Human-readable explanation of the command. */
  readonly label: string;
  /** Copyable command line. */
  readonly command: string;
}

/**
 * Values supplied when completing a TUI task.
 *
 * @internal
 */
export interface TuiTaskCompletion {
  /** Commands that replace any next steps declared when the task started. */
  readonly nextSteps?: readonly TuiNextStep[];
}

/**
 * Content rendered for one long-running terminal task.
 *
 * @internal
 */
export interface TuiTaskOptions {
  /** Product or section title displayed above the task. */
  readonly title?: string;
  /** Present-tense description shown while the task is active. */
  readonly activity: string;
  /** Approximate duration shown before work begins. */
  readonly estimate: string;
  /** Past-tense message shown on successful completion. */
  readonly successMessage: string;
  /** Message shown when the task fails. */
  readonly failureMessage: string;
  /** Optional commands shown only after successful completion. */
  readonly nextSteps?: readonly TuiNextStep[];
}

/**
 * Content and execution context for the Workflow dashboard.
 *
 * @internal
 */
export interface WorkflowTuiTaskOptions extends TuiTaskOptions {
  /** Absolute directory used to resolve the host-started Workflow. */
  readonly workingDirectory: string;
}

/**
 * Handle for updating and completing an active TUI task.
 *
 * @internal
 */
export interface TuiTask {
  /**
   * Replaces the active task description.
   *
   * @param activity - New present-tense activity text.
   */
  updateActivity(activity: string): void;

  /**
   * Writes a complete event or log line without corrupting the animation.
   *
   * @param line - Complete line to write to the TUI destination.
   */
  writeLine(line: string): void;

  /**
   * Completes the task and renders its success state.
   *
   * @param completion - Optional dynamic next steps discovered during work.
   */
  succeed(completion?: TuiTaskCompletion): void;

  /** Completes the task and renders its failure state. */
  fail(): void;

  /** Stops the task without rendering a terminal state. */
  dispose(): void;
}

/**
 * Event-aware task handle used by the Workflow execution dashboard.
 *
 * @internal
 */
export interface WorkflowTuiTask extends TuiTask {
  /**
   * Applies one structured Workflow event to the dashboard.
   *
   * @param event - Event emitted by the active Workflow Runner.
   */
  handleEvent(event: WorkflowEvent): void;
}

/**
 * Dependencies and terminal capability inputs for {@link TerminalUI}.
 *
 * @internal
 */
export interface TerminalUIOptions {
  /** Destination for TUI and event output. */
  readonly stream?: TuiStream;
  /** Environment used to detect terminal and color support. */
  readonly environment?: Readonly<Record<string, string | undefined>>;
}
