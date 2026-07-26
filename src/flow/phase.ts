import { emitWorkflowEvent } from "../events/context";
import { getWorkflowContext } from "./context";
import { toWorkflowEventContext } from "./context";
import type { WorkflowExecutionContext } from "./types";

const phaseStartTimes = new WeakMap<WorkflowExecutionContext, number>();

/**
 * Error raised when {@link phase} is called without an active Workflow.
 */
export class PhaseContextError extends Error {
  /**
   * Creates an error for a missing Workflow execution context.
   */
  constructor() {
    super("phase() can only be called while a Workflow is running.");
    this.name = "PhaseContextError";
  }
}

/**
 * Assigns subsequent work to a named progress phase in the active Workflow.
 *
 * @param title - Human-readable phase title.
 * @throws {@link PhaseContextError} When no Workflow is currently running.
 * @throws TypeError When `title` is empty or contains only whitespace.
 *
 * @example
 * ```ts
 * phase("Research");
 * const sources = await parallel(researchTasks);
 * ```
 */
export function phase(title: string): void {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new TypeError("phase() requires a non-empty title.");
  }

  const context = getWorkflowContext();
  if (!context) {
    throw new PhaseContextError();
  }

  if (context.phase === normalizedTitle) {
    return;
  }

  endCurrentPhase(context);
  context.phase = normalizedTitle;
  phaseStartTimes.set(context, performance.now());
  emitWorkflowEvent({
    type: "workflow:phase:start",
    ...toWorkflowEventContext(context),
    phase: normalizedTitle,
  });
}

/**
 * Reads the active Workflow's current phase.
 *
 * @returns The phase title, or `undefined` outside a Workflow or before the
 * first call to {@link phase}.
 */
export function getCurrentPhase(): string | undefined {
  return getWorkflowContext()?.phase;
}

/**
 * Ends the active phase and emits its lifecycle event.
 *
 * @internal
 */
export function endCurrentPhase(
  context: WorkflowExecutionContext = requireWorkflowContext(),
): void {
  const currentPhase = context.phase;
  if (!currentPhase) {
    return;
  }

  const startedAt = phaseStartTimes.get(context);
  context.phase = undefined;
  phaseStartTimes.delete(context);

  emitWorkflowEvent({
    type: "workflow:phase:end",
    ...toWorkflowEventContext(context),
    phase: currentPhase,
    durationMs: elapsedMilliseconds(startedAt),
  });
}

function requireWorkflowContext(): WorkflowExecutionContext {
  const context = getWorkflowContext();
  if (!context) {
    throw new PhaseContextError();
  }
  return context;
}

function elapsedMilliseconds(startedAt: number | undefined): number {
  return startedAt === undefined
    ? 0
    : Math.max(0, performance.now() - startedAt);
}
