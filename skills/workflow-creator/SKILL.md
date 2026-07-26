---
name: workflow-creator
description: Create or revise runnable Deer Workflow orchestration modules from a user's task description. Use this skill whenever the user asks to turn a repeatable multi-step task into a Workflow, generate a deer-workflow script, coordinate several Agent Loops with parallel or pipeline, or repair a Workflow that assumes APIs are globally injected.
---

# Deer Workflow Creator

Translate the user's task into one complete, runnable Deer Workflow ESM module.
The module coordinates work; it does not pretend that Deer Workflow injects
functions into its global scope.

## Establish the target

Infer these decisions from the request and existing repository context:

- A kebab-case Workflow name and one-line description.
- The input object accepted by the Workflow.
- The final value returned to the caller.
- The durable artifact file or files the Workflow should create.
- The phases visible in lifecycle events.
- Which operations are deterministic coordination and which require an Agent
  Loop's judgment or tools.
- Whether work is independent fan-out, an item-by-item pipeline, or a global
  stage followed by another fan-out.

Ask a question only when a missing answer would materially change whether the
Workflow reads or modifies user data. Otherwise make the smallest reasonable
assumption and state it in a short code comment.

## Read the actual contract

Read [references/api.md](references/api.md) before generating code. It is the
source of truth for the currently implemented API.

Read [references/patterns.md](references/patterns.md) when the request involves
concurrency, multiple Agent calls, structured output, verification, file
changes, or nested Workflows.

The essential runtime model is:

- Import APIs explicitly from `@deerwork-ai/deer-workflow`.
- Export a pure-literal `meta` object containing `name`, `description`,
  `phases`, and `exampleArgs`.
- Export an `async` handler as `default` or as named `run`.
- Receive caller input as the handler's first argument, named `args`.
- Optionally receive the Workflow execution context as the second argument.
- Let `WorkflowRunner` provide lifecycle, phase, event, and logging context
  through async-local state.

Do not generate the older destructured-injection signature:

```ts
export default async function ({ agent, parallel, args }) {}
```

`args` is not a JavaScript global. It is the first Handler parameter. Naming it
`args` preserves the Dynamic Workflow vocabulary without pretending the
current runtime mutates `globalThis`.

Do not generate an unsupported `budget` contract or unsupported `AgentOptions`
fields such as `label`, `phase`, or `isolation`. The standalone `phase()` Flow
API is implemented and should be imported when phases are useful.

## Define metadata

Place `meta` immediately after imports and before local types or executable
code:

```ts
export const meta = {
  name: "deep-research",
  description: "Researches independent angles and synthesizes a report.",
  phases: [{ title: "Plan" }, { title: "Research" }, { title: "Synthesize" }],
  exampleArgs: {
    question: "How are Agent Skills evolving?",
  },
};
```

Keep it statically readable:

- Use a kebab-case string literal for `name`.
- Use a concise string literal for `description`.
- List every observable phase as `{ title: "..." }`.
- Make phase titles exactly match calls to `phase()`, including case.
- Add a minimal runnable `exampleArgs` object. Its keys must match properties
  actually read from the Handler's `args` parameter, and its values should be
  realistic examples rather than type names.
- Use only object, array, string, number, boolean, and `null` literals.
- Do not use variables, calls, spreads, computed keys, or template literals.

The Runner validates this export and emits it in a `workflow:meta` event before
calling the Handler. The interactive CLI uses the ordered phase list for its
execution TUI. Invalid names, descriptions, empty phase lists, or duplicate
phase titles make Workflow loading fail. `exampleArgs` must be a JSON-safe
object and is used by `deer-workflow create` to print a runnable next command.

## Design the Workflow

Keep repeatable mechanics in code and delegate semantic decisions to
`agent()`. Examples of mechanics include mapping, exact filtering, counting,
deduplication by stable keys, ordering, and threshold checks. Examples of
semantic work include research, planning, drafting, classification, review,
and adjudication.

Choose the smallest orchestration primitive that expresses the dependency:

- For research about an unfamiliar, ambiguous, or current subject, run a
  lightweight discovery search before planning. Give its factual context,
  sources, and unresolved ambiguities to the planning Agent so the plan is
  grounded in the actual subject.
- Use ordinary sequential `await` when the next operation depends on the whole
  previous result.
- Use `parallel()` for independent lazy tasks that share a barrier.
- Use `pipeline()` when every item independently passes through the same
  ordered stages.
- Use separate calls with plain TypeScript between them when a stage must see
  every item, such as global ranking, clustering, or deduplication.
- Use `workflow()` only to compose an existing Workflow; nesting is limited to
  one child level.

Set `phase()` once before concurrent work. Never change the global phase from
inside a `parallel()` task or `pipeline()` stage because concurrent branches
share the Workflow execution context.

## Keep the user informed

Treat observability as part of the Workflow's user experience. Agent Loops and
parallel research may take minutes; a silent dashboard looks stalled and makes
the user anxious even when useful work is happening.

Use `log()` immediately before every potentially slow operation, after each
meaningful milestone, and whenever a useful finding becomes available:

- At phase entry, state what is starting and the expected scope.
- Before an Agent call, say what it is working on.
- During fan-out, report individual task starts and completions so progress is
  visible as results arrive.
- After planning or analysis, surface concise, concrete findings, counts,
  decisions, or evidence—not merely “done.”
- Before and after writing an artifact, show its destination and completion.
- Before synthesis, summarize how many usable results survived.

Log messages may use Markdown; prefer short headings, bullets, bold values,
inline code, and quotes that render clearly in the CLI's live log pane. Emit
new information rather than timer-based heartbeats, and never log secrets,
credentials, complete prompts, large documents, or full Agent responses.

Design long work so it has observable milestones. If one opaque Agent call
would keep the user waiting for a long time, split it into meaningful stages
when the task naturally allows it. Call `log()` before the wait begins; a
message emitted only after the call returns does not reassure the user during
the wait.

## Prefer durable artifacts

For reports, articles, research, plans, audits, generated code, and other
substantial content, prefer writing a useful file over returning the entire
content as terminal text. A file is easier to open, share, revisit, and render
well.

- Accept a sensible output path through `args` when callers need control; give
  `meta.exampleArgs` a realistic value for it.
- When the filename should reflect discovered content, let the planning Agent
  propose a short descriptive filename, then sanitize it in deterministic
  Workflow code.
- Never silently overwrite an existing artifact. Preserve the extension and
  choose a numbered sibling such as `report-2.md` or `report-2.html`.
- Generate content with Agent calls, then write it deterministically from the
  Workflow when practical.
- Choose the format that best serves the result: Markdown for portable source,
  a self-contained HTML file for a polished or interactive report, JSON/CSV
  for machine-readable data, and source files for code.
- For articles and research reports, let synthesis design an ordered
  `sections[]` structure from the actual evidence. Keep the renderer generic;
  do not force every subject into fixed headings such as “Research question,”
  “Findings,” and “Conclusion.”
- Keep HTML reports single-file unless the user requests a multi-file site.
- Return compact JSON-safe metadata such as the artifact path, format, and a
  short summary instead of duplicating the whole artifact on stdout.
- Log the resolved output path before writing and confirm it afterward.

Direct text or scalar returns are still appropriate when the task naturally
produces a short answer, a status, or a small structured value, or when the
user explicitly requests terminal output.

## Define Agent boundaries

Treat `agent()` as a complete tool-using ReAct-style Agent Loop backed by Codex
CLI by default, not as a single prompt completion.

Make every prompt self-contained. Include the task, scope, relevant prior
results, constraints, and expected outcome. An Agent does not automatically
inherit prose from another Agent call.

Use `schema` whenever code will inspect an Agent's result. Pair the schema with
a TypeScript output type and set `additionalProperties: false` for closed
objects. Free text is suitable only when no downstream code needs to parse it.

### Use Codex-compatible schemas

Generate only the JSON Schema subset accepted by Codex structured outputs.
An otherwise valid Workflow fails before its Agent starts when its response
schema contains an unsupported keyword or format.

- Never generate `format: "uri"` for source URLs. Codex rejects it with
  `invalid_json_schema`.
- Represent a URL as `{ type: "string" }`, instruct the Agent to return an
  absolute HTTP(S) URL, and validate or sanitize it deterministically before
  rendering or opening it.
- Prefer the basic supported constraints already demonstrated in this Skill:
  `type`, `properties`, `items`, `required`, `additionalProperties`,
  `minItems`, and `maxItems`.
- Do not add a JSON Schema `format` merely because it is valid in the full JSON
  Schema specification; runtime support is narrower.

Select the least permissive sandbox that can complete the task:

- `read-only` for research, inspection, planning, and writing returned content.
- `workspace-write` when the Agent must edit files in its working directory.
- `danger-full-access` only when the user explicitly authorizes capabilities
  that require it.

Set `cwd` when the task depends on a particular repository or directory.
Never interpolate untrusted data into shell commands in Workflow code; describe
the intended operation in the Agent prompt instead.

An ordinary failed `agent()` call throws. A rejected task inside `parallel()`
or a failed item inside `pipeline()` becomes `null`. Filter or check nullable
results before using them, and decide whether partial completion is acceptable.

For findings, audits, or high-stakes review, have a separate Agent independently
verify each candidate. Do not ask the Agent that produced a finding to approve
its own work.

## Produce the module

Use TypeScript by default because this repository is strict TypeScript. Use
plain JavaScript only when the user explicitly requests `.js`.

When a destination path is given, write the module there. Otherwise return
exactly one fenced code block containing the complete module, with no tutorial
before or after it unless the user asks for an explanation.

The module should normally follow this shape:

```ts
import {
  agent,
  log,
  parallel,
  phase,
  pipeline,
  workflow,
} from "@deerwork-ai/deer-workflow";

export const meta = {
  name: "workflow-name",
  description: "One-line description of the Workflow.",
  phases: [{ title: "Plan" }, { title: "Execute" }],
  exampleArgs: {
    topic: "A realistic example topic",
  },
};

interface WorkflowInput {
  // Input fields
}

interface WorkflowOutput {
  // Result fields
}

export default async function run(
  args: WorkflowInput,
): Promise<WorkflowOutput> {
  // Orchestration
}
```

Import only the APIs actually used. Keep local types near the module unless the
repository's conventions require a sibling `types.ts`.

Outside Print Mode, the handler's returned value is the CLI result written to
stdout. For artifact-producing Workflows, return a compact object that points
to the files created. By default, the CLI configures `WorkflowRunner` to write
logs and lifecycle events to stderr; a standalone Runner defaults to
`console.log`. With `run --print` or `run -p`, the CLI disables the TUI, writes
one compact JSON Workflow event per stdout line, reserves stderr for
diagnostics, and suppresses the separate handler result. Recommend Print Mode
for servers, CI/CD, task queues, process pipelines, and other automated
execution environments. Do not mix progress text or an entire generated
document into the final result.

## Validate

Before handing off a generated file:

1. Confirm every imported API exists in [references/api.md](references/api.md).
2. Confirm `meta` is a pure literal with `name`, `description`, `phases`, and
   `exampleArgs`.
3. Confirm every `meta.phases[].title` exactly matches a `phase()` call.
4. Confirm the handler is exported as `default` or named `run`.
5. Confirm caller input is received through the first Handler parameter named
   `args`, not read from a fictional JavaScript global.
6. Confirm every `parallel()` entry is a zero-argument function.
7. Confirm the first `pipeline()` stage receives the original item.
8. Confirm nullable concurrent results are handled.
9. Confirm structured Agent results have both a schema and a matching type.
10. Confirm schemas use the Codex-supported subset and contain no
    `format: "uri"`.
11. Confirm `phase()` is not called inside concurrent branches.
12. Confirm the sandbox and working directory match the task.
13. Confirm slow operations have useful logs before they begin and meaningful
    progress or findings as they complete.
14. For substantial content, confirm the Workflow writes an appropriate file
    and returns its path instead of dumping the document to stdout.
15. If working in this repository, run `bun run check`.
