import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Autobot, Harness, PlannedDir, PlannedFile, Scope, Skill } from "./types.ts";

export interface Options {
  scope: Scope;
  cwd: string;
  dryRun: boolean;
}

export type Action = { kind: "write" | "copy" | "remove" | "unchanged"; path: string };

export type Status = "installed" | "partial" | "missing";

export function install(bot: Autobot, harness: Harness, opts: Options): Action[] {
  const plan = harness.plan(bot, opts.scope, opts.cwd);
  return [...plan.files.map((f) => writeFile(f, opts.dryRun)), ...plan.dirs.map((d) => replaceDir(d, opts.dryRun))];
}

export function uninstall(bot: Autobot, harness: Harness, opts: Options): Action[] {
  return harness
    .ownedPaths(bot, opts.scope, opts.cwd)
    .filter((p) => existsSync(p))
    .map((p) => remove(p, opts.dryRun));
}

export function status(bot: Autobot, harness: Harness, scope: Scope, cwd: string): Status {
  const paths = harness.ownedPaths(bot, scope, cwd);
  const present = paths.filter((p) => existsSync(p)).length;
  if (present === 0) return "missing";
  return present === paths.length ? "installed" : "partial";
}

export function installSkill(skill: Skill, harness: Harness, opts: Options): Action {
  return replaceDir(skillDir(skill, harness, opts.scope, opts.cwd), opts.dryRun);
}

export function uninstallSkill(skill: Skill, harness: Harness, opts: Options): Action | null {
  const dir = skillDir(skill, harness, opts.scope, opts.cwd).path;
  return existsSync(dir) ? remove(dir, opts.dryRun) : null;
}

export function skillStatus(skill: Skill, harness: Harness, scope: Scope, cwd: string): Status {
  return existsSync(join(harness.skillsRoot(scope, cwd), skill.name, "SKILL.md")) ? "installed" : "missing";
}

/** A skill as a directory plan rooted in the harness's skills folder. */
export function skillDir(skill: Skill, harness: Harness, scope: Scope, cwd: string): PlannedDir {
  return skillDirAt(skill, join(harness.skillsRoot(scope, cwd), skill.name));
}

export function skillDirAt(skill: Skill, path: string): PlannedDir {
  return { path, files: Object.entries(skill.files).map(([rel, content]) => ({ path: join(path, rel), content })) };
}

function writeFile(f: PlannedFile, dryRun: boolean): Action {
  if (existsSync(f.path) && readFileSync(f.path, "utf8") === f.content) return { kind: "unchanged", path: f.path };
  if (!dryRun) {
    mkdirSync(dirname(f.path), { recursive: true });
    writeFileSync(f.path, f.content);
  }
  return { kind: "write", path: f.path };
}

/** Replace the directory wholesale so files removed upstream do not linger. */
function replaceDir(d: PlannedDir, dryRun: boolean): Action {
  if (!dryRun) {
    rmSync(d.path, { recursive: true, force: true });
    for (const f of d.files) {
      mkdirSync(dirname(f.path), { recursive: true });
      writeFileSync(f.path, f.content);
    }
  }
  return { kind: "copy", path: d.path };
}

function remove(path: string, dryRun: boolean): Action {
  if (!dryRun) rmSync(path, { recursive: true, force: true });
  return { kind: "remove", path };
}
