/**
 * Parsed arguments accepted by the `run` CLI command.
 */
export interface RunCommandArguments {
  /** Workflow module path supplied by the user. */
  readonly scriptPath: string;

  /** JSON text supplied directly through `--input`. */
  readonly inlineInput?: string;

  /** Path to a JSON document supplied through `--input-file`. */
  readonly inputFile?: string;
}
