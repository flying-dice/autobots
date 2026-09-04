import { describe, expect, test } from "bun:test";
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseFrontmatter, stringifyFrontmatter } from "../src/frontmatter.ts";
import { loadAutobots, loadCatalog } from "../src/autobots.ts";
import { readTree, children, type Tree } from "../src/tree.ts";
import { HARNESSES, HARNESS_IDS, resolveHarnesses } from "../src/harnesses/index.ts";
import { install, uninstall, status, installSkill, uninstallSkill, skillStatus } from "../src/install.ts";

const REPO = resolve(import.meta.dir, "..");
const catalog = loadCatalog(readTree(REPO));

function fixtureTree(): Tree {
  return {
    "autobots/optimus/AUTOBOT.md": `---\nname: optimus\ndescription: Leads the team\nmodel: opus\ntools: [Read, Bash]\n---\n\nYou are Optimus.\n`,
    "autobots/optimus/skills/roll-out/SKILL.md": "---\nname: roll-out\ndescription: Go\n---\nGo.\n",
    "autobots/optimus/skills/roll-out/ref/notes.md": "extra file",
    "autobots/_ignored/AUTOBOT.md": "---\nname: nope\n---\n",
    "skills/shared-one/SKILL.md": "---\nname: shared-one\ndescription: Shared\n---\nShared.\n",
  };
}

describe("frontmatter", () => {
  test("parses scalars and lists", () => {
    const { data, body } = parseFrontmatter("---\na: 1\nb: [x, y]\nc:\n  - p\n  - q\n---\nbody\n");
    expect(data).toEqual({ a: "1", b: ["x", "y"], c: ["p", "q"] });
    expect(body).toBe("body\n");
  });
  test("round-trips", () => {
    const out = stringifyFrontmatter({ name: "x", description: "a: b", tools: ["R"] }, "hi");
    expect(parseFrontmatter(out).data).toEqual({ name: "x", description: "a: b", tools: ["R"] });
  });
});

describe("tree", () => {
  test("readTree matches the on-disk files and children() groups them", () => {
    const tree = readTree(REPO);
    expect(tree["autobots/optimus-prime/AUTOBOT.md"]).toBe(readFileSync(join(REPO, "autobots/optimus-prime/AUTOBOT.md"), "utf8"));
    expect([...children(tree, "skills").keys()].sort()).toEqual(catalog.skills.map((s) => s.name));
  });
});

describe("loadCatalog", () => {
  test("loads bots, nested skill files and shared skills, skips underscore dirs", () => {
    const c = loadCatalog(fixtureTree());
    expect(c.autobots.map((b) => b.name)).toEqual(["optimus"]);
    expect(c.autobots[0].tools).toEqual(["Read", "Bash"]);
    expect(c.autobots[0].skills[0].files).toEqual({ "SKILL.md": expect.any(String), "ref/notes.md": "extra file" });
    expect(c.autobots[0].prompt).toBe("You are Optimus.");
    expect(c.skills.map((s) => s.name)).toEqual(["shared-one"]);
  });
});

describe("harnesses", () => {
  test("resolve aliases", () => {
    expect(resolveHarnesses("cc,openai").map((h) => h.id)).toEqual(["claude", "codex"]);
    expect(resolveHarnesses(undefined).map((h) => h.id)).toEqual(HARNESS_IDS);
    expect(() => resolveHarnesses("cursor")).toThrow();
  });

  for (const id of HARNESS_IDS) {
    test(`${id}: install, status, uninstall (project scope)`, () => {
      const [bot] = loadAutobots(fixtureTree());
      const cwd = mkdtempSync(join(tmpdir(), "proj-"));
      const h = HARNESSES[id];
      const opts = { scope: "project" as const, cwd, dryRun: false };
      expect(status(bot, h, "project", cwd)).toBe("missing");
      expect(install(bot, h, opts).length).toBe(2);
      for (const p of h.ownedPaths(bot, "project", cwd)) expect(existsSync(p)).toBe(true);
      expect(existsSync(join(h.skillsRoot("project", cwd), "roll-out", "ref", "notes.md"))).toBe(true);
      expect(status(bot, h, "project", cwd)).toBe("installed");
      const main = readFileSync(h.plan(bot, "project", cwd).files[0].path, "utf8");
      expect(main).toContain("You are Optimus.");
      expect(main).toContain("Leads the team");
      expect(install(bot, h, opts)[0].kind).toBe("unchanged");
      uninstall(bot, h, opts);
      expect(status(bot, h, "project", cwd)).toBe("missing");
    });

    test(`${id}: shared skill install/uninstall`, () => {
      const cwd = mkdtempSync(join(tmpdir(), "proj-"));
      const h = HARNESSES[id];
      const opts = { scope: "project" as const, cwd, dryRun: false };
      const skill = catalog.skills[0];
      installSkill(skill, h, opts);
      expect(skillStatus(skill, h, "project", cwd)).toBe("installed");
      expect(existsSync(join(h.skillsRoot("project", cwd), skill.name, "SKILL.md"))).toBe(true);
      uninstallSkill(skill, h, opts);
      expect(skillStatus(skill, h, "project", cwd)).toBe("missing");
    });
  }

  test("dry run touches nothing", () => {
    const [bot] = loadAutobots(fixtureTree());
    const cwd = mkdtempSync(join(tmpdir(), "proj-"));
    install(bot, HARNESSES.claude, { scope: "project", cwd, dryRun: true });
    expect(status(bot, HARNESSES.claude, "project", cwd)).toBe("missing");
  });
});

describe("real autobots and skills", () => {
  const bots = catalog.autobots;
  test("all twelve load with Claude-specific frontmatter intact", () => {
    expect(bots.map((b) => b.name)).toEqual([
      "arcee", "bumblebee", "bumblebee-lite", "ironhide", "ironhide-deep", "jazz", "jazz-deep",
      "optimus-prime", "prowl", "prowl-deep", "ratchet", "ratchet-deep",
    ]);
    const optimus = bots.find((b) => b.name === "optimus-prime")!;
    expect(optimus.tools?.[0]).toStartWith("Agent(bumblebee,");
    expect(optimus.tools).toContain("AskUserQuestion");
    expect(optimus.effort).toBe("low");
    expect(optimus.frontmatter.memory).toBe("project");
    expect(bots.find((b) => b.name === "prowl")!.frontmatter.disallowedTools).toBe("Agent, SendMessage");
  });
  test("all five shared skills load", () => {
    expect(catalog.skills.map((s) => s.name)).toEqual([
      "clean-code-review", "ddd-hexagonal", "pre-commit", "refactor", "repodoc-workflow",
    ]);
  });
  test("claude adapter reproduces AUTOBOT.md verbatim", () => {
    for (const b of bots) {
      const out = HARNESSES.claude.plan(b, "project", "/x").files[0].content;
      expect(out).toBe(readFileSync(join(REPO, "autobots", b.name, "AUTOBOT.md"), "utf8"));
    }
  });
  test("codex adapter prescribes a Codex model per tier and passes effort through", () => {
    const { CODEX_MODELS } = require("../src/harnesses/codex.ts");
    for (const b of bots) {
      const toml = HARNESSES.codex.plan(b, "project", "/x").files[0].content;
      expect(toml).toContain(`model = "${CODEX_MODELS[b.model!]}"`);
      expect(toml).toContain(`model_reasoning_effort = "${b.effort}"`);
      expect(toml).toContain(`yours is ${CODEX_MODELS[b.model!]} at ${b.effort} effort`);
    }
    const prowl = HARNESSES.codex.plan(bots.find((b) => b.name === "prowl")!, "project", "/x").files[0].content;
    expect(prowl).toContain('model = "gpt-5.6-sol"');
    expect(prowl).toContain('sandbox_mode = "read-only"');
    expect(HARNESSES.codex.plan(bots.find((b) => b.name === "bumblebee")!, "project", "/x").files[0].content).toContain('sandbox_mode = "workspace-write"');
  });
  test("codex installs the dispatcher as a skill too, so $optimus-prime takes over the primary session", () => {
    const optimus = bots.find((b) => b.name === "optimus-prime")!;
    const plan = HARNESSES.codex.plan(optimus, "project", "/x");
    expect(plan.dirs.map((d) => d.path)).toContain("/x/.agents/skills/optimus-prime");
    const skill = plan.dirs.at(-1)!.files[0].content;
    expect(skill).toContain("name: optimus-prime");
    expect(skill).not.toContain("claude --agent");
    expect(HARNESSES.codex.ownedPaths(optimus, "project", "/x")).toContain("/x/.agents/skills/optimus-prime");
    expect(HARNESSES.codex.plan(bots.find((b) => b.name === "bumblebee")!, "project", "/x").dirs).toHaveLength(0);
  });
});

describe("prompt adaptation", () => {
  const optimus = catalog.autobots.find((b) => b.name === "optimus-prime")!;
  const bumblebee = catalog.autobots.find((b) => b.name === "bumblebee")!;

  test("claude takes the prompt verbatim", () => {
    expect(HARNESSES.claude.adaptPrompt(optimus)).toBe(optimus.prompt);
  });

  for (const id of HARNESS_IDS.filter((h) => h !== "claude")) {
    test(`${id}: dispatcher and teammate get harness notes, no Claude launch command`, () => {
      const h = HARNESSES[id];
      const lead = h.adaptPrompt(optimus);
      expect(lead).toContain(`## Operating in ${h.label}`);
      expect(lead).toContain("bumblebee, bumblebee-lite, ironhide");
      expect(lead).not.toContain("claude --agent");
      expect(lead).not.toContain("AskUserQuestion");
      const dev = h.adaptPrompt(bumblebee);
      expect(dev).toContain(`## Operating in ${h.label}`);
      expect(dev).not.toContain("spawn_agent tool, naming");
      expect(h.plan(optimus, "project", "/x").files[0].content).not.toContain("claude --agent");
    });
  }

  test("AUTOBOT.<harness>.md overrides the generated prompt", () => {
    const tree = fixtureTree();
    tree["autobots/optimus/AUTOBOT.codex.md"] = "---\ndescription: Codex flavour\n---\n\nHand-written for Codex.\n";
    const [bot] = loadAutobots(tree);
    expect(HARNESSES.codex.adaptPrompt(bot)).toBe("Hand-written for Codex.");
    expect(HARNESSES.codex.plan(bot, "project", "/x").files[0].content).toContain("Codex flavour");
    const [plain] = loadAutobots(fixtureTree());
    expect(HARNESSES.codex.adaptPrompt(plain)).toContain("## Operating in Codex");
  });
});

describe("cli flags", () => {
  const bin = join(REPO, "src", "bin.ts");
  const run = (...args: string[]) => Bun.spawnSync(["bun", bin, ...args], { cwd: mkdtempSync(join(tmpdir(), "flags-")) });
  test("install, uninstall and status refuse to assume a harness or scope", () => {
    for (const cmd of ["install", "uninstall", "status"]) {
      const noHarness = run(cmd, "--all", "--scope", "user", "--dry-run");
      expect(noHarness.exitCode).toBe(1);
      expect(noHarness.stderr.toString()).toContain("--harness is required");
      const noScope = run(cmd, "--all", "--harness", "claude", "--dry-run");
      expect(noScope.exitCode).toBe(1);
      expect(noScope.stderr.toString()).toContain("--scope is required");
    }
    expect(run("status", "--harness", "claude", "--scope", "home").stderr.toString()).toContain("Unknown scope");
    expect(run("status", "--harness", "claude", "--scope", "project").exitCode).toBe(0);
    expect(run("install", "--all", "--harness", "all", "--scope", "project", "--dry-run").exitCode).toBe(0);
  });
});

describe("bundle", () => {
  test("builds and runs over stdin with embedded content", () => {
    const build = Bun.spawnSync(["bun", "scripts/build.ts"], { cwd: REPO });
    expect(build.exitCode).toBe(0);
    const bundle = readFileSync(join(REPO, "dist", "autobots.ts"));
    const cwd = mkdtempSync(join(tmpdir(), "bundle-"));
    const run = Bun.spawnSync(["bun", "run", "-", "install", "--all", "--scope", "project", "--harness", "claude"], { cwd, stdin: bundle });
    expect(run.exitCode).toBe(0);
    expect(readFileSync(join(cwd, ".claude/agents/autobots/optimus-prime.md"), "utf8")).toBe(
      readFileSync(join(REPO, "autobots/optimus-prime/AUTOBOT.md"), "utf8"),
    );
    expect(existsSync(join(cwd, ".claude/skills/pre-commit/SKILL.md"))).toBe(true);
    const ver = Bun.spawnSync(["bun", "run", "-", "--version"], { cwd, stdin: bundle });
    expect(ver.stdout.toString()).toMatch(/^autobots \d+\.\d+\.\d+/);
  });
});
