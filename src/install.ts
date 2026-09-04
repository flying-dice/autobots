import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Autobot, Harness, PlannedDir, PlannedFile, Scope, Skill } from "./types.ts";

export interface Options {
  scope: Scope;
  cwd: string;
  dryRun: boolean;
  /** CLI version recorded in the manifest. */
  version: string;
}

export type Action = { kind: "write" | "copy" | "remove" | "prune" | "unchanged"; path: string };

export type Status = "installed" | "partial" | "missing";

/** Something the CLI can install: a bot or a shared skill, addressed by a stable key. */
export type Item = { key: string; plan: (h: Harness, scope: Scope, cwd: string) => { files: PlannedFile[]; dirs: PlannedDir[] } };

export function botItem(bot: Autobot): Item {
  return { key: `bot:${bot.name}`, plan: (h, scope, cwd) => h.plan(bot, scope, cwd) };
}

export function skillItem(skill: Skill): Item {
  return {
    key: `skill:${skill.name}`,
    plan: (h, scope, cwd) => ({ files: [], dirs: [skillDirAt(skill, join(h.skillsRoot(scope, cwd), skill.name))] }),
  };
}

/**
 * Record of everything the CLI wrote for one harness and scope, so a later
 * version can remove paths it no longer produces. Lives at
 * <harness scope root>/autobots-manifest.json.
 */
export interface Manifest {
  version: string;
  updatedAt: string;
  items: Record<string, string[]>;
}

export function manifestPath(harness: Harness, scope: Scope, cwd: string): string {
  return join(scope === "user" ? harness.userRoot() : harness.projectRoot(cwd), "autobots-manifest.json");
}

export function readManifest(harness: Harness, scope: Scope, cwd: string): Manifest {
  const p = manifestPath(harness, scope, cwd);
  if (!existsSync(p)) return { version: "", updatedAt: "", items: {} };
  try {
    const m = JSON.parse(readFileSync(p, "utf8")) as Partial<Manifest>;
    return { version: m.version ?? "", updatedAt: m.updatedAt ?? "", items: m.items ?? {} };
  } catch {
    return { version: "", updatedAt: "", items: {} };
  }
}

function writeManifest(harness: Harness, opts: Options, manifest: Manifest): void {
  if (opts.dryRun) return;
  const p = manifestPath(harness, opts.scope, opts.cwd);
  mkdirSync(dirname(p), { recursive: true });
  const out: Manifest = { version: opts.version, updatedAt: new Date().toISOString(), items: sortKeys(manifest.items) };
  writeFileSync(p, JSON.stringify(out, null, 2) + "\n");
}

/**
 * Install `items` into a harness. Paths a previously installed item owned but
 * no longer produces are removed first. With `pruneOthers`, every manifest item
 * not in `items` is removed too, which is how `install --all` retires bots or
 * skills dropped in a newer version.
 */
export function install(items: Item[], harness: Harness, opts: Options, pruneOthers = false): Map<string, Action[]> {
  const manifest = readManifest(harness, opts.scope, opts.cwd);
  const out = new Map<string, Action[]>();
  const keep = new Set(items.map((i) => i.key));

  if (pruneOthers) {
    for (const key of Object.keys(manifest.items)) {
      if (keep.has(key)) continue;
      out.set(key, removeAll(manifest.items[key], "prune", opts.dryRun));
      delete manifest.items[key];
    }
  }

  for (const item of items) {
    const plan = item.plan(harness, opts.scope, opts.cwd);
    const owned = [...plan.files.map((f) => f.path), ...plan.dirs.map((d) => d.path)];
    const stale = (manifest.items[item.key] ?? []).filter((p) => !owned.includes(p) && !owned.some((o) => p.startsWith(o + "/")));
    const actions = [
      ...removeAll(stale, "prune", opts.dryRun),
      ...plan.files.map((f) => writeFile(f, opts.dryRun)),
      ...plan.dirs.map((d) => replaceDir(d, opts.dryRun)),
    ];
    out.set(item.key, actions);
    manifest.items[item.key] = owned;
  }

  writeManifest(harness, opts, manifest);
  return out;
}

/** Remove `items` using the manifest's record of what was written, falling back to the current plan. */
export function uninstall(items: Item[], harness: Harness, opts: Options): Map<string, Action[]> {
  const manifest = readManifest(harness, opts.scope, opts.cwd);
  const out = new Map<string, Action[]>();
  for (const item of items) {
    const plan = item.plan(harness, opts.scope, opts.cwd);
    const recorded = manifest.items[item.key] ?? [];
    const planned = [...plan.files.map((f) => f.path), ...plan.dirs.map((d) => d.path)];
    out.set(item.key, removeAll([...new Set([...recorded, ...planned])], "remove", opts.dryRun));
    delete manifest.items[item.key];
  }
  writeManifest(harness, opts, manifest);
  return out;
}

export function status(item: Item, harness: Harness, scope: Scope, cwd: string): Status {
  const plan = item.plan(harness, scope, cwd);
  const paths = [...plan.files.map((f) => f.path), ...plan.dirs.map((d) => d.path)];
  const present = paths.filter((p) => existsSync(p)).length;
  if (present === 0) return "missing";
  return present === paths.length ? "installed" : "partial";
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

function removeAll(paths: string[], kind: "remove" | "prune", dryRun: boolean): Action[] {
  return paths
    .filter((p) => existsSync(p))
    .map((p) => {
      if (!dryRun) rmSync(p, { recursive: true, force: true });
      return { kind, path: p };
    });
}

function sortKeys<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}
