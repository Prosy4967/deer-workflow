# deer-workflow

`deer-workflow` is an open-source reimplementation of the Dynamic Workflow idea. The canonical repository is `https://github.com/deer-flow/deer-workflow`.

The runtime keeps deterministic orchestration in TypeScript and delegates semantic work to replaceable Agent runtimes. The default Agent runtime is Codex CLI.

Do not copy private or proprietary implementations. Reproduce public behavior through clean-room interfaces, tests, and documentation.

## Runtime

- Use Bun for package management, scripts, tests, and process execution.
- Use strict TypeScript.
- Keep the CLI entry point at `src/cli.ts`.
- Keep all Agent type aliases and interfaces in `src/agents/types.ts`.
- Keep the vendor-neutral Agent binder in `src/agents/agent.ts`.
- Keep Codex-specific process handling in `src/agents/codex-agent.ts`.
- Re-export the default `agent()` function from `src/agents/index.ts`.
- Keep all Flow type aliases and interfaces in `src/flow/types.ts`.
- Keep deterministic orchestration primitives in `src/flow/`.
- Mirror flow tests under `tests/flow/`.
- Keep all Logging type aliases and interfaces in `src/logging/types.ts`.
- Keep Logging implementations in `src/logging/` and tests in
  `tests/logging/`.
- Keep all Workflow Event type aliases and interfaces in `src/events/types.ts`.
- Keep Event implementations in `src/events/` and tests in `tests/events/`.
- Keep all Runner type aliases and interfaces in `src/runner/types.ts`.
- Keep Runner implementations in `src/runner/` and tests in `tests/runner/`.
- Write default logs to stderr so machine-readable stdout remains clean.
- Emit Runner output as JSON Lines. Its default `logWriter` calls `console.log`
  once per event so each JSON object occupies one stdout line.
- Keep Workflow arguments and results out of events by default. Event payloads
  must remain JSON-safe and suitable for external process boundaries.
- Workflow modules export a handler as either `default` or `run`.
- Resolve nested Workflow paths relative to their parent module.
- Keep Workflow nesting limited to one level unless the public contract changes.

## Commands

```bash
bun install
bun run typecheck
bun test
bun run check
bun run dev -- agent "Inspect this repository"
```

Run `bun run check` before handing off a change.

## package.json scripts

The root `package.json` is the source of truth for project commands:

| Script | Purpose |
| --- | --- |
| `bun run dev -- <args>` | Run the TypeScript CLI entry point directly and forward arguments to it. |
| `bun test` | Run every test under the top-level `tests/` directory. |
| `bun run typecheck` | Type-check both `src/` and `tests/` without emitting files. |
| `bun run check` | Run type-checking first, then the complete test suite. |

Keep script names stable. When adding or changing a script, update this table
and the corresponding table in `README.md`.

## Agent contract

- `agent(prompt, options)` represents a complete Agent Loop, not a single model completion.
- JSON Schema constrains the final Agent response only.
- A schema-backed call returns parsed JSON; a call without a schema returns text.
- Keep the generic Agent interface independent from Codex CLI flags whenever possible.
- New runtimes should implement the same `Agent` interface and remain swappable.

## Process safety

- Spawn commands with argument arrays. Never construct shell command strings from prompts.
- Send prompts over stdin instead of embedding them in a shell command.
- Default to ephemeral Codex sessions.
- Do not enable `danger-full-access` implicitly.
- Never log credentials or copy the entire parent environment into diagnostics.
- Create schema and result files in a unique temporary directory and remove it in `finally`.
- Preserve stderr on failures so callers can diagnose missing authentication, sandbox denials, and CLI errors.

## Testing

- Unit tests must not call the real Codex service.
- Keep all test files under the top-level `tests/` directory and mirror the
  relevant `src/` structure where practical.
- Use a local stub process to test argument construction, stdin handling, structured output, and failures.
- Add integration tests that invoke Codex only behind an explicit environment flag.
- Test both text output and JSON Schema output for every Agent adapter.

## Style

- Prefer small modules with explicit public types.
- Export types with `export type`.
- Keep English documentation at the canonical `*.md` path and place Simplified
  Chinese translations beside it as `*.zh-CN.md`. Add reciprocal language
  links near the top of both files.
- Document every public API with TypeDoc comments, including parameters,
  return values, generics, thrown errors, and non-obvious runtime semantics.
- Avoid `any`; use `unknown` at external boundaries and narrow it.
- Include actionable context in thrown errors without exposing secrets.
- Add comments only when they explain a non-obvious constraint.
