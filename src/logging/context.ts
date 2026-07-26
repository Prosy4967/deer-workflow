import { AsyncLocalStorage } from "node:async_hooks";

import type {
  LoggingContext,
  LogSink,
} from "./types";

const loggingContextStorage = new AsyncLocalStorage<LoggingContext>();

/**
 * Returns the Log Sink bound to the current asynchronous call chain.
 *
 * @internal
 * @returns The active sink, or `undefined` when the default sink should be
 * used.
 */
export function getActiveLogSink(): LogSink | undefined {
  return loggingContextStorage.getStore()?.sink;
}

/**
 * Runs a callback with an async-local Log Sink.
 *
 * @internal
 * @param sink - Sink to bind to the callback.
 * @param callback - Work executed inside the Logging context.
 * @returns The callback's immediate value or Promise.
 */
export function runWithLogSink<TOutput>(
  sink: LogSink,
  callback: () => TOutput,
): TOutput {
  return loggingContextStorage.run({ sink }, callback);
}

