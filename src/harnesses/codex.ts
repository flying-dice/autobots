import { join } from "node:path";
import { homedir } from "node:os";
import { commonRewrites, defineHarness, dispatchTargets, isDispatcher } from "./base.ts";
import { stringifyFrontmatter } from "../frontmatter.ts";
import type { Autobot, PlannedDir, Scope } from "../types.ts";

/**
 * OpenAI Codex. Every Autobot becomes a custom agent in <root>/agents/<name>.toml
 * (name, description, model, model_reasoning_effort, sandbox_mode,
 * developer_instructions), spawnable by name from the primary session.
 * Subagents cannot spawn subagents, so the dispatcher (Optimus) is also
 * installed as a skill: mentioning `$optimus-prime` makes the primary session
 * adopt him. Skills follow the Agent Skills layout under ~/.agents/skills
 * (user) or ./.agents/skills (project). Docs: learn.chatgpt.com/docs/agent-configuration/subagents
 */

/**
 * Claude model tiers mapped to the Codex model to prescribe for each. Tiers are
 * relative cost bands: fable is the strongest, sonnet the cheapest. Any other
 * model string in AUTOBOT.md is passed through as a Codex model id unchanged.
 * Ids per learn.chatgpt.com/docs/models: gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna.
 */
export const CODEX_MODELS: Record<string, string> = {
  fable: "gpt-5.6-sol",
  opus: "gpt-5.6-sol",
  sonnet: "gpt-5.6-terra",
  haiku: "gpt-5.6-terra",
};

/** Codex accepts minimal | low | medium | high | xhigh; Claude's low/medium/high pass through. */
export function codexModel(bot: Autobot): string | undefined {
  if (!bot.model || bot.model === "inherit") return undefined;
  return CODEX_MODELS[bot.model.toLowerCase()] ?? bot.model;
}

/** Bots whose Claude tool list has no Write/Edit are analysis-only, so their sandbox is read-only. */
export function codexSandbox(bot: Autobot): "read-only" | "workspace-write" {
  const tools = bot.tools ?? [];
  return tools.some((t) => t === "Write" || t === "Edit") ? "workspace-write" : "read-only";
}

const launch = (name: string) =>
  `In Codex, start a session and mention \`$${name}\` so the primary session adopts this role; it is also spawnable as the \`${name}\` custom agent.`;

const skillsRoot = (scope: Scope, cwd: string) => join(scope === "user" ? homedir() : cwd, ".agents", "skills");

export const codex = defineHarness({
  id: "codex",
  label: "Codex",
  userRoot: () => join(homedir(), ".codex"),
  projectRoot: (cwd) => join(cwd, ".codex"),
  skillsRoot,
  mainFile: (bot) => join("agents", `${bot.name}.toml`),
  render: toToml,
  extraDirs: (bot, prompt, scope, cwd) => (isDispatcher(bot) ? [dispatcherSkill(bot, prompt, scope, cwd)] : []),
  style: {
    launch,
    rewrites: [
      ...commonRewrites(launch),
      [/\bTodoWrite\b/g, "update_plan"],
      [/\bthe Agent tool\b/g, "a spawned custom agent"],
    ],
    notes: (bot) =>
      isDispatcher(bot)
        ? [
            `Your teammates are installed as Codex custom agents named: ${dispatchTargets(bot).join(", ")}. Dispatch one by asking Codex explicitly to spawn it by name with the brief, for example "Spawn the bumblebee agent with this brief: ...". Spawn in parallel only for briefs that touch disjoint files. Codex returns each agent's final message when it finishes; that is the report.`,
            "Spawned agents cannot spawn agents themselves, so all orchestration stays with you in the primary session. Ask the user directly when a real fork needs their call.",
            tierNote(bot),
          ].join("\n\n")
        : [
            "You are a Codex custom agent spawned by Optimus Prime (or run directly by the user, who then plays that role). You cannot spawn agents. Return the report format above as your final message.",
            tierNote(bot),
          ].join("\n\n"),
  },
});

/** Tells the agent which concrete model each teammate tier resolves to here. */
function tierNote(bot: Autobot): string {
  const table = Object.entries(CODEX_MODELS).map(([tier, model]) => `${tier} = ${model}`).join(", ");
  const mine = codexModel(bot);
  return (
    `Model tiers named in this prompt (Fable, Opus, Sonnet) are Claude Code tiers. In Codex they resolve to: ${table}. ` +
    `Each teammate's Codex agent already prescribes its model and reasoning effort` +
    (mine ? `; yours is ${mine}${bot.effort ? ` at ${bot.effort} effort` : ""}.` : ".")
  );
}

function toToml(bot: Autobot, prompt: string): string {
  const q = (s: string) => JSON.stringify(s);
  const lines = [`name = ${q(bot.name)}`, `description = ${q(bot.description)}`];
  const model = codexModel(bot);
  if (model) lines.push(`model = ${q(model)}`);
  if (bot.effort) lines.push(`model_reasoning_effort = ${q(bot.effort)}`);
  lines.push(`sandbox_mode = ${q(codexSandbox(bot))}`);
  lines.push(`developer_instructions = """`, prompt.replace(/"""/g, '\\"\\"\\"'), `"""`, "");
  return lines.join("\n");
}

/** The dispatcher as a skill, so `$<name>` turns the primary Codex session into him. */
function dispatcherSkill(bot: Autobot, prompt: string, scope: Scope, cwd: string): PlannedDir {
  const path = join(skillsRoot(scope, cwd), bot.name);
  const content = stringifyFrontmatter({ name: bot.name, description: bot.description }, prompt);
  return { path, files: [{ path: join(path, "SKILL.md"), content }] };
}
