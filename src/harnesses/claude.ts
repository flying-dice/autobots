import { join } from "node:path";
import { homedir } from "node:os";
import { defineHarness } from "./base.ts";

/**
 * Claude Code: subagents live in <root>/agents/autobots/<name>.md. AUTOBOT.md
 * already uses this format, so frontmatter and body are emitted unchanged.
 * User scope root is ~/.claude, project scope root is ./.claude.
 */
export const claude = defineHarness({
  id: "claude",
  label: "Claude Code",
  userRoot: () => join(homedir(), ".claude"),
  projectRoot: (cwd) => join(cwd, ".claude"),
  mainFile: (bot) => join("agents", "autobots", `${bot.name}.md`),
  render: (bot, prompt) => `---\n${bot.rawFrontmatter}\n---\n\n${prompt}\n`,
  style: null,
});
