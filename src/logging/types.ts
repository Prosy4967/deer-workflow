/**
 * Receives a message emitted through {@link log}.
 *
 * @param message - Human-readable Workflow progress message.
 */
export type LogSink = (message: string) => void;

/**
 * Async-local Logging state.
 *
 * @internal
 */
export interface LoggingContext {
  /** Sink that receives logs in the current asynchronous call chain. */
  readonly sink: LogSink;
}
