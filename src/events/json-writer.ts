import type {
  LogWriter,
  WorkflowEventListener,
} from "./types";

/**
 * Creates a listener that serializes each Workflow event as compact JSON.
 *
 * @param logWriter - Destination for individual JSON lines. Defaults to
 * `console.log`.
 * @returns A listener suitable for {@link WorkflowEventEmitter.on}.
 *
 * @example
 * ```ts
 * emitter.on(createJsonEventWriter((line) => process.stdout.write(`${line}\n`)));
 * ```
 */
export function createJsonEventWriter(
  logWriter: LogWriter = (line) => console.log(line),
): WorkflowEventListener {
  return (event) => {
    logWriter(JSON.stringify(event));
  };
}

