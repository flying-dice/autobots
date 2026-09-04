import { join } from "node:path";
import { skillDirAt } from "../install.ts";
import type { Autobot, Harness, HarnessId, PlannedDir, PromptStyle, Scope } from "../types.ts";

export interface HarnessSpec {
  id: HarnessId;
  label: string;
  userRoot(): string;
  projectRoot(cwd: string): string;
  /** Skills directory. Defaults to <scope root>/skills. */
  skillsRoot?(scope: Scope, cwd: string): string;
  /** Where the bot's main definition file goes, relative to the scope root. */
  mainFile(bot: Autobot, scope: Scope): string;
  /** Serialise the bot for this harness. `bot` already carries the adapted description and prompt. */
  render(bot: Autobot, prompt: string): string;
  /** Additional directories this harness owns for the bot, beyond its skills. */
  extraDirs?(bot: Autobot, prompt: string, scope: Scope, cwd: string): PlannedDir[];
  /** Null means the harness shares Claude Code's format and takes the prompt verbatim. */
  style: PromptStyle | null;
}

/** Builds a Harness from the parts that differ, so the shared plumbing lives in one place. */
export function defineHarness(spec: HarnessSpec): Harness {
  const root = (scope: Scope, cwd: string) => (scope === "user" ? spec.userRoot() : spec.projectRoot(cwd));
  const skillsRoot = spec.skillsRoot ?? ((scope, cwd) => join(root(scope, cwd), "skills"));
  const mainPath = (bot: Autobot, scope: Scope, cwd: string) => join(root(scope, cwd), spec.mainFile(bot, scope));
  const ownedDirs = (bot: Autobot, scope: Scope, cwd: string): PlannedDir[] => {
    const adapted = adapt(bot);
    return [
      ...bot.skills.map((s) => skillDirAt(s, join(skillsRoot(scope, cwd), s.name))),
      ...(spec.extraDirs?.(adapted, adapted.prompt, scope, cwd) ?? []),
    ];
  };

  const rewrite = (text: string): string => {
    for (const [from, to] of spec.style?.rewrites ?? []) {
      text = typeof to === "string" ? text.replace(from, to) : text.replace(from, to);
    }
    return text;
  };

  const adaptPrompt = (bot: Autobot): string => {
    const override = bot.overrides[spec.id];
    if (override) return override.body.trim();
    if (!spec.style) return bot.prompt;
    const notes = spec.style.notes(bot).trim();
    const body = rewrite(bot.prompt).trim();
    return notes ? `${body}\n\n## Operating in ${spec.label}\n\n${notes}` : body;
  };

  /** The bot with description and prompt in this harness's vocabulary. */
  const adapt = (bot: Autobot): Autobot => {
    const override = bot.overrides[spec.id];
    const description = String(override?.data.description ?? rewrite(bot.description));
    return { ...bot, description, prompt: adaptPrompt(bot) };
  };

  return {
    id: spec.id,
    label: spec.label,
    userRoot: spec.userRoot,
    projectRoot: spec.projectRoot,
    skillsRoot,
    adaptPrompt,
    plan: (bot, scope, cwd) => {
      const adapted = adapt(bot);
      return {
        files: [{ path: mainPath(bot, scope, cwd), content: spec.render(adapted, adapted.prompt) }],
        dirs: ownedDirs(bot, scope, cwd),
      };
    },
    ownedPaths: (bot, scope, cwd) => [mainPath(bot, scope, cwd), ...ownedDirs(bot, scope, cwd).map((d) => d.path)],
  };
}

/** Rewrites shared by every harness that is not Claude Code. */
export function commonRewrites(launch: (name: string) => string): PromptStyle["rewrites"] {
  return [
    [/Run with `claude --agent ([a-z0-9-]+)`\.?/g, (_m, name) => launch(name)],
    [/`claude --agent ([a-z0-9-]+)`/g, (_m, name) => `the \`${name}\` agent here`],
    [/\bAskUserQuestion\b/g, "a direct question to the user"],
    [/\byour agent memory\b/g, "your notes file for this project"],
  ];
}

/** True when the bot is the one that dispatches others (has an Agent(...) allowlist). */
export function isDispatcher(bot: Autobot): boolean {
  return (bot.tools ?? []).some((t) => t.startsWith("Agent("));
}

/** Names listed inside the bot's Agent(...) allowlist. */
export function dispatchTargets(bot: Autobot): string[] {
  const entry = (bot.tools ?? []).find((t) => t.startsWith("Agent("));
  return entry ? entry.slice("Agent(".length, -1).split(",").map((s) => s.trim()).filter(Boolean) : [];
}

