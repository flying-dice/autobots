import { parseFrontmatter, splitTopLevel } from "./frontmatter.ts";
import { children, type Tree } from "./tree.ts";
import type { Autobot, Catalog, Doc, HarnessId, Skill } from "./types.ts";

const HARNESS_IDS: HarnessId[] = ["claude", "codex"];

/** Parse a tree (from disk or embedded in a bundle) into the team and shared skills. */
export function loadCatalog(tree: Tree): Catalog {
  return { autobots: loadAutobots(tree), skills: loadSkills(children(tree, "skills")) };
}

export function loadAutobots(tree: Tree): Autobot[] {
  const bots: Autobot[] = [];
  for (const [name, files] of children(tree, "autobots")) {
    if (name.startsWith("_") || name.startsWith(".")) continue;
    const bot = loadAutobot(name, files);
    if (bot) bots.push(bot);
  }
  return bots.sort((a, b) => a.name.localeCompare(b.name));
}

function loadAutobot(dirName: string, files: Tree): Autobot | null {
  const source = files["AUTOBOT.md"];
  if (source === undefined) return null;
  const { data, body, raw } = parseFrontmatter(source);
  const tools = Array.isArray(data.tools)
    ? (data.tools as string[])
    : typeof data.tools === "string"
      ? splitTopLevel(data.tools)
      : undefined;
  return {
    name: String(data.name ?? dirName),
    description: String(data.description ?? ""),
    model: data.model ? String(data.model) : undefined,
    tools,
    color: data.color ? String(data.color) : undefined,
    effort: data.effort ? String(data.effort) : undefined,
    frontmatter: data,
    rawFrontmatter: raw,
    prompt: body.trim(),
    skills: loadSkills(children(files, "skills")),
    overrides: loadOverrides(files),
  };
}

/** AUTOBOT.<harness>.md replaces the generated prompt for that harness entirely. */
function loadOverrides(files: Tree): Partial<Record<HarnessId, Doc>> {
  const out: Partial<Record<HarnessId, Doc>> = {};
  for (const id of HARNESS_IDS) {
    const source = files[`AUTOBOT.${id}.md`];
    if (source !== undefined) out[id] = parseFrontmatter(source);
  }
  return out;
}

export function loadSkills(dirs: Map<string, Tree>): Skill[] {
  const skills: Skill[] = [];
  for (const [name, files] of dirs) {
    if (name.startsWith("_") || files["SKILL.md"] === undefined) continue;
    const { data } = parseFrontmatter(files["SKILL.md"]);
    skills.push({ name, description: String(data.description ?? "").replace(/\s+/g, " "), files });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function findAutobots(all: Autobot[], names: string[]): Autobot[] {
  const missing = names.filter((n) => !all.some((b) => b.name === n));
  if (missing.length) {
    throw new Error(`Unknown autobot(s): ${missing.join(", ")}. Run \`autobots list\`.`);
  }
  return all.filter((b) => names.includes(b.name));
}
