/**
 * Cut a release: bump package.json, commit, tag vX.Y.Z and push. The release
 * workflow builds the bundle and attaches it to the GitHub release.
 *
 *   bun run release patch|minor|major|<x.y.z>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const kind = process.argv[2];
if (!kind) {
  console.error("usage: bun run release patch|minor|major|<x.y.z>");
  process.exit(1);
}

const [major, minor, patch] = String(pkg.version).split(".").map(Number);
const next =
  kind === "patch" ? `${major}.${minor}.${patch + 1}`
  : kind === "minor" ? `${major}.${minor + 1}.0`
  : kind === "major" ? `${major + 1}.0.0`
  : kind;
if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`not a version: ${next}`);
  process.exit(1);
}

const sh = (cmd: string[]) => {
  const p = Bun.spawnSync(cmd, { cwd: root, stdio: ["inherit", "inherit", "inherit"] });
  if (p.exitCode !== 0) process.exit(p.exitCode);
};

if (Bun.spawnSync(["git", "status", "--porcelain"], { cwd: root }).stdout.toString().trim()) {
  console.error("working tree is not clean; commit or stash first");
  process.exit(1);
}
sh(["bun", "test"]);
sh(["bun", "run", "build"]);

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
sh(["git", "add", "package.json"]);
sh(["git", "commit", "-m", `Release v${next}`]);
sh(["git", "tag", "-a", `v${next}`, "-m", `v${next}`]);
sh(["git", "push"]);
sh(["git", "push", "origin", `v${next}`]);
console.log(`tagged v${next}; the release workflow will publish dist/autobots.ts`);
