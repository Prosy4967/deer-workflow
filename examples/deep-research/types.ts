/**
 * Arguments accepted by the Deep Research example.
 */
export interface DeepResearchInput {
  /** Research question to investigate. */
  readonly question: string;

  /** Optional angles that supplement the Agent-generated research plan. */
  readonly angles?: readonly string[];

  /** Destination for the self-contained HTML report. */
  readonly outputPath?: string;
}

/**
 * Lightweight context collected before the research plan is designed.
 */
export interface ResearchDiscovery {
  /** Concise description of the subject and current context. */
  readonly overview: string;

  /** Useful facts that should shape the research plan. */
  readonly keyFacts: string[];

  /** Ambiguities or contested assumptions that require verification. */
  readonly ambiguities: string[];

  /** Initial source URLs found during discovery. */
  readonly sources: string[];
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
 * One editorial section designed during synthesis.
 */
export interface DeepResearchSection {
  /** Short editorial label shown above the section title. */
  readonly kicker: string;

  /** Section-specific headline. */
  readonly title: string;

  /** One-sentence section introduction. */
  readonly lede: string;

  /** Ordered prose paragraphs. */
  readonly paragraphs: string[];

  /** Concise evidence-backed takeaways. */
  readonly keyPoints: string[];

  /** Source URLs directly supporting this section. */
  readonly sources: string[];
}

/**
 * Structured synthesis model rendered into the final HTML report.
 */
export interface DeepResearchReport {
  /** Report title. */
  readonly title: string;

  /** Short answer to the original research question. */
  readonly executiveSummary: string;

  /** Dynamically designed editorial sections. */
  readonly sections: DeepResearchSection[];

  /** Known evidence gaps or unresolved questions. */
  readonly limitations: string[];
}

/**
 * Compact result returned after the HTML artifact is written.
 */
export interface DeepResearchResult {
  /** Absolute path to the generated report. */
  readonly outputPath: string;

  /** Artifact format. */
  readonly format: "html";

  /** Number of editorial sections in the report. */
  readonly sections: number;

  /** Number of unique source URLs in the report. */
  readonly sources: number;

  /** Whether the operating system accepted the request to open the report. */
  readonly presented: boolean;
}
