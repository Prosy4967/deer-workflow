import { AsyncLocalStorage } from "node:async_hooks";

import type { WorkflowEventContext } from "../events";
import type { WorkflowExecutionContext } from "./types";

const workflowContextStorage =
  new AsyncLocalStorage<WorkflowExecutionContext>();

/**
 * Returns the execution context associated with the current asynchronous
 * Workflow call chain.
 *
 * @typeParam TArgs - Expected Workflow argument type.
 * @returns The active context, or `undefined` outside {@link workflow}.
 */
export function getWorkflowContext<TArgs = unknown>():
  WorkflowExecutionContext<TArgs> | undefined {
  return workflowContextStorage.getStore() as
    WorkflowExecutionContext<TArgs> | undefined;
}

/**
 * Runs a callback inside a Workflow execution context.
 *
 * @internal
 * @param context - Context to bind to the callback's asynchronous call chain.
 * @param callback - Work executed inside the context.
 * @returns The callback's immediate value or Promise.
 */
export function runInWorkflowContext<TOutput>(
  context: WorkflowExecutionContext,
  callback: () => TOutput,
): TOutput {
  return workflowContextStorage.run(context, callback);
}

/**
 * Converts internal Workflow context into public event identity fields.
 *
 * @internal
 */
export function toWorkflowEventContext(
  context: WorkflowExecutionContext,
): WorkflowEventContext {
  return {
    workflowId: context.id,
    parentWorkflowId: context.parentId,
    depth: context.depth,
    scriptPath: context.scriptPath,
  };
}
