/**
 * Error caused by invalid CLI arguments or input.
 */
export class CliUsageError extends Error {
  /**
   * Creates a user-facing CLI usage error.
   *
   * @param message - Actionable explanation of the invalid input.
   */
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}
