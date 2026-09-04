export type HarnessId = "claude" | "codex";

export type Scope = "user" | "project";

/** A skill: SKILL.md plus any support files, keyed by path relative to the skill directory. */
export interface Skill {
  name: string;
  description: string;
  files: Record<string, string>;
}

/** A parsed markdown document with frontmatter. */
export interface Doc {
  data: Record<string, unknown>;
  body: string;
  /** The frontmatter block exactly as written, without the fences. */
  raw: string;
}

/** An Autobot as defined under autobots/<name>/. */
export interface Autobot {
  name: string;
  description: string;
  /** Preferred model hint, e.g. "opus", "sonnet". Harnesses that support it use it. */
  model?: string;
  /** Tool allowlist hint (Claude Code syntax). */
  tools?: string[];
  /** Colour hint for harnesses with agent colours. */
  color?: string;
  /** Reasoning effort hint: low | medium | high. */
  effort?: string;
  /** Every frontmatter key as parsed, including harness-specific ones (memory, disallowedTools, ...). */
  frontmatter: Record<string, unknown>;
  /** The frontmatter block exactly as written in AUTOBOT.md, for harnesses that share the format. */
  rawFrontmatter: string;
  /** The persona body (markdown, no frontmatter), as written for Claude Code. */
  prompt: string;
  skills: Skill[];
  /** Hand-written per-harness replacements from AUTOBOT.<harness>.md, when present. */
  overrides: Partial<Record<HarnessId, Doc>>;
}

/** Everything the CLI can install: the team and the shared skills. */
export interface Catalog {
  autobots: Autobot[];
  skills: Skill[];
}

export interface PlannedFile {
  path: string;
  content: string;
}

/** A directory the harness owns wholesale: replaced on install, removed on uninstall. */
export interface PlannedDir {
  path: string;
  files: PlannedFile[];
}

export interface InstallPlan {
  files: PlannedFile[];
  dirs: PlannedDir[];
}

/** How a harness rewrites a Claude Code persona into its own vocabulary. */
export interface PromptStyle {
  /** Full sentence telling the user how to start a session as this bot in this harness. */
  launch(name: string): string;
  /** Substitutions applied to the body, in order. */
  rewrites: Array<[from: RegExp, to: string | ((match: string, ...groups: string[]) => string)]>;
  /** Extra section appended to the body describing how the team works in this harness. */
  notes(bot: Autobot): string;
}

export interface Harness {
  id: HarnessId;
  label: string;
  /** Root config directory for the user scope, used by `doctor` to detect the harness. */
  userRoot(): string;
  /** Root for the project scope relative to cwd. */
  projectRoot(cwd: string): string;
  /** Directory that holds skills (one subdirectory per skill) for the given scope. */
  skillsRoot(scope: Scope, cwd: string): string;
  /** Files/dirs to write when installing an Autobot. */
  plan(bot: Autobot, scope: Scope, cwd: string): InstallPlan;
  /** Every path this harness owns for a bot (used for uninstall/status). */
  ownedPaths(bot: Autobot, scope: Scope, cwd: string): string[];
  /** The persona body as this harness will receive it. */
  adaptPrompt(bot: Autobot): string;
}
