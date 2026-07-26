/**
 * Parsed arguments accepted by the `run` CLI command.
 */
export interface RunCommandArguments {
  /** Workflow module path supplied by the user. */
  readonly scriptPath: string;

  /** Whether stdout should contain only the JSONL Workflow Event Stream. */
  readonly print: boolean;

  /** JSON text supplied directly through `--input`. */
  readonly inlineInput?: string;

  /** Path to a JSON document supplied through `--input-file`. */
  readonly inputFile?: string;
}
