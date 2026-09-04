import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

/** Relative POSIX path -> file content. The unit the CLI reads Autobots and skills from. */
export type Tree = Record<string, string>;

/** Read `autobots/` and `skills/` under `root` into a tree. */
export function readTree(root: string): Tree {
  const tree: Tree = {};
  for (const top of ["autobots", "skills"]) {
    const dir = join(root, top);
    if (!existsSync(dir)) continue;
    walk(dir, (file) => {
      tree[relative(root, file).split("\\").join("/")] = readFileSync(file, "utf8");
    });
  }
  return tree;
}

function walk(dir: string, visit: (file: string) => void): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, visit);
    else visit(p);
  }
}

/** Entries directly under `prefix`, as [childName, subtree-relative-to-child]. */
export function children(tree: Tree, prefix: string): Map<string, Tree> {
  const out = new Map<string, Tree>();
  const base = prefix.replace(/\/?$/, "/");
  for (const [path, content] of Object.entries(tree)) {
    if (!path.startsWith(base)) continue;
    const rest = path.slice(base.length);
    const slash = rest.indexOf("/");
    if (slash < 0) continue;
    const child = rest.slice(0, slash);
    if (!out.has(child)) out.set(child, {});
    out.get(child)![rest.slice(slash + 1)] = content;
  }
  return out;
}
