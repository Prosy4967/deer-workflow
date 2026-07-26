const codes = {
  bold: "\u001B[1m",
  brightCyan: "\u001B[96m",
  brightWhite: "\u001B[1;97m",
  cyan: "\u001B[36m",
  dim: "\u001B[2m",
  green: "\u001B[32m",
  red: "\u001B[31m",
  reset: "\u001B[0m",
  yellow: "\u001B[33m",
} as const;

/**
 * Applies terminal styles only when color output is enabled.
 *
 * @internal
 */
export class TuiStyle {
  constructor(private readonly enabled: boolean) {}

  bold(value: string): string {
    return this.wrap(codes.bold, value);
  }

  brightCyan(value: string): string {
    return this.wrap(codes.brightCyan, value);
  }

  brightWhite(value: string): string {
    return this.wrap(codes.brightWhite, value);
  }

  cyan(value: string): string {
    return this.wrap(codes.cyan, value);
  }

  dim(value: string): string {
    return this.wrap(codes.dim, value);
  }

  green(value: string): string {
    return this.wrap(codes.green, value);
  }

  red(value: string): string {
    return this.wrap(codes.red, value);
  }

  yellow(value: string): string {
    return this.wrap(codes.yellow, value);
  }

  private wrap(code: string, value: string): string {
    return this.enabled ? `${code}${value}${codes.reset}` : value;
  }
}
