# deer-workflow

`deer-workflow` is an open-source reimplementation of the Dynamic Workflow idea. The canonical repository is `https://github.com/deer-flow/deer-workflow`.

The runtime keeps deterministic orchestration in TypeScript and delegates semantic work to replaceable Agent runtimes. The default Agent runtime is Codex CLI.

Do not copy private or proprietary implementations. Reproduce public behavior through clean-room interfaces, tests, and documentation.

## Runtime

- Use Bun for package management, scripts, tests, and process execution.
- Use strict TypeScript.
- Publish the package as `@deer-flow/workflow` while keeping the CLI command
  named `deer-workflow`.
- Keep `deer-workflow run` as the Workflow execution command. Reserve
  `deer-workflow create` for future scaffolding work.
- Route CLI Workflow events to stderr as JSON Lines and the final result to
  stdout.
- Accept optional run input from at most one of `--input`, `--input-file`, or
  stdin.
- Use the `tsconfig.json` path aliases to exercise public
  `@deer-flow/workflow/*` imports locally.
- Keep runnable examples under `src/examples/<example-name>/`, with types in
  `types.ts`, the Workflow entry point in `workflow.ts`, and reciprocal English
  and Simplified Chinese README files.
- Link relevant examples from both language variants of the root README,
  Getting Started guide, and API reference.
- Keep the CLI entry point at `src/cli.ts`.
- Keep all Agent type aliases and interfaces in `src/agents/types.ts`.
- Keep the vendor-neutral Agent binder in `src/agents/agent.ts`.
- Keep Codex-specific process handling in `src/agents/codex-agent.ts`.
- Detect a missing Codex executable before creating temporary files or starting
  a process. The error must include official CLI installation steps and state
  that Codex CLI and Codex Desktop are separate installations.
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
bun run lint
bun run format:check
bun run prepare
bun run typecheck
bun test
bun run check
bun run dev -- agent "Inspect this repository"
```

Run `bun run check` before handing off a change.

## package.json scripts

The root `package.json` is the source of truth for project commands:

| Script                  | Purpose                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| `bun run dev -- <args>` | Run the TypeScript CLI entry point directly and forward arguments to it. |
| `bun run lint`          | Lint JavaScript and TypeScript without modifying files.                  |
| `bun run lint:fix`      | Apply safe ESLint fixes.                                                 |
| `bun run format`        | Format supported repository files with Prettier.                         |
| `bun run format:check`  | Check Prettier formatting without modifying files.                       |
| `bun run lint:staged`   | Run the pre-commit checks against Git-staged files.                      |
| `bun run prepare`       | Install the repository-managed Husky hooks.                              |
| `bun test`              | Run every test under the top-level `tests/` directory.                   |
| `bun run typecheck`     | Type-check both `src/` and `tests/` without emitting files.              |
| `bun run check`         | Run type-checking, lint, format checks, and the complete test suite.     |

Keep script names stable. When adding or changing a script, update this table
and the corresponding table in both language variants of `docs/index.md`.

## Quality gates

- Use ESLint Flat Config from `eslint.config.js`.
- Use Prettier as the only code formatter.
- Keep `.husky/pre-commit` limited to `lint-staged` followed by the project-wide
  `typecheck`; do not run the complete test suite during a commit.
- Keep staged-file commands in `lint-staged.config.js`.
- Preserve lint-staged's default backup stash and rollback behavior.

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
- Keep both root README files focused on project positioning, CLI trial
  commands, examples, and documentation links. Put API and runtime details in
  `docs/api.md` and `docs/api.zh-CN.md`.
- Organize each root README into two primary reader paths: how to use the CLI
  and how to develop or contribute to the repository.
- Add `Co-authored-by: Codex <codex@openai.com>` to commits containing changes
  materially authored with Codex, unless the user requests otherwise.
- Document every public API with TypeDoc comments, including parameters,
  return values, generics, thrown errors, and non-obvious runtime semantics.
- Avoid `any`; use `unknown` at external boundaries and narrow it.
- Include actionable context in thrown errors without exposing secrets.
- Add comments only when they explain a non-obvious constraint.
