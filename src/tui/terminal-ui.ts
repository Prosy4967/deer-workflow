import { TuiStyle } from "./style";
import { AnimatedTuiTask } from "./task";
import { WorkflowDashboard } from "./workflow-dashboard";
import type {
  TerminalUIOptions,
  TuiStream,
  TuiTask,
  TuiTaskOptions,
  WorkflowTuiTaskOptions,
  WorkflowTuiTask,
} from "./types";

/**
 * Coordinates terminal capability detection and long-running task views.
 *
 * @remarks
 * Visual output is enabled only for an interactive, non-dumb terminal. Event
 * lines still pass through unchanged when visual output is disabled.
 *
 * @internal
 */
export class TerminalUI {
  readonly #interactive: boolean;
  readonly #stream: TuiStream;
  readonly #style: TuiStyle;
  #activeTask: TuiTask | undefined;

  /**
   * Creates a terminal UI.
   *
   * @param options - Optional stream and environment overrides.
   */
  constructor(options: TerminalUIOptions = {}) {
    const environment = options.environment ?? process.env;
    this.#stream = options.stream ?? process.stderr;
    this.#interactive =
      this.#stream.isTTY === true && environment.TERM !== "dumb";
    const colorEnabled =
      this.#interactive &&
      !Object.prototype.hasOwnProperty.call(environment, "NO_COLOR");
    this.#style = new TuiStyle(colorEnabled);
  }

  /**
   * Starts one indefinite task animation.
   *
   * @param options - Task copy and optional next steps.
   * @returns A handle used to write event lines and finish the task.
   * @throws Error When another task is already active on this UI.
   */
  startTask(options: TuiTaskOptions): TuiTask {
    if (this.#activeTask !== undefined) {
      throw new Error("The terminal UI already has an active task.");
    }

    const task = new AnimatedTuiTask(
      options,
      this.#stream,
      this.#style,
      this.#interactive,
      () => {
        if (this.#activeTask === task) {
          this.#activeTask = undefined;
        }
      },
    );
    this.#activeTask = task;
    return task;
  }

  /**
   * Starts an event-aware Workflow dashboard.
   *
   * @param options - Workflow task copy.
   * @returns A dashboard handle that accepts structured Workflow events.
   * @throws Error When another task is already active on this UI.
   */
  startWorkflowTask(options: WorkflowTuiTaskOptions): WorkflowTuiTask {
    if (this.#activeTask !== undefined) {
      throw new Error("The terminal UI already has an active task.");
    }

    const task = new WorkflowDashboard(
      options,
      this.#stream,
      this.#style,
      this.#interactive,
      () => {
        if (this.#activeTask === task) {
          this.#activeTask = undefined;
        }
      },
    );
    this.#activeTask = task;
    return task;
  }
}
