# Orchestration Patterns

Use these patterns as design guidance, not as APIs.

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
