import { AsyncLocalStorage } from "node:async_hooks";

import type { WorkflowEventEmitter } from "./emitter";
import type {
  WorkflowEvent,
  WorkflowEventInput,
} from "./types";

const eventEmitterStorage =
  new AsyncLocalStorage<WorkflowEventEmitter>();

/**
 * Returns the Emitter bound to the current asynchronous execution chain.
 *
 * @internal
 */
export function getActiveWorkflowEventEmitter():
  | WorkflowEventEmitter
  | undefined {
  return eventEmitterStorage.getStore();
}

/**
 * Runs a callback with an async-local Workflow Event Emitter.
 *
 * @internal
 */
export function runWithWorkflowEventEmitter<TOutput>(
  emitter: WorkflowEventEmitter,
  callback: () => TOutput,
): TOutput {
  return eventEmitterStorage.run(emitter, callback);
}

/**
 * Emits through the active Emitter when one is installed.
 *
 * @internal
 */
export function emitWorkflowEvent(
  input: WorkflowEventInput,
): WorkflowEvent | undefined {
  return getActiveWorkflowEventEmitter()?.emit(input);
}

