# Orchestration Patterns

Use these patterns as design guidance, not as APIs.

## Discover before planning

For unfamiliar, ambiguous, niche, or current research subjects, do not ask a
Planner to invent angles from the user's question alone. First run a small
scoping search that identifies the subject, current context, seed sources, and
assumptions that need verification. Then provide that structured discovery to
the planning Agent.

Keep discovery broad and inexpensive. It informs the plan; it does not replace
the later independent research and verification. Research branches should
still verify discovery claims rather than treating them as established facts.

## Plan, fan out, synthesize

Use a structured planning Agent, run independent work with `parallel()`, then
give the surviving results to one synthesis Agent.

```ts
const plan = await agent<{ tasks: string[] }>("Create a plan.", {
  sandbox: "read-only",
  schema: {
    type: "object",
    properties: {
      tasks: { type: "array", items: { type: "string" } },
    },
    required: ["tasks"],
    additionalProperties: false,
  },
});

const rawResults = await parallel(
  plan.tasks.map(
    (task) => () =>
      agent(`Complete this independent task:\n${task}`, {
        sandbox: "read-only",
      }),
  ),
);
const results = rawResults.filter(
  (result): result is string => result !== null,
);

return agent(`Synthesize these results:\n${JSON.stringify(results)}`, {
  sandbox: "read-only",
});
```

Use compact Markdown logs so the interactive execution dashboard communicates
progress while fan-out work is running:

```ts
log(`## Parallel research\nRunning **${plan.tasks.length} tasks**.`);
const rawResults = await parallel(
  plan.tasks.map((task) => async () => {
    log(`- Starting \`${task}\``);
    const result = await agent(`Complete:\n${task}`);
    log(`- Completed \`${task}\``);
    return result;
  }),
);
```

Keep these messages concise. JSONL retains the original Markdown, while the
interactive CLI renders it in the live log pane. A start message must be
emitted before the slow call begins. Completion messages should include useful
new facts—such as a source count, selected approach, confidence, or concise
finding—rather than only repeating that work completed.

## Observable long-running work

Treat logs as the Workflow's live status channel. Cover every interval where a
user could reasonably wonder whether execution has stalled:

```ts
phase("Research");
log(
  `## Research\nStarting **${angles.length} independent angles**. Findings will appear as each angle completes.`,
);

const findings = await parallel(
  angles.map((angle) => async () => {
    log(`- Investigating **${angle}**`);
    const finding = await agent<Finding>(researchPrompt(angle), {
      sandbox: "read-only",
      schema: findingSchema,
    });
    log(
      `- **${angle}:** ${finding.summary} (${finding.sources.length} sources)`,
    );
    return finding;
  }),
);
```

Prefer eventful milestones over noisy heartbeat logs. Do not wait until the end
of an Agent call to emit its first status. Do not expose credentials, private
inputs, full prompts, or large Agent responses in logs.

## Durable file output

Substantial content should normally become a file, while the returned value
stays small and automation-friendly:

```ts
const requestedPath = args.outputPath ?? sanitize(plan.outputFileName);
const outputPath = await writeWithoutOverwrite(requestedPath, reportMarkdown);
log(`- Report saved: \`${outputPath}\``);

return {
  outputPath,
  format: "markdown",
  findings: confirmed.length,
};
```

Implement `writeWithoutOverwrite()` with `open(candidate, "wx")` so selection
and creation are atomic. Try the requested filename first, then preserve its
extension while trying `name-2.ext`, `name-3.ext`, and so on. This avoids both
silent data loss and a check-then-write race.

Prefer Markdown for portable documents and a self-contained HTML file for a
polished or interactive report. Return the content directly only when it is
short, inherently terminal-oriented, or explicitly requested by the user.
For editorial reports, have the synthesis Agent return semantic `sections[]`
whose labels, titles, and order arise from the evidence. Render that array
generically instead of hardcoding the same article outline for every topic.
If planning discovers the report's subject, let the Planner propose a
descriptive filename and sanitize it before use. Do not overwrite an existing
artifact; atomically select a numbered sibling such as `report-2.md` while
preserving the original extension.

## Per-item staged processing

Use `pipeline()` when items do not need to synchronize between stages.

```ts
const reviewed = await pipeline(
  sections,
  (section) => agent(`Draft this section:\n${section}`),
  (draft, section) => agent(`Edit the draft for ${section}:\n${draft}`),
);
```

Do not use a pipeline for a global editorial pass that needs all sections.
Complete the per-section pipeline first, then make one final Agent call.

## Global operation between barriers

When one operation needs every result, stop the fan-out and perform the global
operation explicitly:

```ts
const candidates = (await parallel(discoveryTasks)).filter(isPresent);
const unique = deduplicateByStableId(candidates);
const verifications = await parallel(
  unique.map((candidate) => () => verify(candidate)),
);
```

Exact-key deduplication belongs in TypeScript. Semantic equivalence belongs in
an Agent call with structured output.

Keep structured output schemas within Codex's supported subset. For source
URLs, use `items: { type: "string" }`; never use `format: "uri"`. Ask the
Agent for absolute HTTP(S) URLs in its prompt, then validate or sanitize them
in deterministic Workflow code.

## Independent verification

First collect candidate findings, then give each finding to a different Agent
call whose prompt asks it to reproduce or refute the evidence. Preserve the
association by index because `parallel()` preserves input order.

Handle `null` without shifting indexes before association:

```ts
const verdicts = await parallel(
  findings.map(
    (finding) => () =>
      agent<Verdict>(`Verify independently:\n${JSON.stringify(finding)}`, {
        sandbox: "read-only",
        schema: verdictSchema,
      }),
  ),
);

const confirmed = findings.filter(
  (_finding, index) => verdicts[index]?.confirmed === true,
);
```

## Repository changes

For code changes, give the Agent a precise `cwd`, a `workspace-write` sandbox,
the acceptance criteria, and the checks it should run. Concurrent Agents share
the same working tree; avoid parallel writes to overlapping files. The current
runtime has no automatic worktree isolation option.

Prefer sequential ownership when several edits touch one feature:

```ts
await agent("Implement the requested change and run focused tests.", {
  cwd: input.repository,
  sandbox: "workspace-write",
});

return agent("Review the implementation and fix verified issues.", {
  cwd: input.repository,
  sandbox: "workspace-write",
});
```

## Nested Workflow

Use an existing child Workflow only when it is already a meaningful reusable
unit:

```ts
const research = await workflow<ResearchOutput, ResearchInput>(
  "./research.ts",
  { question: input.topic },
);
```

Do not decompose every Agent call into a child Workflow. Only one nested level
is currently supported.
