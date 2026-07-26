import {
  createJsonEventWriter,
  WorkflowEventEmitter,
} from "../events";
import {
  runWithWorkflowEventEmitter,
} from "../events/context";
import {
  getWorkflowContext,
  toWorkflowEventContext,
} from "../flow/context";
import { workflow } from "../flow/workflow";
import type { WorkflowTarget } from "../flow/types";
import { withLogSink } from "../logging";
import type { WorkflowEventListener } from "../events";
import type { WorkflowRunnerOptions } from "./types";

/**
 * Runs Workflow modules and publishes their lifecycle as JSON Lines.
 *
 * @remarks
 * By default, every event is serialized as one compact JSON object and written
 * to stdout through `console.log`. Calls to `log()` inside the Workflow become
 * typed `log` events and use the same output channel.
 *
 * The Runner may be reused. Concurrent executions share one monotonically
 * increasing event sequence while their Workflow and Logging contexts remain
 * isolated.
 */
export class WorkflowRunner {
  /** Typed Event Emitter shared by executions started by this Runner. */
  readonly events: WorkflowEventEmitter;

  readonly #removeJsonWriter: () => void;
  #disposed = false;

  /**
   * Creates a Workflow Runner.
   *
   * @param options - Optional Event Emitter and JSON line destination.
   */
  constructor(options: WorkflowRunnerOptions = {}) {
    this.events = options.emitter ?? new WorkflowEventEmitter();
    this.#removeJsonWriter = this.events.on(
      createJsonEventWriter(options.logWriter),
    );
  }

  /**
   * Runs a Workflow module and emits lifecycle, phase, and log events.
   *
   * @typeParam TOutput - Expected final Workflow result.
   * @typeParam TArgs - Type of caller-supplied arguments.
   * @param target - Module path, file URL, or explicit script reference.
   * @param args - Value injected into the Workflow handler and context.
   * @returns The Workflow handler's final result.
   * @throws Error Re-throws Workflow loading and execution errors after
   * emitting `workflow:error`.
   */
  run<TOutput = unknown, TArgs = unknown>(
    target: WorkflowTarget,
    args?: TArgs,
  ): Promise<TOutput> {
    if (this.#disposed) {
      throw new Error("WorkflowRunner has been disposed.");
    }

    return runWithWorkflowEventEmitter(
      this.events,
      () => withLogSink(
        (message) => {
          const context = getWorkflowContext();
          if (!context) {
            return;
          }

          this.events.emit({
            type: "log",
            ...toWorkflowEventContext(context),
            message,
            ...(context.phase === undefined
              ? {}
              : { phase: context.phase }),
          });
        },
        () => workflow<TOutput, TArgs>(target, args),
      ),
    );
  }

  /**
   * Subscribes to every event emitted by this Runner.
   *
   * @param listener - Callback invoked synchronously for each event.
   * @returns A function that removes the subscription.
   */
  on(listener: WorkflowEventListener): () => void {
    return this.events.on(listener);
  }

  /**
   * Detaches the JSON writer installed by the constructor.
   *
   * @remarks
   * Existing external listeners remain registered. A disposed Runner cannot
   * start new executions.
   */
  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#removeJsonWriter();
  }
}
