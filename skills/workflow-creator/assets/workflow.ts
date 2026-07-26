import { agent, log, parallel, phase } from "@deer-work/workflow";

export const meta = {
  name: "planned-workflow",
  description:
    "Plans independent tasks, executes them, and synthesizes results.",
  phases: [{ title: "Plan" }, { title: "Execute" }, { title: "Synthesize" }],
};

interface WorkflowInput {
  objective: string;
}

interface WorkflowOutput {
  summary: string;
}

interface Plan {
  tasks: string[];
}

const planSchema = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
    },
  },
  required: ["tasks"],
  additionalProperties: false,
};

/**
 * Replace this template's prompts, input, and output with the user's domain.
 */
export default async function run(
  args: WorkflowInput,
): Promise<WorkflowOutput> {
  phase("Plan");
  log("Planning independent tasks");

  const plan = await agent<Plan>(
    `Break this objective into independent tasks:\n${args.objective}`,
    {
      sandbox: "read-only",
      schema: planSchema,
    },
  );

  phase("Execute");
  log(`Running ${plan.tasks.length} tasks`);

  const rawResults = await parallel(
    plan.tasks.map(
      (task) => () =>
        agent(`Complete this task:\n${task}`, {
          sandbox: "read-only",
        }),
    ),
  );
  const results = rawResults.filter(
    (result): result is string => result !== null,
  );

  phase("Synthesize");
  log(`Synthesizing ${results.length} results`);

  const summary = await agent(
    [
      `Original objective: ${args.objective}`,
      "Synthesize the completed task results into one concise answer.",
      `Results: ${JSON.stringify(results)}`,
    ].join("\n\n"),
    { sandbox: "read-only" },
  );

  return { summary };
}
