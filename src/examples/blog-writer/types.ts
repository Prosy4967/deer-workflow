/**
 * Arguments accepted by the Blog Writer example.
 */
export interface BlogWriterInput {
  /** Subject of the article. */
  readonly topic: string;

  /** Intended reader profile. */
  readonly audience: string;

  /** Optional writing style or voice. */
  readonly tone?: string;

  /** Concepts that should appear naturally in the article. */
  readonly keywords?: readonly string[];
}

/**
 * Structured outline produced before drafting begins.
 */
export interface BlogOutline {
  /** Working title. */
  readonly title: string;

  /** Ordered section briefs. */
  readonly sections: string[];
}

/**
 * One drafted and reviewed article section.
 */
export interface BlogSection {
  /** Section heading. */
  readonly heading: string;

  /** Markdown body without a top-level title. */
  readonly markdown: string;
}

/**
 * Final article returned by the Blog Writer example.
 */
export interface BlogArticle {
  /** Final article title. */
  readonly title: string;

  /** One-paragraph summary. */
  readonly summary: string;

  /** Complete Markdown article. */
  readonly markdown: string;
}
