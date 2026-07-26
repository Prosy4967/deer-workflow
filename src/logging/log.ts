import { getActiveLogSink, runWithLogSink } from "./context";
import type { LogSink } from "./types";

const defaultLogSink: LogSink = (message) => {
  console.error(message);
};

/**
 * Emits a progress message to the active Log Sink.
 *
 * @remarks
 * The default sink writes to stderr so logs do not corrupt structured results
 * written to stdout. Use {@link withLogSink} to route messages to a Workflow
 * progress UI, Journal, test collector, or another destination. Messages may
 * contain Markdown; the interactive CLI renders a practical terminal-safe
 * subset while event consumers receive the original string.
 *
 * @param message - Human-readable progress message, optionally as Markdown.
 * @throws TypeError When `message` is empty or contains only whitespace.
 *
 * @example
 * ```ts
 * log("Running repository checks");
 * ```
 */
export function log(message: string): void {
  if (message.trim().length === 0) {
    throw new TypeError("log() requires a non-empty message.");
  }

  const sink = getActiveLogSink() ?? defaultLogSink;
  sink(message);
}

/**
 * Runs a callback with an async-local Log Sink.
 *
 * @remarks
 * Nested and concurrent calls remain isolated through `AsyncLocalStorage`.
 * When the callback finishes, the previous sink is restored automatically.
 *
 * @typeParam TOutput - Callback return type.
 * @param sink - Function that receives messages emitted through {@link log}.
 * @param callback - Synchronous or asynchronous work that uses the sink.
 * @returns The callback's immediate value or Promise.
 *
 * @example
 * ```ts
 * const messages: string[] = [];
 * await withLogSink(
 *   (message) => messages.push(message),
 *   async () => {
 *     log("Research started");
 *     await research();
 *   },
 * );
 * ```
 */
export function withLogSink<TOutput>(
  sink: LogSink,
  callback: () => TOutput,
): TOutput {
  return runWithLogSink(sink, callback);
}
