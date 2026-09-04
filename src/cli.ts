import { existsSync } from "node:fs";
import { findAutobots } from "./autobots.ts";
import { HARNESSES, HARNESS_IDS, resolveHarnesses } from "./harnesses/index.ts";
import { install, uninstall, status, installSkill, uninstallSkill, skillStatus } from "./install.ts";
import type { Autobot, Catalog, Scope } from "./types.ts";

export const RELEASE_URL = "https://github.com/flying-dice/autobots/releases/latest/download/autobots.ts";

const HELP = `autobots — manage the Autobots agent team across coding harnesses

Usage:
  autobots list                         Show the Autobots in this repo
  autobots skills                       Show the shared skills in this repo
  autobots harnesses                    Show supported harnesses and where they are detected
  autobots install <bot...> [options]   Install Autobots into a harness
  autobots install --all [options]      Install every Autobot and every shared skill
  autobots uninstall <bot...> [options] Remove Autobots from a harness
  autobots status [options]             Show what is installed where
  autobots doctor                       Detect which harnesses are present on this machine
  autobots show <bot>                   Print an Autobot definition

Required for install, uninstall and status (nothing is assumed):
  -H, --harness <ids>   Comma-separated: ${HARNESS_IDS.join(", ")}, or all
  -S, --scope <scope>   user (home directory config) or project (current directory)

Other options:
  -n, --dry-run         Print what would change without touching disk
  -s, --skills          Also include the shared skills (implied by --all)
  -h, --help            Show this help
  -v, --version         Print the version

Run without cloning:
  bunx github:flying-dice/autobots install --all --harness claude --scope user
  curl -fsSL ${RELEASE_URL} | bun run - install --all --harness codex --scope project
`;



interface Args {
  cmd: string | undefined;
  positional: string[];
  harness?: string;
  scope?: string;
  all: boolean;
  skills: boolean;
  dryRun: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { cmd: undefined, positional: [], all: false, skills: false, dryRun: false, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "-h" || t === "--help") a.help = true;
    else if (t === "-v" || t === "--version") a.version = true;
    else if (t === "-S" || t === "--scope") a.scope = argv[++i];
    else if (t.startsWith("--scope=")) a.scope = t.slice("--scope=".length);
    else if (t === "-n" || t === "--dry-run") a.dryRun = true;
    else if (t === "--all" || t === "-a") a.all = true;
    else if (t === "--skills" || t === "-s") a.skills = true;
    else if (t === "-H" || t === "--harness") a.harness = argv[++i];
    else if (t.startsWith("--harness=")) a.harness = t.slice("--harness=".length);
    else if (t.startsWith("-")) throw new Error(`Unknown option ${t}`);
    else if (!a.cmd) a.cmd = t;
    else a.positional.push(t);
  }
  return a;
}

/** Harness and scope are never assumed: both flags are mandatory for anything that touches disk. */
function requireTarget(args: Args): { harnesses: ReturnType<typeof resolveHarnesses>; scope: Scope } {
  if (!args.harness) throw new Error(`--harness is required: one of ${HARNESS_IDS.join(", ")}, or all.`);
  if (!args.scope) throw new Error("--scope is required: user or project.");
  if (args.scope !== "user" && args.scope !== "project") {
    throw new Error(`Unknown scope "${args.scope}". Use user or project.`);
  }
  return { harnesses: resolveHarnesses(args.harness), scope: args.scope };
}

function pickBots(args: Args, all: Autobot[]): Autobot[] {
  if (args.all) return all;
  if (args.positional.length === 0) {
    if (args.skills) return [];
    throw new Error("Name at least one Autobot, or pass --all.");
  }
  return findAutobots(all, args.positional);
}

export interface Runtime {
  catalog: Catalog;
  version: string;
}

/** Run the CLI against a catalog. Entry points decide where the catalog comes from. */
export function main(argv: string[], rt: Runtime) {
  const args = parseArgs(argv);
  const cwd = process.cwd();
  const bots = rt.catalog.autobots;
  const sharedSkills = rt.catalog.skills;

  if (args.version || args.cmd === "version") {
    console.log(`autobots ${rt.version}`);
    return;
  }
  if (args.help || !args.cmd) {
    console.log(HELP);
    return;
  }

  switch (args.cmd) {
    case "list": {
      if (bots.length === 0) {
        console.log("No Autobots found in autobots/. Add a directory with an AUTOBOT.md to get started.");
        return;
      }
      const w = Math.max(...bots.map((b) => b.name.length));
      for (const b of bots) {
        const skills = b.skills.length ? `  [${b.skills.length} skill${b.skills.length === 1 ? "" : "s"}]` : "";
        console.log(`${b.name.padEnd(w)}  ${b.description}${skills}`);
      }
      return;
    }
    case "skills": {
      if (sharedSkills.length === 0) {
        console.log("No shared skills found in skills/.");
        return;
      }
      const w = Math.max(...sharedSkills.map((s) => s.name.length));
      for (const s of sharedSkills) console.log(`${s.name.padEnd(w)}  ${s.description.slice(0, 110)}`);
      return;
    }
    case "harnesses": {
      for (const id of HARNESS_IDS) {
        const h = HARNESSES[id];
        console.log(`${id.padEnd(12)} ${h.label.padEnd(12)} user: ${h.userRoot()}   project: ${h.projectRoot(".")}`);
      }
      return;
    }
    case "doctor": {
      for (const id of HARNESS_IDS) {
        const h = HARNESSES[id];
        const ok = existsSync(h.userRoot());
        console.log(`${ok ? "✔" : "✘"} ${h.label.padEnd(12)} ${h.userRoot()}${ok ? "" : "  (not found)"}`);
      }
      return;
    }
    case "show": {
      const [b] = findAutobots(bots, [args.positional[0] ?? ""]);
      console.log(`# ${b.name}\n${b.description}\n`);
      if (b.model) console.log(`model: ${b.model}`);
      if (b.tools) console.log(`tools: ${b.tools.join(", ")}`);
      if (b.skills.length) console.log(`skills: ${b.skills.map((s) => s.name).join(", ")}`);
      console.log(`\n${b.prompt}`);
      return;
    }
    case "install":
    case "uninstall": {
      const { harnesses: targets, scope } = requireTarget(args);
      const chosen = pickBots(args, bots);
      const skills = args.all || args.skills ? sharedSkills : [];
      const opts = { scope, cwd, dryRun: args.dryRun };
      const installing = args.cmd === "install";
      for (const h of targets) {
        console.log(`\n${h.label} (${scope})`);
        for (const sk of skills) {
          const a = installing ? installSkill(sk, h, opts) : uninstallSkill(sk, h, opts);
          if (a) console.log(`  ${args.dryRun ? "would " : ""}${a.kind.padEnd(9)} ${("skill:" + sk.name).padEnd(24)} ${a.path}`);
        }
        for (const b of chosen) {
          const actions = installing ? install(b, h, opts) : uninstall(b, h, opts);
          if (actions.length === 0) {
            console.log(`  ${b.name}: nothing to do`);
            continue;
          }
          for (const a of actions) {
            console.log(`  ${args.dryRun ? "would " : ""}${a.kind.padEnd(9)} ${b.name.padEnd(24)} ${a.path}`);
          }
        }
      }
      return;
    }
    case "status": {
      const { harnesses: targets, scope } = requireTarget(args);
      console.log(`scope: ${scope}${scope === "project" ? ` (${cwd})` : ""}\n`);
      const names = [...bots.map((b) => b.name), ...sharedSkills.map((s) => "skill:" + s.name)];
      const w = Math.max(4, ...names.map((n) => n.length));
      console.log(`${"name".padEnd(w)}  ${targets.map((h) => h.id.padEnd(11)).join(" ")}`);
      for (const b of bots) {
        const cells = targets.map((h) => status(b, h, scope, cwd).padEnd(11));
        console.log(`${b.name.padEnd(w)}  ${cells.join(" ")}`);
      }
      for (const sk of sharedSkills) {
        const cells = targets.map((h) => skillStatus(sk, h, scope, cwd).padEnd(11));
        console.log(`${("skill:" + sk.name).padEnd(w)}  ${cells.join(" ")}`);
      }
      return;
    }
    default:
      throw new Error(`Unknown command "${args.cmd}". Run \`autobots --help\`.`);
  }
}

/** Run `main`, turning thrown errors into a one-line message and exit code 1. */
export function run(argv: string[], rt: Runtime) {
  try {
    main(argv, rt);
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    process.exit(1);
  }
}
