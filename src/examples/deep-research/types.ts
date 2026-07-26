/**
 * Arguments accepted by the Deep Research example.
 */
export interface DeepResearchInput {
  /** Research question to investigate. */
  readonly question: string;

  /** Optional angles that supplement the Agent-generated research plan. */
  readonly angles?: readonly string[];
}

/**
 * One independently researched angle.
 */
export interface ResearchFinding {
  /** Angle assigned to the research Agent. */
  readonly angle: string;

  /** Concise finding produced for this angle. */
  readonly summary: string;

  /** Source URLs used to support the finding. */
  readonly sources: string[];
}

/**
 * Final structured report produced by the example.
 */
export interface DeepResearchReport {
  /** Report title. */
  readonly title: string;

  /** Short answer to the original research question. */
  readonly executiveSummary: string;

  /** Findings retained from the parallel research stage. */
  readonly findings: ResearchFinding[];

  /** Known evidence gaps or unresolved questions. */
  readonly limitations: string[];
}
