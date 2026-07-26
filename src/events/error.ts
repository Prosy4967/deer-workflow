import type { SerializedWorkflowError } from "./types";

/**
 * Converts an unknown thrown value into a JSON-safe error object.
 *
 * @param error - Value caught from Workflow execution.
 * @returns Serializable error name, message, and optional stack.
 */
export function serializeWorkflowError(
  error: unknown,
): SerializedWorkflowError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }

  return {
    name: "Error",
    message: String(error),
  };
}
